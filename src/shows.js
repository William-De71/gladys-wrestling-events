// -----------------------------------------------------------------------------
// A show, as the integration keeps it.
//
// TheSportsDB events are turned into small plain objects (kept in /data,
// read by the calendar, the widgets and the scenes):
//   { id, promotion, name, kind, start, date, venue, city, country, card,
//     thumb, video, postponed }
// `start` is the UTC instant of the bell (ms) when TheSportsDB knows the
// time, null otherwise: a show at "00:00:00" UTC with no local time is a show
// whose time is unknown (it becomes an all-day event). `date` is the UTC day
// TheSportsDB files it under (the day the scan asks for); `localDate` the day
// at the venue, used for an all-day event.
// -----------------------------------------------------------------------------

import { kindOf } from './kinds.js';
import { promotionOfLeague } from './promotions.js';
import { localClock } from './time.js';

const MAX_CARD = 2000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const THUMB =
  /^https:\/\/r2\.thesportsdb\.com\/images\/media\/event\/(thumb|poster)\/([a-z0-9]+)\.(jpg|jpeg|png|webp)$/i;

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * @description The text of the card: one match per line, no blank lines.
 * @param {unknown} raw - `strDescriptionEN`.
 * @returns {string} The card, '' when none.
 */
function cleanCard(raw) {
  return clean(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_CARD);
}

/**
 * @description Turn an event of TheSportsDB into a show.
 * @param {object} raw - One item of `events`.
 * @returns {object|null} The show, null when it is not usable (no id, no
 * name, no date, not one of our promotions).
 */
function normalizeShow(raw) {
  const promotion = promotionOfLeague(raw?.idLeague);
  const id = clean(String(raw?.idEvent ?? ''));
  const name = clean(raw?.strEvent).replace(/\s+/g, ' ');
  const date = clean(raw?.dateEvent);
  if (!promotion || !/^\d+$/.test(id) || !name || !DATE.test(date)) {
    return null;
  }
  const timestamp = Date.parse(`${clean(raw.strTimestamp)}Z`);
  const midnight = /^00:00(:00)?$/.test(clean(raw.strTime));
  const timeKnown = Number.isFinite(timestamp) && !(midnight && !clean(raw.strTimeLocal));
  const localDate = DATE.test(clean(raw.dateEventLocal)) ? clean(raw.dateEventLocal) : date;
  const thumb = [clean(raw.strThumb), clean(raw.strPoster)].find((url) => THUMB.test(url)) ?? '';
  const video = /^https:\/\//.test(clean(raw.strVideo)) ? clean(raw.strVideo) : '';
  return {
    id,
    promotion: promotion.key,
    name,
    kind: kindOf(name),
    start: timeKnown ? timestamp : null,
    date,
    localDate,
    venue: clean(raw.strVenue),
    city: clean(raw.strCity),
    country: clean(raw.strCountry),
    card: cleanCard(raw.strDescriptionEN),
    thumb,
    video,
    postponed: clean(raw.strPostponed).toLowerCase() === 'yes',
  };
}

/**
 * @description The day of a show in the timezone of the instance (its local
 * date at the venue when the time is unknown).
 * @param {object} show - A show.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} `YYYY-MM-DD`.
 */
function showDay(show, timeZone) {
  return show.start === null ? show.localDate : localClock(show.start, timeZone).date;
}

/**
 * @description When a show is over, roughly: TheSportsDB has no end time. A
 * TV episode lasts 2 hours, a tour night 3, a big event 4.
 * @param {object} show - A show with a known start.
 * @returns {number} The end, in ms.
 */
function showEnd(show) {
  const hours = { weekly: 2, tour: 3, special: 4 }[show.kind] ?? 3;
  return show.start + hours * 3600 * 1000;
}

/**
 * @description Whether a show is still to come (or on now).
 * @param {object} show - A show.
 * @param {number} now - The instant, in ms.
 * @param {string} today - Today, `YYYY-MM-DD`, in the timezone of the instance.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {boolean} True when it is not over.
 */
function isUpcoming(show, now, today, timeZone) {
  if (show.start === null) {
    return showDay(show, timeZone) >= today;
  }
  return showEnd(show) > now;
}

/**
 * @description The followed shows still to come, the soonest first.
 * @param {object[]} shows - Shows.
 * @param {object} options - `{ now, today, timeZone, promotions, kinds }`
 * (empty or missing filters keep everything).
 * @returns {object[]} The shows.
 */
function upcomingShows(shows, { now, today, timeZone, promotions, kinds }) {
  return shows
    .filter((show) => !promotions?.length || promotions.includes(show.promotion))
    .filter((show) => !kinds?.length || kinds.includes(show.kind))
    .filter((show) => isUpcoming(show, now, today, timeZone))
    .sort((a, b) => sortKey(a, timeZone).localeCompare(sortKey(b, timeZone)));
}

/**
 * @param {object} show - A show.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} Sorts by day, then by start, then by name: a show whose
 * time is unknown comes after the timed ones of its day (it is most likely
 * an evening show, and a timed one is the better "next show").
 */
function sortKey(show, timeZone) {
  const start = show.start === null ? '9'.repeat(15) : String(show.start).padStart(15, '0');
  return `${showDay(show, timeZone)}|${start}|${show.name}`;
}

/**
 * @description The public page of a show on TheSportsDB.
 * @param {object} show - A show.
 * @returns {string} The URL.
 */
function showUrl(show) {
  return `https://www.thesportsdb.com/event/${show.id}`;
}

/**
 * @description The image of a show at a size TheSportsDB serves (`/medium`
 * ~500 px, `/small` ~250 px), as a stable widget image key and its URL.
 * @param {object} show - A show.
 * @param {'medium'|'small'} size - The size.
 * @returns {{ key: string, url: string }|null} Null when the show has none.
 */
function showImage(show, size) {
  const match = THUMB.exec(show.thumb ?? '');
  if (!match) {
    return null;
  }
  const [, folder, name, extension] = match;
  const key = `${folder[0]}-${name.toLowerCase()}-${extension.toLowerCase()}-${size[0]}`;
  return key.length <= 64 ? { key, url: imageUrl(key) } : null;
}

/**
 * @description The URL behind an image key of showImage (the key alone is
 * enough: Gladys may ask for an image after a restart of the integration).
 * @param {string} key - `t-<name>-<ext>-m`.
 * @returns {string|null} The URL, null for a key that is not ours.
 */
function imageUrl(key) {
  const match = /^([tp])-([a-z0-9]+)-(jpg|jpeg|png|webp)-([ms])$/.exec(String(key));
  if (!match) {
    return null;
  }
  const [, folder, name, extension, size] = match;
  return `https://r2.thesportsdb.com/images/media/event/${folder === 't' ? 'thumb' : 'poster'}/${name}.${extension}/${size === 'm' ? 'medium' : 'small'}`;
}

export {
  cleanCard,
  normalizeShow,
  showDay,
  showEnd,
  isUpcoming,
  upcomingShows,
  showUrl,
  showImage,
  imageUrl,
};
