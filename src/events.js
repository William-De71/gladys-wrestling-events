// -----------------------------------------------------------------------------
// Scene triggers and scene action outputs.
//
// Triggers (one event per transition, never a periodic snapshot):
//   - `show_starting`   a followed show starts in `lead` minutes (0, 15, 30,
//                       60 or 120), once per show and lead, only when its time
//                       is known; 10 minutes late at most (a restart in the
//                       meantime), never for a postponed show;
//   - `show_announced`  a show appeared on a day already read (newly added to
//                       TheSportsDB, not merely seen for the first time);
//   - `card_updated`    matches were added to the card of a show to come.
// Filters (equality / membership): `promotion`, `kind`, and `lead` for
// `show_starting`. The data is flat and scalar, texts in English (the
// promotion and kind keys, the names as TheSportsDB writes them).
//
// No event ever follows a scene action (they only read).
// -----------------------------------------------------------------------------

import { showPlace, showTitle } from './calendar.js';
import { kindName, t, truncate } from './i18n.js';
import { promotionOf } from './promotions.js';
import { isUpcoming, showDay, showUrl } from './shows.js';
import { MINUTE_MS, DAY_MS, formatTime, longDate } from './time.js';

const TRIGGERS = {
  STARTING: 'show_starting',
  ANNOUNCED: 'show_announced',
  CARD: 'card_updated',
};

const LEADS = ['0', '15', '30', '60', '120'];
const LATE_MS = 10 * MINUTE_MS;

const NEXT_SHOW_OUTPUTS = [
  'found',
  'title',
  'name',
  'promotion',
  'kind',
  'date',
  'time',
  'place',
  'minutes_until',
  'card',
  'url',
  'text',
];

/**
 * @description The data of a show, as the scenes see it.
 * @param {object} show - A show.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {object} Flat, scalar data.
 */
function showData(show, timeZone) {
  const promotion = promotionOf(show.promotion);
  return {
    show_id: show.id,
    title: truncate(showTitle(show), 200),
    name: truncate(show.name, 200),
    promotion: show.promotion,
    promotion_name: promotion?.name ?? show.promotion,
    kind: show.kind,
    date: showDay(show, timeZone),
    time: show.start === null ? '' : formatTime(show.start, timeZone),
    venue: truncate(show.venue, 200),
    city: truncate(show.city, 200),
    country: truncate(show.country, 200),
    place: truncate(showPlace(show), 500),
    card: truncate(show.card, 1000),
    url: showUrl(show),
  };
}

const followed = (show, config) =>
  config.promotions.includes(show.promotion) && config.kinds.includes(show.kind);

/**
 * @description The reminders due now.
 * @param {object} options - `{ shows, now, config, wasFired, timeZone }`.
 * @returns {object[]} `{ key, until, trigger, data }`.
 */
function dueReminders({ shows, now, config, wasFired, timeZone }) {
  const due = [];
  for (const show of shows) {
    if (show.start === null || show.postponed || !followed(show, config)) {
      continue;
    }
    for (const lead of LEADS) {
      const at = show.start - Number(lead) * MINUTE_MS;
      const key = `${show.id}|${lead}`;
      if (now >= at && now < at + LATE_MS && !wasFired(key)) {
        due.push({
          key,
          until: show.start + DAY_MS,
          trigger: TRIGGERS.STARTING,
          data: { ...showData(show, timeZone), lead, lead_minutes: Number(lead) },
        });
      }
    }
  }
  return due;
}

/**
 * @description The events of the changes an answer of TheSportsDB brought.
 * @param {object} changes - From the scanner: `{ added, updated, firstRead }`.
 * @param {object} options - `{ config, now, today, timeZone }`.
 * @returns {object[]} `{ trigger, data }`.
 */
function changeEvents(changes, { config, now, today, timeZone }) {
  const events = [];
  const keep = (show) => followed(show, config) && isUpcoming(show, now, today, timeZone);
  if (!changes.firstRead) {
    for (const show of changes.added.filter(keep)) {
      events.push({ trigger: TRIGGERS.ANNOUNCED, data: showData(show, timeZone) });
    }
  }
  for (const { before, after } of changes.updated) {
    if (!keep(after) || before.card === after.card) {
      continue;
    }
    const known = new Set(before.card.split('\n'));
    const added = after.card.split('\n').filter((line) => line && !known.has(line));
    if (added.length > 0) {
      events.push({
        trigger: TRIGGERS.CARD,
        data: {
          ...showData(after, timeZone),
          new_matches: truncate(added.join('\n'), 1000),
          new_match_count: added.length,
        },
      });
    }
  }
  return events;
}

/**
 * @description The outputs of the `get_next_show` scene action.
 * @param {object|null} show - The next show, null when none.
 * @param {object} options - `{ now, language, timeZone }`.
 * @returns {object} Exactly the declared outputs.
 */
function nextShowOutputs(show, { now, language, timeZone }) {
  if (!show) {
    return {
      found: false,
      title: '',
      name: '',
      promotion: '',
      kind: '',
      date: '',
      time: '',
      place: '',
      minutes_until: -1,
      card: '',
      url: '',
      text: t('nextShowNone', language),
    };
  }
  const data = showData(show, timeZone);
  const minutes =
    show.start === null ? -1 : Math.max(0, Math.round((show.start - now) / MINUTE_MS));
  const when = data.time
    ? t('atTime', language, { date: longDate(data.date, language), time: data.time })
    : longDate(data.date, language);
  return {
    found: true,
    title: data.title,
    name: data.name,
    promotion: data.promotion_name,
    kind: kindName(show.kind, language),
    date: data.date,
    time: data.time,
    place: data.place,
    minutes_until: minutes,
    card: data.card,
    url: data.url,
    text: truncate(
      t(data.place ? 'nextShowText' : 'nextShowTextNoPlace', language, {
        title: data.title,
        when,
        place: data.place,
      }),
      1000,
    ),
  };
}

export {
  TRIGGERS,
  LEADS,
  LATE_MS,
  NEXT_SHOW_OUTPUTS,
  showData,
  dueReminders,
  changeEvents,
  nextShowOutputs,
};
