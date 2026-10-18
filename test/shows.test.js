// Shows and kinds, on the real answers of TheSportsDB (test/fixtures/).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { kindOf } from '../src/kinds.js';
import {
  cleanCard,
  imageUrl,
  isUpcoming,
  normalizeShow,
  showDay,
  showImage,
  upcomingShows,
} from '../src/shows.js';
import { fixture, rawEvent, TZ } from './helpers.js';

test('kinds: numbered episodes and lucha weekdays are weekly, "Day N" a tour, the rest major', () => {
  const cases = {
    'RAW #1743': 'weekly',
    'SmackDown #1376': 'weekly',
    'Dynamite #328 Maximum Carnage Day 1': 'weekly',
    'AAA on FOX #9 Rey De Reyes Part 1': 'weekly',
    'HonorClub #148': 'weekly',
    'Martes De Glamour': 'weekly',
    'Sabados De Coliseo': 'weekly',
    'Road To The New Beginning Day 3': 'tour',
    'New Year Wars Day 1': 'tour',
    'Open The New Year Gate  Tag 1': 'tour',
    'Super Junior Tag League Day 2': 'tour',
    'Crown Jewel': 'special',
    'Wrestle Kingdom 20 In Tokyo Dome': 'special',
    'WrestleMania 42 Night 1': 'special',
    'Grand Slam Australia': 'special',
  };
  for (const [name, kind] of Object.entries(cases)) {
    assert.equal(kindOf(name), kind, name);
  }
});

test('every show of the real seasons is usable and classified', () => {
  for (const name of [
    'season-wwe-2026',
    'season-njpw-2026',
    'season-cmll-2026',
    'season-ajpw-2026',
    'season-dragon-gate-2026',
  ]) {
    const shows = fixture(name).map(normalizeShow);
    assert.ok(shows.length > 0, name);
    for (const show of shows) {
      assert.ok(show, name);
      assert.match(show.id, /^\d+$/);
      assert.ok(['weekly', 'tour', 'special'].includes(show.kind));
    }
  }
  const wwe = fixture('season-wwe-2026').map(normalizeShow);
  assert.ok(wwe.filter((show) => show.kind === 'weekly').length >= 14);
});

test('a show with a local time is timed, a midnight without one is an all-day show', () => {
  const [raw, nxt] = fixture('day-wwe-2026-10-20');
  const show = normalizeShow(raw);
  assert.equal(show.promotion, 'wwe');
  assert.equal(show.name, 'RAW #1743');
  assert.equal(show.start, Date.parse('2026-10-20T00:00:00Z'));
  assert.equal(showDay(show, TZ), '2026-10-20');
  assert.equal(show.venue, 'Pechanga Arena');
  assert.equal(show.card, 'Singles Match\nJD McDonagh vs. Joe Hendry');

  const unknown = normalizeShow(nxt);
  assert.equal(unknown.start, null);
  assert.equal(showDay(unknown, TZ), unknown.localDate);

  const [crownJewel] = fixture('day-wwe-2026-11-07').map(normalizeShow);
  assert.equal(crownJewel.kind, 'special');
  assert.equal(crownJewel.start, null);
  assert.equal(crownJewel.city, 'Riyadh');
});

test('unusable events are dropped, never guessed', () => {
  assert.equal(normalizeShow(rawEvent({ idLeague: '4604' })), null, 'not a wrestling league');
  assert.equal(normalizeShow(rawEvent({ idEvent: '' })), null);
  assert.equal(normalizeShow(rawEvent({ strEvent: '  ' })), null);
  assert.equal(normalizeShow(rawEvent({ dateEvent: 'soon' })), null);
  assert.equal(normalizeShow(null), null);
  assert.equal(normalizeShow(rawEvent({ strPostponed: 'yes' })).postponed, true);
});

test('cards lose their blank lines and carriage returns', () => {
  assert.equal(cleanCard('A vs. B\r\n\r\n  C vs. D  \r\n'), 'A vs. B\nC vs. D');
  assert.equal(cleanCard(null), '');
  assert.equal(cleanCard('x'.repeat(5000)).length, 2000);
});

test('images: a stable key per show and size, the URL found back from the key alone', () => {
  const show = normalizeShow(
    rawEvent({
      strThumb: 'https://r2.thesportsdb.com/images/media/event/thumb/72qxa31767432222.jpg',
    }),
  );
  const medium = showImage(show, 'medium');
  assert.equal(medium.key, 't-72qxa31767432222-jpg-m');
  assert.match(medium.key, /^[a-z0-9][a-z0-9-]{0,63}$/);
  assert.equal(
    imageUrl(medium.key),
    'https://r2.thesportsdb.com/images/media/event/thumb/72qxa31767432222.jpg/medium',
  );
  assert.equal(
    imageUrl(showImage(show, 'small').key),
    'https://r2.thesportsdb.com/images/media/event/thumb/72qxa31767432222.jpg/small',
  );
  assert.equal(showImage(normalizeShow(rawEvent()), 'medium'), null);
  assert.equal(imageUrl('../../etc'), null);
  // Only the image host of TheSportsDB.
  const elsewhere = normalizeShow(rawEvent({ strThumb: 'https://example.com/a.jpg' }));
  assert.equal(elsewhere.thumb, '');
});

test('upcoming: over 2 to 4 hours after the bell by kind, all-day shows until midnight', () => {
  const raw = normalizeShow(rawEvent());
  const start = raw.start;
  assert.equal(isUpcoming(raw, start + 3600 * 1000, '2026-10-20', TZ), true, 'on now');
  assert.equal(isUpcoming(raw, start + 2 * 3600 * 1000, '2026-10-20', TZ), false);
  const crownJewel = normalizeShow(fixture('day-wwe-2026-11-07')[0]);
  assert.equal(isUpcoming(crownJewel, Date.parse('2026-11-07T22:00:00Z'), '2026-11-07', TZ), true);
  assert.equal(isUpcoming(crownJewel, Date.parse('2026-11-08T00:00:00Z'), '2026-11-08', TZ), false);

  const list = upcomingShows(
    [
      crownJewel,
      raw,
      normalizeShow(fixture('day-njpw-2026-10-25')[0]),
      normalizeShow(
        rawEvent({
          idEvent: '2',
          strEvent: 'SmackDown #1418',
          strTimestamp: '2026-10-24T00:00:00',
          dateEvent: '2026-10-24',
        }),
      ),
    ],
    {
      now: Date.parse('2026-10-19T12:00:00Z'),
      today: '2026-10-19',
      timeZone: TZ,
      promotions: ['wwe'],
      kinds: [],
    },
  );
  assert.deepEqual(
    list.map((show) => show.name),
    ['RAW #1743', 'SmackDown #1418', 'Crown Jewel'],
  );
});
