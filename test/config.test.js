import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeConfig, readKeys, textLanguage } from '../src/config.js';

test('defaults: five promotions, every kind, 30 days, the free key, automatic language', () => {
  assert.deepEqual(normalizeConfig({}), {
    promotions: ['wwe', 'aew', 'njpw', 'tna', 'aaa'],
    kinds: ['weekly', 'tour', 'special'],
    horizonDays: 30,
    apiKey: '',
    language: 'auto',
    lastLanguage: 'en',
  });
  assert.deepEqual(normalizeConfig(null).promotions, ['wwe', 'aew', 'njpw', 'tna', 'aaa']);
});

test('the free key stops at 30 days; a premium key goes to 90', () => {
  assert.equal(normalizeConfig({ horizon_days: '90' }).horizonDays, 30);
  assert.equal(normalizeConfig({ horizon_days: '14' }).horizonDays, 14);
  assert.equal(normalizeConfig({ horizon_days: '90', api_key: ' k ' }).horizonDays, 90);
  assert.equal(normalizeConfig({ horizon_days: '90', api_key: ' k ' }).apiKey, 'k');
  assert.equal(normalizeConfig({ horizon_days: '45' }).horizonDays, 30);
});

test('lists: arrays, JSON or plain text, known keys only, in the order of the code', () => {
  const allowed = ['wwe', 'aew', 'njpw'];
  assert.deepEqual(readKeys(['njpw', 'nope', 'wwe', 'wwe'], allowed, []), ['wwe', 'njpw']);
  assert.deepEqual(readKeys('["aew"]', allowed, []), ['aew']);
  assert.deepEqual(readKeys('aew, njpw', allowed, []), ['aew', 'njpw']);
  assert.deepEqual(readKeys([], allowed, ['wwe']), ['wwe']);
  assert.deepEqual(normalizeConfig({ promotions: ['ajpw', 'stardom'] }).promotions, [
    'stardom',
    'ajpw',
  ]);
});

test('language of the scene texts: chosen, else the last dashboard one', () => {
  assert.equal(textLanguage(normalizeConfig({ language: 'de' })), 'de');
  assert.equal(textLanguage(normalizeConfig({ last_language: 'es' })), 'es');
  assert.equal(textLanguage(normalizeConfig({ language: 'it', last_language: 'fr' })), 'fr');
});
