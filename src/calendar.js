// -----------------------------------------------------------------------------
// The shows in the Gladys calendar (manifest `type: "calendar"`).
//
// Every user who enabled the integration in "My calendars" gets one calendar
// per followed promotion ("Wrestling – WWE"), with one event per show: timed
// when TheSportsDB knows the time (an estimated end, src/shows.js), all-day
// otherwise. A window covers what is kept (7 days back, the horizon ahead): a
// show TheSportsDB drops disappears from Gladys too. The calendars are
// private when created: the user shares them with the household (and the
// scenes) from "My calendars".
//
// Limits of the core: 500 events per request (one promotion never has that
// many in 97 days), 30 calendar writes per minute per integration (writes are
// spaced by 2.1 s).
//
// External ids: ext:<selector>:<user>:promotion-<key>  (calendar)
//               ext:<selector>:<user>:show-<TheSportsDB id>  (event)
// -----------------------------------------------------------------------------

import { kindName, t, truncate } from './i18n.js';
import { promotionOf } from './promotions.js';
import { showDay, showEnd, showUrl } from './shows.js';
import { addDays } from './time.js';

export const HISTORY_DAYS = 7;
export const MAX_EVENTS_PER_REQUEST = 500;
export const WRITE_SPACING_MS = 2100;

/**
 * @description The external id of the calendar of a promotion for a user.
 * @param {object} gladys - SDK client.
 * @param {string} user - User selector.
 * @param {string} promotion - Promotion key.
 * @returns {string} The external id.
 */
export function calendarId(gladys, user, promotion) {
  return gladys.externalId(`${user}:promotion-${promotion}`);
}

/**
 * @description The promotion of one of our calendar external ids.
 * @param {object} gladys - SDK client.
 * @param {string} user - User selector.
 * @param {string} externalId - Calendar external id.
 * @returns {string|null} The promotion key.
 */
export function promotionOfCalendar(gladys, user, externalId) {
  const prefix = gladys.externalId(`${user}:promotion-`);
  return String(externalId).startsWith(prefix) ? String(externalId).slice(prefix.length) : null;
}

/**
 * @description The title of a show in a calendar or a list: the promotion in
 * front when the name does not already say it ("WWE – Crown Jewel", but
 * "AAA on FOX #38").
 * @param {object} show - A show.
 * @returns {string} The title.
 */
export function showTitle(show) {
  const promotion = promotionOf(show.promotion);
  if (!promotion || show.name.toLowerCase().includes(promotion.name.toLowerCase())) {
    return show.name;
  }
  return `${promotion.name} – ${show.name}`;
}

/**
 * @description Venue, city and country, as one line.
 * @param {object} show - A show.
 * @returns {string} "Pechanga Arena, San Diego, California, United States".
 */
export function showPlace(show) {
  return [show.venue, show.city, show.country].filter(Boolean).join(', ');
}

/**
 * @description The calendar event of a show.
 * @param {object} gladys - SDK client.
 * @param {string} user - User selector.
 * @param {object} show - A show.
 * @param {string} language - The user's language.
 * @returns {object} The event.
 */
export function buildEvent(gladys, user, show, language) {
  const name = show.postponed
    ? t('postponedName', language, { name: showTitle(show) })
    : showTitle(show);
  const description = [
    show.card,
    t('eventFooter', language, { kind: kindName(show.kind, language) }),
  ]
    .filter(Boolean)
    .join('\n\n');
  const event = {
    external_id: gladys.externalId(`${user}:show-${show.id}`),
    name: truncate(name, 200),
    description: truncate(description, 1000),
    url: showUrl(show),
  };
  const place = showPlace(show);
  if (place) {
    event.location = truncate(place, 500);
  }
  if (show.start === null) {
    return { ...event, start: show.localDate, end: addDays(show.localDate, 1), full_day: true };
  }
  return {
    ...event,
    start: new Date(show.start).toISOString(),
    end: new Date(showEnd(show)).toISOString(),
    full_day: false,
  };
}

/**
 * @description Create the calendar synchronizer.
 * @param {object} gladys - SDK client.
 * @param {object} options - Dependencies.
 * @param {Function} options.config - `() => normalized config`.
 * @param {Function} options.shows - `() => every show kept`.
 * @param {Function} options.ready - `(promotion) => boolean`: read at least once
 * (a promotion never read yet would publish an empty calendar).
 * @param {Function} options.today - `() => 'YYYY-MM-DD'`.
 * @param {string} [options.timeZone] - IANA timezone.
 * @param {Function} [options.sleep] - Delay between two writes.
 * @param {object} [options.logger] - SDK logger.
 * @returns {{ syncAll: Function, syncUser: Function, forget: Function }} The synchronizer.
 */
export function createCalendarSync(
  gladys,
  { config, shows, ready, today, timeZone, sleep = defaultSleep, logger },
) {
  // Last content pushed per calendar: an unchanged calendar is not pushed again.
  const pushed = new Map();
  let lastWrite = 0;
  let queue = Promise.resolve();

  const write = async (call) => {
    const wait = lastWrite + WRITE_SPACING_MS - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    lastWrite = Date.now();
    return call();
  };

  const syncAccount = async (account, { force = false } = {}) => {
    const user = account.user.selector;
    const language = account.user.language;
    const { promotions, kinds, horizonDays } = config();
    const followed = new Set(promotions);

    // Calendars of promotions no longer followed: deleted with their events.
    for (const calendar of await gladys.getCalendars(user)) {
      const promotion = promotionOfCalendar(gladys, user, calendar.external_id);
      if (promotion !== null && !followed.has(promotion)) {
        await write(() => gladys.deleteCalendar(calendar.external_id));
        pushed.delete(calendar.external_id);
      }
    }

    const calendars = promotions.map((key) => {
      const promotion = promotionOf(key);
      return {
        external_id: calendarId(gladys, user, key),
        name: truncate(t('calendarName', language, { promotion: promotion.name }), 100),
        description: truncate(t('calendarDescription', language, { full: promotion.full }), 500),
        color: promotion.color,
      };
    });
    const calendarsKey = JSON.stringify(calendars);
    if (force || pushed.get(`calendars:${user}`) !== calendarsKey) {
      await write(() => gladys.publishCalendars(user, calendars));
      pushed.set(`calendars:${user}`, calendarsKey);
    }

    const skipped = new Set(
      (await gladys.getCalendars(user)).filter((c) => !c.sync).map((c) => c.external_id),
    );
    const from = addDays(today(), -HISTORY_DAYS);
    const to = addDays(today(), horizonDays + 2);
    const all = shows();
    for (const key of promotions) {
      const id = calendarId(gladys, user, key);
      if (skipped.has(id) || !ready(key)) {
        continue;
      }
      const events = all
        .filter((show) => show.promotion === key && kinds.includes(show.kind))
        .filter((show) => {
          const day = showDay(show, timeZone);
          return day >= from && day < to;
        })
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, MAX_EVENTS_PER_REQUEST)
        .map((show) => buildEvent(gladys, user, show, language));
      const content = JSON.stringify([from, to, events]);
      if (!force && pushed.get(id) === content) {
        continue;
      }
      try {
        await write(() => gladys.publishCalendarEvents(id, events, { from, to }));
        pushed.set(id, content);
      } catch (error) {
        // The user turned the sync of this calendar off meanwhile.
        if (error?.status === 403) {
          logger?.info(`calendar ${key} of ${user} not synchronized: ${error.message}`);
          continue;
        }
        throw error;
      }
    }
  };

  const enqueue = (job) => {
    const result = queue.then(job);
    queue = result.catch((error) => logger?.warn(`calendar sync failed: ${error.message}`));
    return result;
  };

  return {
    /**
     * @param {object} [options] - `{ force }`: push even what did not change.
     * @returns {Promise<void>} Every enabled user synchronized.
     */
    syncAll: (options) =>
      enqueue(async () => {
        for (const account of await gladys.getCalendarAccounts()) {
          await syncAccount(account, options);
        }
      }),
    /**
     * @param {string} userSelector - The user whose account changed.
     * @returns {Promise<void>} That user synchronized (nothing if disabled).
     */
    syncUser: (userSelector) =>
      enqueue(async () => {
        const account = (await gladys.getCalendarAccounts()).find(
          (candidate) => candidate.user.selector === userSelector,
        );
        if (account) {
          await syncAccount(account, { force: true });
        } else {
          // Disabled: the core already deleted the calendars.
          for (const key of [...pushed.keys()]) {
            if (key.includes(`:${userSelector}:`) || key === `calendars:${userSelector}`) {
              pushed.delete(key);
            }
          }
        }
      }),
    /** Forget what was pushed (reconnection: the core may have changed meanwhile). */
    forget: () => pushed.clear(),
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
