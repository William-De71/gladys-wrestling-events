// -----------------------------------------------------------------------------
// HTTP client of TheSportsDB (https://www.thesportsdb.com, API v1, JSON).
//
// Two endpoints, both answering `{ "events": [...] | null }`:
//   - `eventsday.php?d=<UTC date>&l=<league id>`  the shows of one promotion
//     on one day. The free key answers at most 3 shows per request, which is
//     enough for every promotion but CMLL on its busiest days;
//   - `eventsseason.php?id=<league id>&s=<year>`  a whole season. The free
//     key answers only its first 15 shows: used with a premium key only.
//
// Be gentle: the free key is shared by everybody, its documented limit is 30
// requests a minute, and the Cloudflare in front of the API blocks bursts
// well below that ("error code: 1015"). Requests are spaced (7 s with the free
// key, 1 s with a premium one) and a refusal pauses every request for 15
// minutes. The key never reaches the logs (it is part of the URL).
// -----------------------------------------------------------------------------

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json';
const FREE_KEY = '123';
const FREE_SPACING_MS = 7000;
const PREMIUM_SPACING_MS = 1000;
const PAUSE_MS = 15 * 60 * 1000;
const TIMEOUT_MS = 20 * 1000;
const FREE_DAY_LIMIT = 3;

class SportsDbError extends Error {
  /**
   * @param {string} kind - `rate_limited`, `invalid_key`, `http`, `network` or `invalid`.
   * @param {string} message - Details, never the key.
   * @param {number} [status] - HTTP status.
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'SportsDbError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @description Create the client.
 * @param {object} [options] - Dependencies and settings.
 * @param {string} [options.apiKey] - A premium key; empty for the free one.
 * @param {Function} [options.fetch] - `fetch`, replaced in the tests.
 * @param {Function} [options.now] - Clock, in ms.
 * @param {Function} [options.sleep] - Delay between two requests.
 * @param {string} [options.userAgent] - Names the integration and its version.
 * @returns {object} `{ premium, eventsOfDay, eventsOfSeason, pausedUntil, setApiKey }`.
 */
function createSportsDbClient({
  apiKey = '',
  fetch = globalThis.fetch,
  now = () => Date.now(),
  sleep = defaultSleep,
  userAgent = 'gladys-wrestling-events',
} = {}) {
  let key = String(apiKey ?? '').trim();
  let lastRequest = 0;
  let pausedUntil = 0;
  let chain = Promise.resolve();

  const spacing = () => (key ? PREMIUM_SPACING_MS : FREE_SPACING_MS);

  const request = async (path, params) => {
    if (now() < pausedUntil) {
      throw new SportsDbError('rate_limited', 'paused after a refusal of TheSportsDB', 429);
    }
    const wait = lastRequest + spacing() - now();
    if (wait > 0) {
      await sleep(wait);
    }
    lastRequest = now();
    const query = new URLSearchParams(params).toString();
    const url = `${BASE_URL}/${encodeURIComponent(key || FREE_KEY)}/${path}?${query}`;
    const label = `${path}?${query}`;
    let response;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': userAgent },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new SportsDbError('network', `${label}: ${error.cause?.code ?? error.message}`);
    }
    const body = await response.text();
    if (response.status === 429 || /error code:\s*1015/i.test(body)) {
      pausedUntil = now() + PAUSE_MS;
      throw new SportsDbError('rate_limited', `${label}: too many requests`, 429);
    }
    if (/invalid premium api key/i.test(body) || response.status === 401) {
      throw new SportsDbError('invalid_key', `${label}: the API key is refused`, response.status);
    }
    if (!response.ok) {
      throw new SportsDbError('http', `${label}: HTTP ${response.status}`, response.status);
    }
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      throw new SportsDbError('invalid', `${label}: not JSON`, response.status);
    }
    if (!json || typeof json !== 'object' || !('events' in json)) {
      throw new SportsDbError('invalid', `${label}: no events field`, response.status);
    }
    return Array.isArray(json.events) ? json.events : [];
  };

  // One request at a time, whoever asks (the scan, a scene action).
  const queued = (path, params) => {
    const run = chain.then(() => request(path, params));
    chain = run.catch(() => {});
    return run;
  };

  return {
    /** @returns {boolean} Whether a premium key is set. */
    get premium() {
      return Boolean(key);
    },
    /** @returns {number} Shows answered at most per day with this key. */
    get dayLimit() {
      return key ? Infinity : FREE_DAY_LIMIT;
    },
    /** @returns {number} The end of the pause after a refusal, in ms (0 when none). */
    get pausedUntil() {
      return pausedUntil > now() ? pausedUntil : 0;
    },
    /** @param {string} value - The new key (configuration change). */
    setApiKey(value) {
      key = String(value ?? '').trim();
      pausedUntil = 0;
    },
    /**
     * @param {string} league - League id.
     * @param {string} date - UTC date `YYYY-MM-DD`.
     * @returns {Promise<object[]>} Raw events.
     */
    eventsOfDay: (league, date) => queued('eventsday.php', { d: date, l: league }),
    /**
     * @param {string} league - League id.
     * @param {string} season - "2026".
     * @returns {Promise<object[]>} Raw events.
     */
    eventsOfSeason: (league, season) => queued('eventsseason.php', { id: league, s: season }),
  };
}

/**
 * @param {number} ms - Delay.
 * @returns {Promise<void>} Resolved after the delay.
 */
function defaultSleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
}

export {
  BASE_URL,
  FREE_KEY,
  FREE_SPACING_MS,
  PREMIUM_SPACING_MS,
  PAUSE_MS,
  FREE_DAY_LIMIT,
  SportsDbError,
  createSportsDbClient,
};
