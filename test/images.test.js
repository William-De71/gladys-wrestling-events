// The widget images (src/images.js), against a fake fetch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetImage } from '@gladysassistant/integration-sdk';

import { createImages, isImage, MAX_BYTES } from '../src/images.js';

// A real 1 × 1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const fakeFetch = (bytes, status = 200) => {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    return {
      ok: status === 200,
      status,
      arrayBuffer: async () =>
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    };
  };
  fetch.urls = urls;
  return fetch;
};

test('a key becomes the reduced image of TheSportsDB, checked, then kept in memory', async () => {
  const fetch = fakeFetch(PNG);
  const images = createImages({ fetch });
  const value = await images.get('t-abc123-png-m');
  assert.equal(
    fetch.urls[0],
    'https://r2.thesportsdb.com/images/media/event/thumb/abc123.png/medium',
  );
  assert.equal(value, PNG.toString('base64'));
  assert.deepEqual(validateWidgetImage(value), [], 'what the core accepts');
  await images.get('t-abc123-png-m');
  assert.equal(fetch.urls.length, 1, 'from memory');
});

test('an unknown key, an HTTP error, a page that is not an image or too heavy are refused', async () => {
  await assert.rejects(createImages({ fetch: fakeFetch(PNG) }).get('../../x'), /unknown image/);
  await assert.rejects(createImages({ fetch: fakeFetch(PNG, 404) }).get('t-a-jpg-s'), /HTTP 404/);
  await assert.rejects(
    createImages({ fetch: fakeFetch(Buffer.from('<html>not an image</html>')) }).get('t-a-jpg-s'),
    /not a usable image/,
  );
  const heavy = Buffer.concat([PNG, Buffer.alloc(MAX_BYTES)]);
  await assert.rejects(createImages({ fetch: fakeFetch(heavy) }).get('t-a-png-m'), /not a usable/);
  assert.equal(isImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), true);
});
