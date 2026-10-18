// -----------------------------------------------------------------------------
// What to read from TheSportsDB, and when.
//
// The program of a promotion is read in "jobs", one request each:
//   - free key: one UTC day of one promotion (`eventsday`). The days from
//     yesterday to the day after tomorrow are read again every 3 hours
//     (times, cards and results move in the last days), the others once a
//     day. A full window of 30 days for 5 promotions is 160 requests, spread
//     at one every 7 seconds;
//   - premium key: one season (calendar year) of one promotion
//     (`eventsseason`), every 3 hours.
// Jobs never read run first, then the nearest days. Each answer replaces the
// shows kept for what it covers (a show moved to another day leaves the old
// one), and the changes go to the scene triggers (src/events.js).
//
// A refusal of TheSportsDB (rate limit) pauses the whole scan (the client
// pauses 15 minutes); a refused key stops it until the configuration changes;
// another failure retries that job 15 minutes later.
// -----------------------------------------------------------------------------

import { SportsDbError } from './sportsdb.js';
import { normalizeShow } from './shows.js';
import { promotionOf } from './promotions.js';
import { HOUR_MS, MINUTE_MS, addDays } from './time.js';

const NEAR_DAYS = 2;
const NEAR_MAX_AGE_MS = 3 * HOUR_MS;
const FAR_MAX_AGE_MS = 24 * HOUR_MS;
const SEASON_MAX_AGE_MS = 3 * HOUR_MS;
const RETRY_MS = 15 * MINUTE_MS;
const KEEP_DAYS = 8;

/**
 * @description The jobs of the window, due or not.
 * @param {object} options - `{ promotions, today, horizonDays, premium }`.
 * @returns {object[]} `{ key, promotion, type: 'day'|'season', value, maxAge }`.
 */
function windowJobs({ promotions, today, horizonDays, premium }) {
  const jobs = [];
  if (premium) {
    const first = Number(addDays(today, -KEEP_DAYS).slice(0, 4));
    const last = Number(addDays(today, horizonDays + 1).slice(0, 4));
    for (const promotion of promotions) {
      for (let year = first; year <= last; year += 1) {
        jobs.push({
          key: `${promotion}|${year}`,
          promotion,
          type: 'season',
          value: String(year),
          maxAge: SEASON_MAX_AGE_MS,
        });
      }
    }
    return jobs;
  }
  for (let offset = -1; offset <= horizonDays + 1; offset += 1) {
    const day = addDays(today, offset);
    for (const promotion of promotions) {
      jobs.push({
        key: `${promotion}|${day}`,
        promotion,
        type: 'day',
        value: day,
        maxAge: offset <= NEAR_DAYS ? NEAR_MAX_AGE_MS : FAR_MAX_AGE_MS,
      });
    }
  }
  return jobs;
}

/**
 * @description Create the scanner.
 * @param {object} deps - Dependencies.
 * @param {object} deps.client - TheSportsDB client (src/sportsdb.js).
 * @param {object} deps.store - State file (src/store.js).
 * @param {Function} deps.config - `() => normalized config`.
 * @param {Function} deps.today - `() => 'YYYY-MM-DD'`.
 * @param {Function} [deps.now] - Clock, in ms.
 * @param {object} [deps.logger] - SDK logger.
 * @returns {object} The scanner.
 */
function createScanner({ client, store, config, today, now = () => Date.now(), logger }) {
  const failedAt = new Map();
  let keyRefused = false;
  let lastError = null;
  let lastSuccess = 0;

  const jobs = () => {
    const { promotions, horizonDays } = config();
    return windowJobs({ promotions, today: today(), horizonDays, premium: client.premium });
  };

  const isDue = (job, at) => {
    if (at - (failedAt.get(job.key) ?? -Infinity) < RETRY_MS) {
      return false;
    }
    return at - store.coveredAt(job.key) >= job.maxAge;
  };

  /** @returns {object|null} The next job to run: never read first, then the nearest. */
  const nextJob = () => {
    const at = now();
    const due = jobs().filter((job) => isDue(job, at));
    due.sort(
      (a, b) =>
        Number(store.coveredAt(a.key) > 0) - Number(store.coveredAt(b.key) > 0) ||
        a.value.localeCompare(b.value),
    );
    return due[0] ?? null;
  };

  /** Drop what left the window. */
  const prune = () => {
    const oldest = addDays(today(), -KEEP_DAYS);
    const followed = new Set(config().promotions);
    store.pruneShows((show) => show.date >= oldest && followed.has(show.promotion));
    const current = new Set(jobs().map((job) => job.key));
    store.pruneCoverage((key) => current.has(key));
  };

  /**
   * @description Run one job.
   * @param {object} job - From nextJob.
   * @returns {Promise<object>} `{ promotion, added, updated, removed, firstRead }`:
   * `firstRead` is true when what the job covers had never been read (its
   * shows are not "announced": they were not added, only seen for the first
   * time — first start, a new promotion, the window moving on).
   */
  const run = async (job) => {
    const promotion = promotionOf(job.promotion);
    const raw =
      job.type === 'season'
        ? await client.eventsOfSeason(promotion.league, job.value)
        : await client.eventsOfDay(promotion.league, job.value);
    const shows = raw
      .map(normalizeShow)
      .filter((show) => show?.promotion === job.promotion)
      .filter((show) =>
        job.type === 'season' ? show.date.startsWith(job.value) : show.date === job.value,
      );
    if (job.type === 'day' && raw.length >= client.dayLimit) {
      logger?.debug?.(`${job.key}: ${raw.length} shows, the most the free key answers`);
    }
    const covers = (show) =>
      job.type === 'season' ? show.date.startsWith(job.value) : show.date === job.value;
    const firstRead = store.coveredAt(job.key) === 0;
    const changes = store.replaceShows(job.promotion, covers, shows);
    store.cover(job.key, now());
    failedAt.delete(job.key);
    lastSuccess = now();
    lastError = null;
    return { promotion: job.promotion, ...changes, firstRead };
  };

  return {
    windowJobs: jobs,
    nextJob,
    prune,
    /**
     * @description Run the due jobs one after the other.
     * @param {object} [options] - `{ onChanges(changes), shouldStop(), max }`.
     * @returns {Promise<number>} Jobs run.
     */
    async runDue({ onChanges, shouldStop = () => false, max = Infinity } = {}) {
      let count = 0;
      prune();
      while (count < max && !keyRefused && !client.pausedUntil && !shouldStop()) {
        const job = nextJob();
        if (!job) {
          break;
        }
        try {
          const changes = await run(job);
          count += 1;
          await onChanges?.(changes);
        } catch (error) {
          lastError =
            error instanceof SportsDbError ? error : new SportsDbError('network', error.message);
          logger?.warn(`TheSportsDB ${job.key}: ${lastError.message}`);
          if (lastError.kind === 'invalid_key') {
            keyRefused = true;
          } else if (lastError.kind !== 'rate_limited') {
            failedAt.set(job.key, now());
          }
          // Whatever the failure, the next tick goes on (one failure a minute
          // at most while TheSportsDB is down).
          break;
        }
      }
      return count;
    },
    /** A new key (or none): the refusal and the retries are forgotten. */
    reset() {
      keyRefused = false;
      failedAt.clear();
      lastError = null;
    },
    /** @returns {object} `{ keyRefused, pausedUntil, lastError, lastSuccess, pending, total }`. */
    status() {
      const all = jobs();
      const at = now();
      return {
        keyRefused,
        pausedUntil: client.pausedUntil,
        lastError,
        lastSuccess,
        pending: all.filter((job) => store.coveredAt(job.key) === 0).length,
        due: all.filter((job) => isDue(job, at)).length,
        total: all.length,
      };
    },
  };
}

export { NEAR_DAYS, KEEP_DAYS, RETRY_MS, windowJobs, createScanner };
