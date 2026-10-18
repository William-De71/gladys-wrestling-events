// -----------------------------------------------------------------------------
// Configuration of the integration.
//
// Fields of the config_schema:
//   - `promotions`    the followed promotions (multi_select, src/promotions.js);
//   - `kinds`         the kinds of shows kept (weekly TV, tour nights, big
//                     events: src/kinds.js) — the calendars, the widgets and
//                     the scenes only see these;
//   - `horizon_days`  how far ahead the program is read. With the free key one
//                     request is spent per promotion and day, so the free key
//                     stops at 30 days whatever is chosen;
//   - `api_key`       a premium key of TheSportsDB (secret, optional): whole
//                     seasons in one request, up to 90 days ahead;
//   - `language`      language of the texts Gladys does not ask for in a
//                     language (scene action outputs): `auto` follows the
//                     last widget request.
//
// Internal key, outside the config_schema (never shown in the UI):
//   - `last_language`   language of the last widget request.
// -----------------------------------------------------------------------------

import { isLanguage } from './i18n.js';
import { KINDS } from './kinds.js';
import { DEFAULT_PROMOTIONS, PROMOTION_KEYS } from './promotions.js';

const AUTO_LANGUAGE = 'auto';
const INTERNAL_KEYS = { language: 'last_language' };
const HORIZONS = [14, 30, 60, 90];
const DEFAULT_HORIZON = 30;
const FREE_MAX_HORIZON = 30;

/**
 * @description Read a list of keys.
 * @param {unknown} raw - An array (multi_select), a JSON array or "a, b".
 * @param {string[]} allowed - The known keys.
 * @param {string[]} fallback - The default when none is valid.
 * @returns {string[]} Known keys, in the order of `allowed`.
 * @example
 * readKeys(['aew', 'nope', 'wwe'], ['wwe', 'aew'], ['wwe']); // -> ['wwe', 'aew']
 */
function readKeys(raw, allowed, fallback) {
  let list = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = raw.split(/[,;\s]+/);
    }
  }
  const given = new Set((Array.isArray(list) ? list : []).map((value) => String(value).trim()));
  const keys = allowed.filter((key) => given.has(key));
  return keys.length ? keys : [...fallback];
}

/**
 * @description Normalize the raw config object from the host API.
 * @param {object} [rawConfig] - The raw config values.
 * @returns {object} `{ promotions, kinds, horizonDays, apiKey, language, lastLanguage }`.
 */
function normalizeConfig(rawConfig = {}) {
  const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const apiKey = typeof raw.api_key === 'string' ? raw.api_key.trim() : '';
  const horizon = HORIZONS.includes(Number(raw.horizon_days))
    ? Number(raw.horizon_days)
    : DEFAULT_HORIZON;
  const language = isLanguage(raw.language) ? raw.language : AUTO_LANGUAGE;
  const lastLanguage = isLanguage(raw[INTERNAL_KEYS.language]) ? raw[INTERNAL_KEYS.language] : 'en';
  return {
    promotions: readKeys(raw.promotions, PROMOTION_KEYS, DEFAULT_PROMOTIONS),
    kinds: readKeys(raw.kinds, KINDS, KINDS),
    horizonDays: apiKey ? horizon : Math.min(horizon, FREE_MAX_HORIZON),
    apiKey,
    language,
    lastLanguage,
  };
}

/**
 * @description The language of the texts no Gladys request gives one for.
 * @param {object} config - Normalized config.
 * @returns {string} en, fr, de or es.
 */
function textLanguage(config) {
  return config.language === AUTO_LANGUAGE ? config.lastLanguage : config.language;
}

export {
  AUTO_LANGUAGE,
  INTERNAL_KEYS,
  HORIZONS,
  DEFAULT_HORIZON,
  FREE_MAX_HORIZON,
  readKeys,
  normalizeConfig,
  textLanguage,
};
