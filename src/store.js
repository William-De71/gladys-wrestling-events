// -----------------------------------------------------------------------------
// What the integration keeps across restarts, in /data/state.json (the only
// writable place of the container):
//   - `shows`      the shows read, by TheSportsDB id (src/shows.js);
//   - `coverage`   when each day (free key) or season (premium key) of each
//                  promotion was last read: `{ "<promotion>|<day or year>": ms }`.
//                  A restart reads again only what is due;
//   - `fired`      the reminders already sent (`<show id>|<lead>` -> start),
//                  so a restart never sends one twice.
// Writes are atomic (a temporary file, then a rename) and grouped: at most
// one every few seconds, and one at shutdown.
// -----------------------------------------------------------------------------

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_PATH = '/data/state.json';
const FLUSH_DELAY_MS = 5000;

const EMPTY = () => ({ shows: {}, coverage: {}, fired: {} });

/**
 * @description The store.
 * @param {object} [options] - `{ path, logger, flushDelay }`.
 * @returns {object} The store.
 */
function createStore({ path = DEFAULT_PATH, logger, flushDelay = FLUSH_DELAY_MS } = {}) {
  let data = EMPTY();
  let timer = null;

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    for (const part of Object.keys(data)) {
      if (raw?.[part] && typeof raw[part] === 'object' && !Array.isArray(raw[part])) {
        data[part] = raw[part];
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger?.warn(`unable to read ${path}: ${error.message}`);
    }
  }

  const flush = () => {
    clearTimeout(timer);
    timer = null;
    try {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(`${path}.tmp`, JSON.stringify(data));
      renameSync(`${path}.tmp`, path);
    } catch (error) {
      logger?.warn(`unable to write ${path}: ${error.message}`);
    }
  };

  const changed = () => {
    if (!timer) {
      timer = setTimeout(flush, flushDelay);
      timer.unref?.();
    }
  };

  return {
    /** @returns {object[]} Every show kept. */
    shows: () => Object.values(data.shows),
    /**
     * @param {string} id - TheSportsDB id.
     * @returns {object|undefined} The show.
     */
    show: (id) => data.shows[id],
    /**
     * @description Replace the shows of one promotion over some UTC days.
     * @param {string} promotion - Promotion key.
     * @param {Function} covers - `(show) => boolean`: the shows this answer replaces.
     * @param {object[]} shows - The shows answered.
     * @returns {{ added: object[], updated: { before: object, after: object }[], removed: object[] }} What changed.
     */
    replaceShows(promotion, covers, shows) {
      const result = { added: [], updated: [], removed: [] };
      const answered = new Set(shows.map((show) => show.id));
      for (const show of Object.values(data.shows)) {
        if (show.promotion === promotion && covers(show) && !answered.has(show.id)) {
          delete data.shows[show.id];
          result.removed.push(show);
        }
      }
      for (const show of shows) {
        const before = data.shows[show.id];
        if (!before) {
          result.added.push(show);
        } else if (JSON.stringify(before) !== JSON.stringify(show)) {
          result.updated.push({ before, after: show });
        }
        data.shows[show.id] = show;
      }
      changed();
      return result;
    },
    /**
     * @param {Function} keep - `(show) => boolean`.
     * @returns {number} Shows dropped.
     */
    pruneShows(keep) {
      let count = 0;
      for (const show of Object.values(data.shows)) {
        if (!keep(show)) {
          delete data.shows[show.id];
          count += 1;
        }
      }
      if (count) {
        changed();
      }
      return count;
    },
    /**
     * @param {string} key - `<promotion>|<day or year>`.
     * @returns {number} When it was last read, 0 when never.
     */
    coveredAt: (key) => data.coverage[key] ?? 0,
    /**
     * @param {string} key - `<promotion>|<day or year>`.
     * @param {number} at - When it was read.
     */
    cover(key, at) {
      data.coverage[key] = at;
      changed();
    },
    /** @returns {number} When TheSportsDB was last read successfully, 0 when never. */
    lastRead: () => Math.max(0, ...Object.values(data.coverage)),
    /** @param {Function} keep - `(key) => boolean`: drop the other coverage entries. */
    pruneCoverage(keep) {
      for (const key of Object.keys(data.coverage)) {
        if (!keep(key)) {
          delete data.coverage[key];
          changed();
        }
      }
    },
    /**
     * @param {string} key - `<show id>|<lead>`.
     * @returns {boolean} Whether this reminder was sent.
     */
    wasFired: (key) => key in data.fired,
    /**
     * @param {string} key - `<show id>|<lead>`.
     * @param {number} until - When the entry can be forgotten.
     */
    markFired(key, until) {
      data.fired[key] = until;
      changed();
    },
    /** @param {number} now - Forget the reminders of shows long over. */
    pruneFired(now) {
      for (const [key, until] of Object.entries(data.fired)) {
        if (until < now) {
          delete data.fired[key];
          changed();
        }
      }
    },
    flush,
  };
}

export { DEFAULT_PATH, createStore };
