// Widget contents (src/widgets.js), checked by the validator of the SDK.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';

import { normalizeConfig } from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import { normalizeShow } from '../src/shows.js';
import { buildNextShowWidget, buildUpcomingWidget, countdown } from '../src/widgets.js';
import { fixture, rawEvent, TZ } from './helpers.js';

const THUMB = 'https://r2.thesportsdb.com/images/media/event/thumb/72qxa31767432222.jpg';
const SHOWS = [
  normalizeShow(
    rawEvent({ strThumb: THUMB, strVideo: 'https://www.youtube.com/watch?v=zyMRVXpyk64' }),
  ),
  ...fixture('day-wwe-2026-10-20').slice(1).map(normalizeShow),
  ...fixture('day-wwe-2026-11-07').map(normalizeShow),
  ...fixture('day-njpw-2026-10-25').map(normalizeShow),
];
const BASE = {
  shows: SHOWS,
  now: Date.parse('2026-10-19T12:00:00Z'),
  today: '2026-10-19',
  timeZone: TZ,
  config: normalizeConfig({ promotions: ['wwe', 'njpw'] }),
  ready: true,
  fetchedAt: Date.parse('2026-10-19T11:58:00Z'),
};

/** The content the core would keep, in every language: nothing dropped. */
function assertValid(content) {
  const report = validateWidgetContent(content);
  assert.deepEqual(report.errors ?? [], [], JSON.stringify(report));
  assert.deepEqual(report.warnings ?? [], [], JSON.stringify(report));
}

test('upcoming: the next shows as cards, the time in the subtitle, the card behind a tap', () => {
  const content = buildUpcomingWidget({ ...BASE, settings: {} });
  assertValid(content);
  assert.equal(content.ttl_seconds, 300);
  const [caption, list] = content.components;
  assert.equal(caption.text.fr, 'TheSportsDB · lu à 13:58');
  assert.equal(list.type, 'card-list');
  assert.equal(list.items.length, 4);
  // NXT has no time: after RAW, the timed show of the same day.
  assert.deepEqual(
    list.items.map((item) => item.title),
    [
      'WWE – RAW #1743',
      'WWE – NXT #860',
      'NJPW – Super Junior Tag League Day 2',
      'WWE – Crown Jewel',
    ],
  );
  const raw = list.items[0];
  assert.equal(raw.subtitle.fr, 'mar 20 oct · 02:00 · Pechanga Arena, San Diego, California');
  assert.equal(raw.badge.text, 'WWE');
  assert.equal(raw.image, 't-72qxa31767432222-jpg-s');
  assert.match(
    raw.description.en,
    /Weekly TV show[\s\S]*Card:\nSingles Match\nJD McDonagh vs\. Joe Hendry/,
  );
  assert.equal(raw.links.length, 2);
  for (const language of LANGUAGES) {
    assert.ok(raw.subtitle[language], language);
  }
});

test('upcoming: a long venue is cut to the 60 characters of a subtitle, nothing dropped', () => {
  const long = normalizeShow(
    rawEvent({
      strVenue: 'Lawrence Joel Veterans Memorial Coliseum',
      strCity: 'Winston-Salem, North Carolina',
    }),
  );
  const content = buildUpcomingWidget({ ...BASE, shows: [long], settings: {} });
  assertValid(content);
  for (const language of LANGUAGES) {
    assert.ok(content.components[1].items[0].subtitle[language].length <= 60, language);
  }
});

test('upcoming: settings filter within the followed promotions and kinds, and cut the list', () => {
  const njpw = buildUpcomingWidget({ ...BASE, settings: { promotions: ['njpw'] } });
  assert.deepEqual(
    njpw.components[1].items.map((item) => item.title),
    ['NJPW – Super Junior Tag League Day 2'],
  );
  const big = buildUpcomingWidget({ ...BASE, settings: { kinds: ['special'] } });
  assert.deepEqual(
    big.components[1].items.map((item) => item.title),
    ['WWE – Crown Jewel'],
  );
  const three = buildUpcomingWidget({ ...BASE, settings: { count: '3' } });
  assert.equal(three.components[1].items.length, 3);
  // A promotion not followed is not shown, even when picked in the widget.
  const aew = buildUpcomingWidget({ ...BASE, settings: { promotions: ['aew'] } });
  assert.equal(aew.components[1].items.length, 4);
});

test('upcoming: the empty states, while reading and when nothing is planned', () => {
  const reading = buildUpcomingWidget({ ...BASE, shows: [], ready: false, fetchedAt: 0 });
  assertValid(reading);
  assert.equal(reading.components[0].text.en, 'TheSportsDB · not read yet');
  assert.match(reading.components[1].text.fr, /Lecture du programme/);
  const none = buildUpcomingWidget({ ...BASE, shows: [] });
  assertValid(none);
  assert.equal(none.components[1].text.de, 'Keine Show in den nächsten 30 Tagen geplant.');
});

test('next show: countdown, time, matches, poster, status and card', () => {
  const content = buildNextShowWidget({ ...BASE, shows: [SHOWS[0], SHOWS[2]], settings: {} });
  assertValid(content);
  assert.equal(content.ttl_seconds, 60, 'the countdown moves every minute');
  const types = content.components.map((component) => component.type);
  assert.deepEqual(types, ['text', 'value', 'value', 'value', 'image', 'status', 'text', 'button']);
  const [heading, countdownTile, day, matches, image, status, body, button] = content.components;
  assert.equal(heading.text, 'WWE – RAW #1743');
  assert.equal(countdownTile.value.fr, '12 h 0 min');
  assert.equal(day.label.fr, 'à 02:00');
  assert.equal(matches.value, 2);
  assert.equal(image.key, 't-72qxa31767432222-jpg-m');
  assert.deepEqual(
    status.items.map((item) => item.label.en),
    ['Promotion', 'Kind', 'Venue', 'City'],
  );
  assert.match(body.text.es, /^Cartelera:\nSingles Match/);
  assert.equal(button.link.url, 'https://www.thesportsdb.com/event/1000');
});

test('next show: an all-day show and the empty state', () => {
  const crownJewel = buildNextShowWidget({ ...BASE, settings: { kinds: ['special'] } });
  assertValid(crownJewel);
  assert.equal(crownJewel.components[0].text, 'WWE – Crown Jewel');
  assert.equal(crownJewel.components[2].label.en, 'No time yet');
  assert.ok(!crownJewel.components.some((component) => component.type === 'image'));
  const empty = buildNextShowWidget({ ...BASE, shows: [] });
  assertValid(empty);
});

test('countdown: days and hours, hours and minutes, minutes, on now; 12 characters at most', () => {
  const show = SHOWS[0];
  const at = (iso, language = 'en') => countdown(show, Date.parse(iso), language, '2026-10-17', TZ);
  assert.equal(at('2026-10-17T20:00:00Z'), '2 d 4 h');
  assert.equal(at('2026-10-19T21:30:00Z'), '2 h 30 min');
  assert.equal(at('2026-10-19T23:45:00Z', 'de'), '15 min');
  assert.equal(at('2026-10-20T00:30:00Z', 'es'), 'En directo');
  for (const language of LANGUAGES) {
    assert.ok(
      countdown(show, Date.parse('2026-09-21T01:00:00Z'), language, '2026-09-21', TZ).length <= 12,
    );
    assert.ok(
      countdown(show, Date.parse('2026-10-19T00:01:00Z'), language, '2026-09-21', TZ).length <= 12,
    );
  }
});
