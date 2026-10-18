// -----------------------------------------------------------------------------
// Dates and times.
//
// TheSportsDB dates a show twice: `strTimestamp` / `dateEvent` in UTC, and
// `dateEventLocal` / `strTimeLocal` at the venue. The integration works in
// UTC instants and shows them in the timezone of the Gladys instance, which
// the supervisor injects as TZ. Calendar dates are `YYYY-MM-DD` strings.
// -----------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/**
 * @description The timezone of the instance.
 * @returns {string|undefined} An IANA name, undefined for the system one.
 */
function defaultTimeZone() {
  return process.env.TZ || undefined;
}

/**
 * @description The local date and time of an instant in a timezone.
 * @param {number} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {{ date: string, minutes: number }} `YYYY-MM-DD` and minutes since midnight.
 * @example
 * localClock(Date.parse('2026-10-20T00:00:00Z'), 'Europe/Paris'); // 2026-10-20, 120
 */
function localClock(instant, timeZone = defaultTimeZone()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/**
 * @description "02:00", in the timezone of the instance.
 * @param {number|null} instant - The instant, in ms.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The time, '' when none.
 */
function formatTime(instant, timeZone = defaultTimeZone()) {
  if (!Number.isFinite(instant)) {
    return '';
  }
  const { minutes } = localClock(instant, timeZone);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * @description A calendar date moved by some days.
 * @param {string} date - `YYYY-MM-DD`.
 * @param {number} days - Days to add (negative to go back).
 * @returns {string} `YYYY-MM-DD`.
 * @example
 * addDays('2026-10-31', 1); // -> '2026-11-01'
 */
function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * @description Days from one date to another.
 * @param {string} from - `YYYY-MM-DD`.
 * @param {string} to - `YYYY-MM-DD`.
 * @returns {number|null} Whole days (negative when `to` is before), null when
 * a date is missing.
 */
function daysBetween(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / DAY_MS) : null;
}

/**
 * @description "Mon 19 Oct", in a language (a calendar date, no timezone).
 * @param {string} date - `YYYY-MM-DD`.
 * @param {string} language - en, fr, de or es.
 * @returns {string} The short date, '' when none.
 */
function shortDate(date, language) {
  const instant = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(instant)) {
    return '';
  }
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(instant))
    .replace(/\.(?=\s|$)/g, '')
    .replace(',', '');
}

/**
 * @description "20 Oct", in a language (a calendar date, no timezone).
 * @param {string} date - `YYYY-MM-DD`.
 * @param {string} language - en, fr, de or es.
 * @returns {string} The day and month, '' when none.
 */
function dayMonth(date, language) {
  const instant = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(instant)) {
    return '';
  }
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(instant))
    .replace(/\./g, '');
}

/**
 * @description "Monday 19 October", in a language (a calendar date, no timezone).
 * @param {string} date - `YYYY-MM-DD`.
 * @param {string} language - en, fr, de or es.
 * @returns {string} The long date, '' when none.
 */
function longDate(date, language) {
  const instant = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(instant)) {
    return '';
  }
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
    .format(new Date(instant))
    .replace(',', '');
}

export {
  MINUTE_MS,
  HOUR_MS,
  DAY_MS,
  defaultTimeZone,
  localClock,
  formatTime,
  addDays,
  daysBetween,
  shortDate,
  dayMonth,
  longDate,
};
