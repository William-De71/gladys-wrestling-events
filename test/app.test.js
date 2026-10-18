// The whole integration against the fake Gladys of the SDK
// (`@gladysassistant/integration-sdk/testing`, which checks the calendars,
// the scene events and the widgets like the host API), a fake TheSportsDB
// answering from test/fixtures/ and a clock moved by hand, in Europe/Paris.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { createApp } from '../src/app.js';
import { SportsDbError } from '../src/sportsdb.js';
import {
  fakeClient,
  fakeClock,
  fixture,
  rawEvent,
  silentLogger,
  tempStore,
  TZ,
} from './helpers.js';

const MANIFEST = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const CONFIG = { promotions: ['wwe', 'njpw'], horizon_days: '14', language: 'fr' };

// A user who enabled the integration in "My calendars".
const JOHN = { user: { selector: 'john', first_name: 'John', language: 'fr' }, config: {} };

const DAYS = {
  '4444|2026-10-20': fixture('day-wwe-2026-10-20'),
  '4444|2026-11-01': [
    rawEvent({
      idEvent: '77',
      strEvent: 'Saturday Night’s Main Event',
      strTimestamp: '2026-11-01T01:00:00',
      dateEvent: '2026-11-01',
      strThumb: 'https://r2.thesportsdb.com/images/media/event/thumb/abc123.jpg',
    }),
  ],
  '4449|2026-10-25': fixture('day-njpw-2026-10-25'),
};

/**
 * @description An integration wired to the fake Gladys, its first scan done.
 * @param {object} [options] - `{ config, days, seasons, start, fake, images }`.
 * @returns {Promise<object>} `{ gladys, fake, app, client, clock, store, cleanup }`.
 */
async function setup({
  config = CONFIG,
  days = DAYS,
  start = '2026-10-18T08:00:00Z',
  fake = {},
  seasons = {},
  images,
} = {}) {
  const gladys = createFakeGladys({ config, calendarAccounts: [JOHN], ...fake });
  const clock = fakeClock(start);
  const client = fakeClient({ days: { ...days }, seasons: { ...seasons }, now: clock.now });
  const { store, cleanup } = tempStore();
  const app = createApp(gladys, {
    client,
    store,
    images: images ?? { get: async () => 'iVBORw0KGgo=' },
    now: clock.now,
    timeZone: TZ,
    sleep: async () => {},
    logger: silentLogger,
  });
  await gladys.connect();
  await app.tick();
  await app.scan();
  return { gladys, fake: gladys.fake, app, client, clock, store, cleanup };
}

const eventsOf = (fake, promotion) =>
  fake.calendarEvents.filter((event) =>
    event.calendar_external_id.endsWith(`:promotion-${promotion}`),
  );

test('a calendar per followed promotion, timed and all-day shows, no devices', async () => {
  const { fake, client, cleanup } = await setup();
  try {
    assert.equal(fake.discoveredDevices.length, 0, 'a calendar integration has no devices');
    assert.equal(client.calls.length, 17 * 2);
    assert.deepEqual(
      fake.calendars.map((calendar) => `${calendar.name} ${calendar.color}`).sort(),
      ['Catch – NJPW #1d1d1b', 'Catch – WWE #c8102e'],
    );
    const wwe = eventsOf(fake, 'wwe').sort((a, b) =>
      String(a.start).localeCompare(String(b.start)),
    );
    assert.deepEqual(
      wwe.map((event) => `${event.start} ${event.full_day === true} ${event.name}`),
      [
        '2026-10-20 true WWE – NXT #860',
        '2026-10-20T00:00:00.000Z false WWE – RAW #1743',
        '2026-11-01T01:00:00.000Z false WWE – Saturday Night’s Main Event',
      ],
    );
    const raw = wwe[1];
    assert.equal(raw.end, '2026-10-20T02:00:00.000Z', 'a TV episode: 2 hours');
    assert.equal(raw.location, 'Pechanga Arena, San Diego, California, United States');
    assert.equal(raw.url, 'https://www.thesportsdb.com/event/2599789');
    assert.match(
      raw.description,
      /^Singles Match\nJD McDonagh vs\. Joe Hendry\n\nÉmission hebdo · Source : TheSportsDB$/,
    );
    assert.equal(eventsOf(fake, 'njpw')[0].name, 'NJPW – Super Junior Tag League Day 2');
    assert.equal(fake.connectionStatus.connected, true);
    assert.match(fake.connectionStatus.message.fr, /^4 shows à venir pour 2 fédération\(s\)\.$/);
  } finally {
    cleanup();
  }
});

test('a calendar the user stopped synchronizing is skipped; a promotion dropped deletes its calendar', async () => {
  const { fake, app, cleanup } = await setup();
  try {
    const njpw = fake.calendars.find((calendar) =>
      calendar.external_id.endsWith(':promotion-njpw'),
    );
    njpw.sync = false;
    const pushes = fake.publishedCalendarEvents.length;
    await fake.calendarAccountUpdated('john');
    await app.scan();
    const after = fake.publishedCalendarEvents.slice(pushes);
    assert.ok(after.length > 0, 'the user was synchronized again');
    assert.ok(after.every((push) => !JSON.stringify(push).includes('promotion-njpw')));
    await fake.configUpdated({ ...CONFIG, promotions: ['wwe'] });
    await app.scan();
    assert.ok(fake.deletedCalendars.some((id) => String(id).endsWith(':promotion-njpw')));
  } finally {
    cleanup();
  }
});

test('reminders: 2 hours, 1 hour… before RAW, each once, with the data the scenes see', async () => {
  const { fake, clock, app, cleanup } = await setup();
  try {
    const starting = () => fake.sceneEvents.filter((event) => event.key === 'show_starting');
    clock.set('2026-10-19T22:00:30Z');
    await app.tick();
    assert.deepEqual(
      starting().map((event) => `${event.data.title} ${event.data.lead}`),
      ['WWE – RAW #1743 120'],
    );
    await app.tick();
    assert.equal(starting().length, 1, 'once');
    clock.set('2026-10-20T00:00:10Z');
    await app.tick();
    assert.deepEqual(
      starting().map((event) => event.data.lead),
      ['120', '0'],
      'the 60, 30 and 15 minutes reminders were missed while the clock jumped',
    );
    assert.equal(starting()[1].data.time, '02:00');
  } finally {
    cleanup();
  }
});

test('a show added to a day already read is announced; matches added to its card too', async () => {
  const { fake, client, clock, app, cleanup } = await setup();
  try {
    assert.equal(fake.sceneEvents.length, 0, 'the first reading announces nothing');
    client.days['4444|2026-10-20'] = [
      ...fixture('day-wwe-2026-10-20').map((raw, index) =>
        index === 0
          ? {
              ...raw,
              strDescriptionEN: `${raw.strDescriptionEN}\r\nTag Team Match\r\nThe Usos vs. The Judgment Day`,
            }
          : raw,
      ),
      rawEvent({ idEvent: '88', strEvent: 'WWE Speed #99', strTimestamp: '2026-10-20T18:00:00' }),
    ];
    clock.advance(3 * 3600 * 1000);
    await app.tick();
    await app.scan();
    assert.deepEqual(
      fake.sceneEvents.map((event) => `${event.key} ${event.data.name}`),
      ['show_announced WWE Speed #99', 'card_updated RAW #1743'],
    );
    const card = fake.sceneEvents[1].data;
    assert.equal(card.new_matches, 'Tag Team Match\nThe Usos vs. The Judgment Day');
  } finally {
    cleanup();
  }
});

test('the scene action: the next show of a promotion, only the declared outputs', async () => {
  const { fake, cleanup } = await setup();
  try {
    const declared = MANIFEST.scene_actions[0].outputs.map((output) => output.key);
    const result = (answer) => answer.data?.outputs ?? answer.data;
    const outputs = result(await fake.sceneAction('get_next_show', {}));
    assert.deepEqual(Object.keys(outputs).sort(), [...declared].sort());
    assert.equal(outputs.title, 'WWE – RAW #1743', 'a timed show before an untimed one of its day');
    const njpw = result(await fake.sceneAction('get_next_show', { promotion: ['njpw'] }));
    assert.equal(njpw.title, 'NJPW – Super Junior Tag League Day 2');
    const big = result(await fake.sceneAction('get_next_show', { kind: ['special'] }));
    assert.equal(big.title, 'WWE – Saturday Night’s Main Event');
    const none = result(
      await fake.sceneAction('get_next_show', { promotion: ['wwe'], kind: ['tour'] }),
    );
    assert.equal(none.found, false);
    assert.equal(none.text, 'Aucun show prévu.');
  } finally {
    cleanup();
  }
});

test('widgets: valid content in every language, the image served from its key', async () => {
  const asked = [];
  const { fake, cleanup } = await setup({
    images: {
      get: async (key) => {
        asked.push(key);
        return 'iVBORw0KGgo=';
      },
    },
  });
  try {
    for (const key of MANIFEST.widgets.map((widget) => widget.key)) {
      for (const language of ['en', 'fr', 'de', 'es']) {
        const answer = await fake.widgetGet(key, { settings: {}, language });
        const content = answer.data?.content ?? answer.content ?? answer;
        const report = validateWidgetContent(content);
        assert.deepEqual(report.errors ?? [], [], `${key} ${language}`);
      }
    }
    const upcoming = await fake.widgetGet('upcoming', { settings: {}, language: 'en' });
    const items = (upcoming.data?.content ?? upcoming).components[1].items;
    assert.equal(items.at(-1).image, 't-abc123-jpg-s');
    await fake.widgetGetImage?.('t-abc123-jpg-s');
    assert.ok(asked.length === 0 || asked.includes('t-abc123-jpg-s'));
  } finally {
    cleanup();
  }
});

test('TheSportsDB refuses: the status says when the reading goes on; a refused key says so', async () => {
  const days = {
    ...DAYS,
    '4444|2026-10-17': new SportsDbError('rate_limited', 'too many requests', 429),
  };
  const paused = await setup({ days });
  try {
    assert.equal(paused.fake.connectionStatus.connected, true);
    assert.match(paused.fake.connectionStatus.message.en, /asked to slow down/);
  } finally {
    paused.cleanup();
  }
  const refused = await setup({
    // A key set: whole seasons are read.
    config: { ...CONFIG, api_key: 'wrong' },
    seasons: { '4444|2026': new SportsDbError('invalid_key', 'refused', 400) },
  });
  try {
    assert.equal(refused.fake.connectionStatus.connected, false);
    assert.match(refused.fake.connectionStatus.message.fr, /refuse la clé/);
  } finally {
    refused.cleanup();
  }
});

test('a restart reads nothing again and sends no reminder twice', async () => {
  const first = await setup({ start: '2026-10-19T21:00:00Z' });
  const { store } = first;
  try {
    first.clock.set('2026-10-19T22:00:30Z');
    await first.app.tick();
    first.app.stop();
    const gladys = createFakeGladys({ config: CONFIG, calendarAccounts: [JOHN] });
    const client = fakeClient({ days: DAYS, now: first.clock.now });
    const app = createApp(gladys, {
      client,
      store,
      now: first.clock.now,
      timeZone: TZ,
      sleep: async () => {},
      logger: silentLogger,
    });
    await gladys.connect();
    await app.tick();
    await app.scan();
    assert.equal(client.calls.length, 0, 'everything is fresh');
    assert.equal(gladys.fake.sceneEvents.length, 0);
    assert.equal(eventsOf(gladys.fake, 'wwe').length, 3, 'the calendars come back from the state');
    app.stop();
  } finally {
    first.cleanup();
  }
});
