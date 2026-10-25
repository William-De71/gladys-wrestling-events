// The manifest against the code: the keys it declares are the ones the code
// handles, the store limits hold, the transport and permissions are right.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

import { LEADS, NEXT_SHOW_OUTPUTS, TRIGGERS } from '../src/events.js';
import { SCENE_ACTIONS } from '../src/app.js';
import { COUNTS, DEFAULT_COUNT, WIDGETS } from '../src/widgets.js';
import {
  AUTO_LANGUAGE,
  DEFAULT_HORIZON,
  HORIZONS,
  INTERNAL_KEYS,
  normalizeConfig,
} from '../src/config.js';
import { LANGUAGES } from '../src/i18n.js';
import { KINDS } from '../src/kinds.js';
import { DEFAULT_PROMOTIONS, PROMOTION_KEYS, PROMOTIONS } from '../src/promotions.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = read('../gladys-assistant-integration.json');
const pkg = read('../package.json');
const byKey = (list) => new Map(list.map((entry) => [entry.key, entry]));
const values = (field) => field.options.map((option) => option.value);
const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a calendar integration, in lockstep with package.json, at 0.x until 1.0.0 is decided', () => {
  assert.equal(manifest.type, 'calendar');
  assert.equal(manifest.name, 'Wrestling Events');
  assert.equal(manifest.version, pkg.version);
  assert.equal(
    manifest.docker_image,
    `ghcr.io/william-de71/gladys-wrestling-events:${pkg.version}`,
  );
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/William-De71/gladys-wrestling-events/main/cover.jpg',
  );
  assert.equal(pkg.license, 'Apache-2.0');
  assert.equal(pkg.name, 'gladys-wrestling-events');
  assert.deepEqual(Object.keys(pkg.dependencies), ['@gladysassistant/integration-sdk']);
});

test('declares the cloud transport only: the API of TheSportsDB', () => {
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.doesNotMatch(source('../src/app.js'), /publishTransports|GLADYS_PREFER_LOCAL/);
  assert.match(source('../src/sportsdb.js'), /'https:\/\/www\.thesportsdb\.com\/api\/v1\/json'/);
});

test('requires Gladys 5.3.0 (calendar integrations, catalog keywords); no permission, no device', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.deepEqual(manifest.categories, ['leisure']);
  for (const key of [
    'location',
    'network_wake',
    'containers',
    'network_discovery',
    'webhooks',
    'account_schema',
  ]) {
    assert.equal(manifest[key], undefined, key);
  }
  assert.doesNotMatch(source('../src/app.js'), /publishDiscoveredDevices|onSetValue|onPoll/);
});

test('declares exactly the scene triggers, actions and widgets the code handles', () => {
  assert.deepEqual(
    manifest.scene_triggers.map((trigger) => trigger.key).sort(),
    Object.values(TRIGGERS).sort(),
  );
  assert.deepEqual(
    manifest.scene_actions.map((action) => action.key).sort(),
    Object.values(SCENE_ACTIONS).sort(),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key).sort(),
    Object.values(WIDGETS).sort(),
  );
  const app = source('../src/app.js');
  for (const key of Object.keys(WIDGETS)) {
    assert.match(app, new RegExp(`onWidgetGet\\(WIDGETS\\.${key}`), key);
  }
  for (const key of Object.keys(SCENE_ACTIONS)) {
    assert.match(app, new RegExp(`onSceneAction\\(SCENE_ACTIONS\\.${key}`), key);
  }
  assert.equal(manifest.actions, undefined, 'no configuration button');
});

test('the configuration of the code: promotions, kinds, horizon, key, language', () => {
  const config = byKey(manifest.config_schema);
  const promotions = config.get('promotions');
  assert.equal(promotions.type, 'multi_select');
  assert.deepEqual(values(promotions), PROMOTION_KEYS);
  assert.deepEqual(promotions.default, DEFAULT_PROMOTIONS);
  const kinds = config.get('kinds');
  assert.equal(kinds.type, 'multi_select');
  assert.deepEqual(values(kinds), KINDS);
  assert.deepEqual(kinds.default, KINDS);
  const horizon = config.get('horizon_days');
  assert.deepEqual(values(horizon), HORIZONS.map(String));
  assert.equal(horizon.default, String(DEFAULT_HORIZON));
  assert.equal(config.get('api_key').type, 'secret');
  assert.notEqual(config.get('api_key').required, true, 'the free key works without one');
  assert.equal(config.get(INTERNAL_KEYS.language), undefined, 'internal key, never shown');
  for (const field of manifest.config_schema) {
    assert.ok(!['text', 'password'].includes(field.type), `${field.key}: ${field.type}`);
    assert.equal(field.display_if, undefined, field.key);
    if (field.placeholder) {
      assert.deepEqual(Object.keys(field.placeholder).sort(), [...LANGUAGES].sort(), field.key);
    }
  }
  // The defaults of the manifest are the defaults of the code.
  const defaults = normalizeConfig({});
  assert.deepEqual(defaults.promotions, promotions.default);
  assert.deepEqual(defaults.kinds, kinds.default);
  assert.equal(String(defaults.horizonDays), horizon.default);
});

test('every filter is a key of its event; the options are the keys of the code', () => {
  for (const trigger of manifest.scene_triggers) {
    const fields = byKey(trigger.fields);
    assert.deepEqual(values(fields.get('promotion')), PROMOTION_KEYS, trigger.key);
    assert.deepEqual(values(fields.get('kind')), KINDS, trigger.key);
    for (const key of fields.keys()) {
      assert.ok(
        byKey(trigger.variables).has(key) || key === 'lead',
        `${trigger.key}: the filter ${key} is a key of the event`,
      );
    }
  }
  const starting = byKey(byKey(manifest.scene_triggers).get(TRIGGERS.STARTING).fields);
  assert.deepEqual(values(starting.get('lead')), LEADS);
  const action = byKey(manifest.scene_actions).get(SCENE_ACTIONS.NEXT);
  assert.deepEqual(
    action.outputs.map((output) => output.key),
    NEXT_SHOW_OUTPUTS,
  );
  const upcoming = byKey(byKey(manifest.widgets).get(WIDGETS.UPCOMING).settings);
  assert.deepEqual(values(upcoming.get('count')), COUNTS.map(String));
  assert.equal(upcoming.get('count').default, String(DEFAULT_COUNT));
  for (const widget of manifest.widgets) {
    const settings = byKey(widget.settings);
    assert.deepEqual(values(settings.get('promotions')), PROMOTION_KEYS, widget.key);
    assert.deepEqual(values(settings.get('kinds')), KINDS, widget.key);
  }
});

test('promotions: unique keys and league ids, a hex color for each calendar', () => {
  assert.equal(new Set(PROMOTIONS.map((p) => p.key)).size, PROMOTIONS.length);
  assert.equal(new Set(PROMOTIONS.map((p) => p.league)).size, PROMOTIONS.length);
  for (const promotion of PROMOTIONS) {
    assert.match(promotion.key, /^[a-z0-9_]+$/);
    assert.match(promotion.league, /^\d+$/);
    assert.match(promotion.color, /^#[0-9a-f]{6}$/);
    assert.ok(promotion.name.length <= 16, 'a card badge holds 16 characters');
  }
});

test('limits of the store: counts, timeouts, sizes, no secret in widget settings', () => {
  assert.ok(manifest.widgets.length >= 1 && manifest.widgets.length <= 5);
  assert.ok(manifest.scene_triggers.length <= 20);
  assert.ok(manifest.scene_actions.length <= 20);
  for (const trigger of manifest.scene_triggers) {
    assert.ok((trigger.fields ?? []).length <= 10 && trigger.variables.length <= 20, trigger.key);
  }
  for (const action of manifest.scene_actions) {
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120, action.key);
    assert.ok(
      (action.fields ?? []).length <= 10 && (action.outputs ?? []).length <= 20,
      action.key,
    );
  }
  for (const widget of manifest.widgets) {
    assert.ok((widget.settings ?? []).length <= 10);
    for (const setting of widget.settings ?? []) {
      assert.ok(!['secret', 'oauth2', 'account_link'].includes(setting.type));
    }
  }
  const size = statSync(new URL('../gladys-assistant-integration.json', import.meta.url)).size;
  assert.ok(size < 100 * 1024, `${size} bytes`);
  const cover = readFileSync(new URL('../cover.jpg', import.meta.url));
  assert.ok(cover.length < 150 * 1024, `cover.jpg: ${cover.length} bytes`);
  assert.equal(cover.readUInt16BE(0), 0xffd8, 'cover.jpg is a JPEG');
});

test('offers the languages of the code, automatic by default', () => {
  const field = byKey(manifest.config_schema).get('language');
  assert.deepEqual(values(field), [AUTO_LANGUAGE, ...LANGUAGES]);
  assert.equal(field.default, AUTO_LANGUAGE);
});

test('catalog fields of Gladys 5.3: search keywords, available worldwide', () => {
  assert.equal(manifest.gladys_version, '>=5.3.0');
  assert.ok(Array.isArray(manifest.keywords), 'keywords');
  assert.ok(manifest.keywords.length >= 1 && manifest.keywords.length <= 10, '1 to 10 keywords');
  for (const keyword of manifest.keywords) {
    assert.ok(keyword.length <= 30 && keyword.trim().length >= 2, keyword);
  }
  const normalized = manifest.keywords.map((keyword) => keyword.trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, 'unique once trimmed and lowercased');
  assert.ok(!normalized.includes(manifest.name.toLowerCase()), 'the name is already searched');
  // No `countries`: usable anywhere, the catalog shows it in every country.
  assert.equal(manifest.countries, undefined);
});
