// The HTTP client of TheSportsDB, against a fake fetch.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FREE_SPACING_MS, PAUSE_MS, createSportsDbClient } from '../src/sportsdb.js';
import { fakeClock } from './helpers.js';

/**
 * @param {Function} reply - `(url) => { status, body }`.
 * @returns {Function} A fetch recording its URLs.
 */
function fakeFetch(reply) {
  const urls = [];
  const fetch = async (url, options) => {
    urls.push({ url, options });
    const { status = 200, body = '{"events":null}' } = reply(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    };
  };
  fetch.urls = urls;
  return fetch;
}

test('the free key, one day of one league, an honest User-Agent', async () => {
  const fetch = fakeFetch(() => ({ body: '{"events":[{"idEvent":"1"}]}' }));
  const client = createSportsDbClient({ fetch, sleep: async () => {}, userAgent: 'gladys-test/1' });
  assert.equal(client.premium, false);
  assert.equal(client.dayLimit, 3);
  assert.deepEqual(await client.eventsOfDay('4444', '2026-10-20'), [{ idEvent: '1' }]);
  assert.equal(
    fetch.urls[0].url,
    'https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=2026-10-20&l=4444',
  );
  assert.equal(fetch.urls[0].options.headers['user-agent'], 'gladys-test/1');
});

test('a premium key goes in the path, a whole season at once; "events": null is an empty list', async () => {
  const fetch = fakeFetch(() => ({ body: '{"events":null}' }));
  const client = createSportsDbClient({ apiKey: ' abc123 ', fetch, sleep: async () => {} });
  assert.equal(client.premium, true);
  assert.deepEqual(await client.eventsOfSeason('4449', '2026'), []);
  assert.equal(
    fetch.urls[0].url,
    'https://www.thesportsdb.com/api/v1/json/abc123/eventsseason.php?id=4449&s=2026',
  );
});

test('requests are spaced: 7 seconds with the free key', async () => {
  const clock = fakeClock('2026-10-18T10:00:00Z');
  const waits = [];
  const client = createSportsDbClient({
    fetch: fakeFetch(() => ({})),
    now: clock.now,
    sleep: async (ms) => {
      waits.push(ms);
      clock.advance(ms);
    },
  });
  await Promise.all([
    client.eventsOfDay('4444', '2026-10-20'),
    client.eventsOfDay('4444', '2026-10-21'),
    client.eventsOfDay('4444', '2026-10-22'),
  ]);
  assert.deepEqual(waits, [FREE_SPACING_MS, FREE_SPACING_MS]);
});

test('the Cloudflare refusal (error code: 1015) pauses every request for 15 minutes', async () => {
  const clock = fakeClock('2026-10-18T10:00:00Z');
  let calls = 0;
  const client = createSportsDbClient({
    fetch: fakeFetch(() => {
      calls += 1;
      return { status: 200, body: 'error code: 1015' };
    }),
    now: clock.now,
    sleep: async () => {},
  });
  await assert.rejects(client.eventsOfDay('4444', '2026-10-20'), { kind: 'rate_limited' });
  assert.equal(client.pausedUntil, clock.now() + PAUSE_MS);
  await assert.rejects(client.eventsOfDay('4444', '2026-10-21'), { kind: 'rate_limited' });
  assert.equal(calls, 1, 'nothing sent during the pause');
  clock.advance(PAUSE_MS);
  assert.equal(client.pausedUntil, 0);
});

test('a refused key, an HTTP error and a broken answer, the key never in the message', async () => {
  const answers = [
    { status: 400, body: '{"Message":"Invalid Premium API key: Signup here"}' },
    { status: 503, body: 'down' },
    { status: 200, body: '<html>' },
    { status: 200, body: '{"leagues":[]}' },
  ];
  const client = createSportsDbClient({
    apiKey: 'secret-key-42',
    fetch: fakeFetch(() => answers.shift()),
    sleep: async () => {},
  });
  for (const kind of ['invalid_key', 'http', 'invalid', 'invalid']) {
    await assert.rejects(client.eventsOfDay('4444', '2026-10-20'), (error) => {
      assert.equal(error.kind, kind);
      assert.doesNotMatch(error.message, /secret-key-42/);
      return true;
    });
  }
});

test('a network failure is a network error', async () => {
  const client = createSportsDbClient({
    fetch: async () => {
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    },
    sleep: async () => {},
  });
  await assert.rejects(client.eventsOfDay('4444', '2026-10-20'), {
    kind: 'network',
    message: /ENOTFOUND/,
  });
});
