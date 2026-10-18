// -----------------------------------------------------------------------------
// The images of the widgets: the thumbnail or poster of a show.
//
// The browser never loads a third-party URL: Gladys asks the integration for
// an image key (src/shows.js), the integration downloads the reduced copy
// TheSportsDB serves (`/medium` ~500 px for the `next_show` card, `/small`
// ~250 px for the list) and returns its base64. Checked before it goes out:
// a JPEG, PNG or WebP by its magic number, 300 KB at most. The last 40 images
// stay in memory (Gladys itself caches each key for an hour).
// -----------------------------------------------------------------------------

import { imageUrl } from './shows.js';

const MAX_BYTES = 300 * 1024;
const CACHE_SIZE = 40;
const TIMEOUT_MS = 15 * 1000;

/**
 * @description Whether some bytes are a JPEG, PNG or WebP image.
 * @param {Buffer} bytes - The bytes.
 * @returns {boolean} True for one of the three.
 */
function isImage(bytes) {
  if (bytes.length < 12) {
    return false;
  }
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp =
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP';
  return jpeg || png || webp;
}

/**
 * @description Create the image provider.
 * @param {object} [options] - `{ fetch, userAgent }`.
 * @returns {{ get: Function }} `get(key)` -> base64.
 */
function createImages({ fetch = globalThis.fetch, userAgent = 'gladys-wrestling-events' } = {}) {
  const cache = new Map();

  return {
    /**
     * @param {string} key - An image key of src/shows.js.
     * @returns {Promise<string>} The raw base64 of the image.
     */
    async get(key) {
      if (cache.has(key)) {
        const value = cache.get(key);
        cache.delete(key);
        cache.set(key, value);
        return value;
      }
      const url = imageUrl(key);
      if (!url) {
        throw new Error(`unknown image ${key}`);
      }
      const response = await fetch(url, {
        headers: { 'user-agent': userAgent },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(`image ${key}: HTTP ${response.status}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_BYTES || !isImage(bytes)) {
        throw new Error(`image ${key}: not a usable image (${bytes.length} bytes)`);
      }
      const value = bytes.toString('base64');
      cache.set(key, value);
      if (cache.size > CACHE_SIZE) {
        cache.delete(cache.keys().next().value);
      }
      return value;
    },
  };
}

export { MAX_BYTES, isImage, createImages };
