// Shared test doubles: a fake TheSportsDB answering from the real answers of
// test/fixtures/ (2026-10-18, reduced to the fields read), a state file in a
// temporary folder and a clock the tests move by hand. Nothing here touches
// the network.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createStore } from '../src/store.js';
import { SportsDbError } from '../src/sportsdb.js';

export const TZ = 'Europe/Paris';

/**
 * @param {string} name - A file of test/fixtures, without `.json`.
 * @returns {object[]} Its `events` (an empty list for `null`).
 */
export function fixture(name) {
  const json = JSON.parse(
    readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'),
  );
  return json.events ?? [];
}

/**
 * @description A raw event of TheSportsDB, the fields the integration reads.
 * @param {object} fields - What differs from a WWE show of 2026-10-20.
 * @returns {object} The event.
 */
export function rawEvent(fields = {}) {
  return {
    idEvent: '1000',
    strEvent: 'RAW #1743',
    idLeague: '4444',
    strLeague: 'WWE',
    strSeason: '2026',
    strDescriptionEN: 'Singles Match\r\nJD McDonagh vs. Joe Hendry',
    strTimestamp: '2026-10-20T00:00:00',
    dateEvent: '2026-10-20',
    dateEventLocal: '2026-10-19',
    strTime: '00:00:00',
    strTimeLocal: '17:00:00',
    strVenue: 'Pechanga Arena',
    strCity: 'San Diego, California',
    strCountry: 'United States',
    strThumb: '',
    strPoster: '',
    strVideo: '',
    strStatus: '',
    strPostponed: 'no',
    ...fields,
  };
}

/**
 * @description A fake client with the interface of src/sportsdb.js.
 * @param {object} [options] - `{ days: { 'league|date': events | Error }, seasons, premium, now }`:
 * a rate-limit error pauses it 15 minutes from `now()`.
 * @returns {object} The client, with `calls`.
 */
export function fakeClient({
  days = {},
  seasons = {},
  premium = false,
  now = () => Date.now(),
} = {}) {
  const calls = [];
  let key = premium ? 'premium' : '';
  let pausedUntil = 0;
  const answer = (table, id) => {
    const value = table[id];
    if (value instanceof Error) {
      if (value instanceof SportsDbError && value.kind === 'rate_limited') {
        pausedUntil = now() + 15 * 60 * 1000;
      }
      return Promise.reject(value);
    }
    return Promise.resolve(structuredClone(value ?? []));
  };
  return {
    calls,
    days,
    seasons,
    get premium() {
      return Boolean(key);
    },
    get dayLimit() {
      return key ? Infinity : 3;
    },
    get pausedUntil() {
      return pausedUntil > now() ? pausedUntil : 0;
    },
    setApiKey(value) {
      key = value;
      pausedUntil = 0;
    },
    eventsOfDay(league, date) {
      calls.push(`day ${league} ${date}`);
      return answer(days, `${league}|${date}`);
    },
    eventsOfSeason(league, season) {
      calls.push(`season ${league} ${season}`);
      return answer(seasons, `${league}|${season}`);
    },
  };
}

/**
 * @description A store in a fresh temporary folder.
 * @returns {{ store: object, path: string, cleanup: Function }} The store.
 */
export function tempStore() {
  const dir = mkdtempSync(join(tmpdir(), 'wrestling-test-'));
  const path = join(dir, 'state.json');
  return {
    store: createStore({ path, flushDelay: 0 }),
    path,
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * @description A clock moved by hand.
 * @param {string} iso - Start instant.
 * @returns {{ now: Function, set: Function, advance: Function }} The clock.
 */
export function fakeClock(iso) {
  let current = Date.parse(iso);
  return {
    now: () => current,
    set: (value) => {
      current = Date.parse(value);
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

export const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
