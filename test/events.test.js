// Scene triggers and the outputs of the scene action (src/events.js).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { normalizeConfig } from '../src/config.js';
import {
  changeEvents,
  dueReminders,
  LEADS,
  NEXT_SHOW_OUTPUTS,
  nextShowOutputs,
  TRIGGERS,
} from '../src/events.js';
import { normalizeShow } from '../src/shows.js';
import { rawEvent, TZ } from './helpers.js';

const MANIFEST = JSON.parse(
  readFileSync(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const CONFIG = normalizeConfig({ promotions: ['wwe', 'njpw'] });
const RAW = normalizeShow(rawEvent()); // 2026-10-20T00:00Z, 02:00 in Paris

/** The payload limits of the core: flat, ≤ 30 keys, scalars, strings ≤ 1000. */
function assertPayload(data) {
  assert.ok(Object.keys(data).length <= 30);
  for (const [key, value] of Object.entries(data)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof value) || value === null, key);
    if (typeof value === 'string') {
      assert.ok(value.length <= 1000, key);
    }
    if (typeof value === 'number') {
      assert.ok(Number.isFinite(value), key);
    }
  }
}

/** Every filter field and variable of a trigger is in its data. */
function assertDeclared(trigger, data) {
  const declaration = MANIFEST.scene_triggers.find((entry) => entry.key === trigger);
  assert.ok(declaration, trigger);
  for (const variable of declaration.variables) {
    assert.ok(variable.key in data, `${trigger}: variable ${variable.key}`);
    assert.equal(typeof data[variable.key], variable.type, `${trigger}: ${variable.key}`);
  }
  for (const field of declaration.fields) {
    assert.ok(field.key in data, `${trigger}: field ${field.key}`);
    if (field.options) {
      assert.ok(
        field.options.some((option) => option.value === data[field.key]),
        `${trigger}: ${field.key}=${data[field.key]}`,
      );
    }
  }
}

test('reminders: every lead once, within 10 minutes, with the declared data', () => {
  const fired = new Set();
  const at = (iso) =>
    dueReminders({
      shows: [RAW],
      now: Date.parse(iso),
      config: CONFIG,
      wasFired: (key) => fired.has(key),
      timeZone: TZ,
    });
  assert.deepEqual(at('2026-10-19T21:59:00Z'), []);
  const [twoHours] = at('2026-10-19T22:00:00Z');
  assert.equal(twoHours.trigger, TRIGGERS.STARTING);
  assert.equal(twoHours.data.lead, '120');
  assert.equal(twoHours.data.lead_minutes, 120);
  assert.equal(twoHours.data.time, '02:00');
  assert.equal(twoHours.data.date, '2026-10-20');
  assert.equal(twoHours.data.title, 'WWE – RAW #1743');
  assertPayload(twoHours.data);
  assertDeclared(TRIGGERS.STARTING, twoHours.data);
  fired.add(twoHours.key);
  assert.deepEqual(at('2026-10-19T22:05:00Z'), [], 'once');
  assert.deepEqual(at('2026-10-19T23:10:00Z'), [], 'the one-hour lead is 10 minutes late');
  assert.deepEqual(
    at('2026-10-20T00:00:30Z').map((event) => event.data.lead),
    ['0'],
  );
  assert.deepEqual(LEADS, ['0', '15', '30', '60', '120']);
});

test('no reminder for an unknown time, a postponed show, or what is not followed', () => {
  const unknown = normalizeShow(rawEvent({ strTimeLocal: '' }));
  const postponed = normalizeShow(rawEvent({ idEvent: '2', strPostponed: 'yes' }));
  const aew = normalizeShow(rawEvent({ idEvent: '3', idLeague: '4563' }));
  const weeklyOff = normalizeConfig({ promotions: ['wwe'], kinds: ['special'] });
  const now = Date.parse('2026-10-20T00:00:00Z');
  assert.deepEqual(
    dueReminders({ shows: [unknown, postponed, aew], now, config: CONFIG, wasFired: () => false }),
    [],
  );
  assert.deepEqual(
    dueReminders({ shows: [RAW], now, config: weeklyOff, wasFired: () => false }),
    [],
  );
});

test('announced: a show added to a day already read, never on a first reading', () => {
  const options = {
    config: CONFIG,
    now: Date.parse('2026-10-18T10:00:00Z'),
    today: '2026-10-18',
    timeZone: TZ,
  };
  assert.deepEqual(
    changeEvents({ added: [RAW], updated: [], removed: [], firstRead: true }, options),
    [],
  );
  const [event] = changeEvents(
    { added: [RAW], updated: [], removed: [], firstRead: false },
    options,
  );
  assert.equal(event.trigger, TRIGGERS.ANNOUNCED);
  assertPayload(event.data);
  assertDeclared(TRIGGERS.ANNOUNCED, event.data);
  // A show already over is not news.
  const past = { ...options, now: Date.parse('2026-10-21T10:00:00Z'), today: '2026-10-21' };
  assert.deepEqual(
    changeEvents({ added: [RAW], updated: [], removed: [], firstRead: false }, past),
    [],
  );
});

test('card updated: only the new matches, only for a show to come', () => {
  const options = {
    config: CONFIG,
    now: Date.parse('2026-10-18T10:00:00Z'),
    today: '2026-10-18',
    timeZone: TZ,
  };
  const after = { ...RAW, card: `${RAW.card}\nTag Team Match\nThe Usos vs. The Judgment Day` };
  const [event] = changeEvents(
    { added: [], updated: [{ before: RAW, after }], removed: [] },
    options,
  );
  assert.equal(event.trigger, TRIGGERS.CARD);
  assert.equal(event.data.new_matches, 'Tag Team Match\nThe Usos vs. The Judgment Day');
  assert.equal(event.data.new_match_count, 2);
  assertPayload(event.data);
  assertDeclared(TRIGGERS.CARD, event.data);
  // A match removed, a venue changed: nothing new on the card.
  const shorter = { ...RAW, card: 'Singles Match', venue: 'Elsewhere' };
  assert.deepEqual(
    changeEvents({ added: [], updated: [{ before: RAW, after: shorter }], removed: [] }, options),
    [],
  );
});

test('the next show: exactly the declared outputs, a sentence in the chosen language', () => {
  const declared = MANIFEST.scene_actions.find((action) => action.key === 'get_next_show');
  assert.deepEqual(
    declared.outputs.map((output) => output.key),
    NEXT_SHOW_OUTPUTS,
  );
  const now = Date.parse('2026-10-19T22:00:00Z');
  const outputs = nextShowOutputs(RAW, { now, language: 'fr', timeZone: TZ });
  assert.deepEqual(Object.keys(outputs), NEXT_SHOW_OUTPUTS);
  for (const output of declared.outputs) {
    assert.equal(typeof outputs[output.key], output.type, output.key);
  }
  assert.equal(outputs.minutes_until, 120);
  assert.equal(outputs.kind, 'Émission hebdo');
  assert.equal(
    outputs.text,
    'Prochain show : WWE – RAW #1743, mardi 20 octobre à 02:00, Pechanga Arena, San Diego, California, United States.',
  );
  const none = nextShowOutputs(null, { now, language: 'en', timeZone: TZ });
  assert.deepEqual(Object.keys(none), NEXT_SHOW_OUTPUTS);
  assert.equal(none.found, false);
  assert.equal(none.text, 'No show planned.');
});
