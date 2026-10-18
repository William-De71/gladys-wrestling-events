// What is read from TheSportsDB, and when (src/scan.js), with a fake client.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig } from '../src/config.js';
import { createScanner, windowJobs } from '../src/scan.js';
import { SportsDbError } from '../src/sportsdb.js';
import { fakeClient, fakeClock, rawEvent, silentLogger, tempStore } from './helpers.js';

const HOUR = 3600 * 1000;

function setup({
  config = { promotions: ['wwe'], horizon_days: '14' },
  client = fakeClient(),
} = {}) {
  const clock = fakeClock('2026-10-18T10:00:00Z');
  const { store, cleanup } = tempStore();
  let current = normalizeConfig(config);
  const scanner = createScanner({
    client,
    store,
    config: () => current,
    today: () => new Date(clock.now()).toISOString().slice(0, 10),
    now: clock.now,
    logger: silentLogger,
  });
  return {
    clock,
    store,
    scanner,
    client,
    cleanup,
    setConfig: (raw) => (current = normalizeConfig(raw)),
  };
}

test('free key: yesterday to the horizon, one job per promotion and day', () => {
  const jobs = windowJobs({
    promotions: ['wwe', 'aew'],
    today: '2026-10-18',
    horizonDays: 14,
    premium: false,
  });
  assert.equal(jobs.length, 17 * 2);
  assert.equal(jobs[0].value, '2026-10-17');
  assert.equal(jobs.at(-1).value, '2026-11-02');
  // The last days move: every 3 hours; the far ones once a day.
  assert.equal(jobs.find((job) => job.value === '2026-10-20').maxAge, 3 * HOUR);
  assert.equal(jobs.find((job) => job.value === '2026-10-21').maxAge, 24 * HOUR);
});

test('premium key: one season per promotion and year of the window', () => {
  const jobs = windowJobs({
    promotions: ['wwe'],
    today: '2026-12-20',
    horizonDays: 30,
    premium: true,
  });
  assert.deepEqual(
    jobs.map((job) => job.key),
    ['wwe|2026', 'wwe|2027'],
  );
});

test('never read first, then the nearest; a job read is not due again before its age', async () => {
  const { scanner, client, clock, cleanup } = setup();
  try {
    assert.equal(scanner.nextJob().value, '2026-10-17');
    assert.equal(await scanner.runDue(), 17);
    assert.equal(client.calls[0], 'day 4444 2026-10-17');
    assert.equal(scanner.nextJob(), null);
    clock.advance(3 * HOUR);
    // The near days only (yesterday to the day after tomorrow).
    assert.equal(await scanner.runDue(), 4);
    clock.advance(21 * HOUR);
    assert.equal(await scanner.runDue(), 17);
  } finally {
    cleanup();
  }
});

test('an answer replaces the shows of its day; a moved show is an update, not a new one', async () => {
  const client = fakeClient({
    days: {
      '4444|2026-10-20': [rawEvent()],
      '4444|2026-10-21': [
        rawEvent({ idEvent: '2', strEvent: 'NXT #860', dateEvent: '2026-10-21' }),
      ],
    },
  });
  const { scanner, store, clock, cleanup } = setup({ client });
  try {
    const seen = [];
    await scanner.runDue({ onChanges: (changes) => seen.push(changes) });
    assert.equal(store.shows().length, 2);
    assert.ok(
      seen.every((changes) => changes.firstRead),
      'the first reading announces nothing',
    );

    // NXT moves to the 20th, RAW is cancelled.
    client.days['4444|2026-10-20'] = [rawEvent({ idEvent: '2', strEvent: 'NXT #860' })];
    client.days['4444|2026-10-21'] = [];
    clock.advance(3 * HOUR);
    seen.length = 0;
    await scanner.runDue({ onChanges: (changes) => seen.push(changes) });
    const day20 = seen.find((changes) => changes.updated.length || changes.removed.length);
    assert.deepEqual(
      day20.removed.map((show) => show.id),
      ['1000'],
    );
    assert.deepEqual(
      day20.updated.map(({ after }) => after.date),
      ['2026-10-20'],
    );
    assert.equal(day20.firstRead, false);
    assert.deepEqual(
      store.shows().map((show) => show.id),
      ['2'],
    );
  } finally {
    cleanup();
  }
});

test('the window moving on: the new far day is a first reading, the past is dropped', async () => {
  const { scanner, store, clock, cleanup } = setup();
  try {
    await scanner.runDue();
    clock.advance(24 * HOUR);
    const seen = [];
    await scanner.runDue({ onChanges: (changes) => seen.push(changes) });
    assert.deepEqual(
      seen.filter((changes) => changes.firstRead).length,
      1,
      'only 2026-11-03 is new',
    );
    store.replaceShows('wwe', () => false, [
      {
        id: '9',
        promotion: 'wwe',
        name: 'Old',
        kind: 'weekly',
        start: null,
        date: '2026-09-01',
        localDate: '2026-09-01',
        venue: '',
        city: '',
        country: '',
        card: '',
        thumb: '',
        video: '',
        postponed: false,
      },
    ]);
    scanner.prune();
    assert.equal(store.show('9'), undefined);
  } finally {
    cleanup();
  }
});

test('a promotion no longer followed loses its shows', async () => {
  const client = fakeClient({ days: { '4444|2026-10-20': [rawEvent()] } });
  const { scanner, store, setConfig, cleanup } = setup({ client });
  try {
    await scanner.runDue();
    assert.equal(store.shows().length, 1);
    setConfig({ promotions: ['aew'], horizon_days: '14' });
    scanner.prune();
    assert.equal(store.shows().length, 0);
  } finally {
    cleanup();
  }
});

test('a refusal pauses the scan, a refused key stops it until reset, a failure retries later', async () => {
  const client = fakeClient({
    days: { '4444|2026-10-17': new SportsDbError('rate_limited', 'too many requests', 429) },
  });
  const { scanner, cleanup } = setup({ client });
  try {
    assert.equal(await scanner.runDue(), 0);
    assert.equal(client.calls.length, 1);
    assert.equal(await scanner.runDue(), 0);
    assert.equal(client.calls.length, 1, 'paused');
    assert.equal(scanner.status().lastError.kind, 'rate_limited');
  } finally {
    cleanup();
  }

  const refused = fakeClient({
    days: { '4444|2026-10-17': new SportsDbError('invalid_key', 'refused', 400) },
  });
  const second = setup({ client: refused });
  try {
    await second.scanner.runDue();
    await second.scanner.runDue();
    assert.equal(refused.calls.length, 1);
    assert.equal(second.scanner.status().keyRefused, true);
    second.scanner.reset();
    refused.days['4444|2026-10-17'] = [];
    assert.equal(await second.scanner.runDue(), 17);
  } finally {
    second.cleanup();
  }

  const down = fakeClient({
    days: { '4444|2026-10-17': new SportsDbError('network', 'ECONNREFUSED') },
  });
  const third = setup({ client: down });
  try {
    assert.equal(await third.scanner.runDue(), 0);
    // That day waits 15 minutes; the next tick goes on with the others.
    assert.equal(await third.scanner.runDue(), 16);
    assert.equal(third.scanner.status().pending, 1);
    third.clock.advance(15 * 60 * 1000);
    down.days['4444|2026-10-17'] = [];
    assert.equal(await third.scanner.runDue(), 1);
  } finally {
    third.cleanup();
  }
});

test('premium: a season answer covers the year, the shows of other years are left alone', async () => {
  const client = fakeClient({
    premium: true,
    seasons: {
      '4444|2026': [
        rawEvent(),
        rawEvent({ idEvent: '5', dateEvent: '2027-01-02', strEvent: 'RAW #1754' }),
      ],
    },
  });
  const { scanner, store, cleanup } = setup({
    client,
    config: { promotions: ['wwe'], horizon_days: '90', api_key: 'k' },
  });
  try {
    await scanner.runDue();
    assert.deepEqual(client.calls, ['season 4444 2026', 'season 4444 2027']);
    assert.deepEqual(
      store.shows().map((show) => show.id),
      ['1000'],
      'a 2027 show filed under 2026 is ignored',
    );
  } finally {
    cleanup();
  }
});
