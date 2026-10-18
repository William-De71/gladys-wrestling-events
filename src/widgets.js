// -----------------------------------------------------------------------------
// Dashboard widgets (pure: also used by docs/illustrations/gen.mjs).
//
//   - `upcoming`   the next shows of the followed promotions, as a list of
//                  cards (date, time, venue, promotion badge, thumbnail); a
//                  card opens the match card and the links;
//   - `next_show`  the next show: countdown, time, kind, poster, place and
//                  card.
// Settings of both: `promotions` and `kinds` (empty: every followed one), and
// `count` for `upcoming`. Every text is multi-language: Gladys caches the
// content per language. Images are served by onWidgetGetImage (src/images.js)
// under the keys of src/shows.js.
// -----------------------------------------------------------------------------

import { showPlace, showTitle } from './calendar.js';
import { readKeys } from './config.js';
import { LANGUAGES, all, kindName, t, truncate } from './i18n.js';
import { KINDS } from './kinds.js';
import { PROMOTION_KEYS, promotionOf } from './promotions.js';
import { showDay, showImage, showUrl, upcomingShows } from './shows.js';
import { MINUTE_MS, dayMonth, daysBetween, formatTime, shortDate } from './time.js';

const WIDGETS = { UPCOMING: 'upcoming', NEXT: 'next_show' };
const COUNTS = [3, 5, 8];
const DEFAULT_COUNT = 5;
const KIND_COLORS = { weekly: 'primary', tour: 'info', special: 'danger' };
// How long Gladys caches a content: the list moves with the scan, the
// countdown every minute.
const TTL_SECONDS = { upcoming: 300, next_show: 60 };

/** @returns {object} A text in the four languages, built per language. */
const each = (build) =>
  Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));

/**
 * @description The promotions and kinds a widget instance shows.
 * @param {object} settings - The widget settings.
 * @param {object} config - Normalized config.
 * @returns {{ promotions: string[], kinds: string[] }} Within what is followed.
 */
function widgetFilters(settings, config) {
  const promotions = readKeys(settings?.promotions, PROMOTION_KEYS, []).filter((key) =>
    config.promotions.includes(key),
  );
  const kinds = readKeys(settings?.kinds, KINDS, []).filter((kind) => config.kinds.includes(kind));
  return {
    promotions: promotions.length ? promotions : config.promotions,
    kinds: kinds.length ? kinds : config.kinds,
  };
}

/**
 * @description "Mon 19 Oct · 02:00".
 * @param {object} show - A show.
 * @param {string} language - The language.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} The day and time.
 */
function when(show, language, timeZone) {
  const day = shortDate(showDay(show, timeZone), language);
  return show.start === null ? day : `${day} · ${formatTime(show.start, timeZone)}`;
}

/**
 * @description "2 d 4 h", "35 min", "on now"; "today", "tomorrow", "12 days"
 * for a show whose time is unknown.
 * @param {object} show - A show.
 * @param {number} now - The instant, in ms.
 * @param {string} language - The language.
 * @param {string} today - `YYYY-MM-DD`.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {string} At most 12 characters.
 */
function countdown(show, now, language, today, timeZone) {
  if (show.start === null) {
    const days = daysBetween(today, showDay(show, timeZone));
    if (days <= 0) {
      return t('today', language);
    }
    return days === 1 ? t('tomorrow', language) : t('inDays', language, { days });
  }
  const minutes = Math.round((show.start - now) / MINUTE_MS);
  if (minutes <= 0) {
    return t('onNow', language);
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) {
    return t('inDaysHours', language, { days, hours });
  }
  if (hours > 0) {
    return t('inHoursMinutes', language, { hours, minutes: minutes % 60 });
  }
  return t('inMinutes', language, { minutes });
}

/** The caption under the title: the source and the last reading. */
const sourceCaption = (fetchedAt, timeZone) =>
  fetchedAt
    ? all('sourceCaption', { time: formatTime(fetchedAt, timeZone) })
    : all('sourceCaptionNever');

/**
 * @description The empty state, when nothing is to come.
 * @param {object} data - `{ ready, config }`.
 * @returns {object[]} The components.
 */
function emptyState({ ready, config }) {
  return [
    {
      type: 'text',
      variant: 'body',
      text: ready ? all('noShow', { days: config.horizonDays }) : all('readingProgram'),
    },
  ];
}

/**
 * @description The `upcoming` widget.
 * @param {object} data - `{ shows, now, today, timeZone, config, ready, fetchedAt, settings }`.
 * @returns {object} The widget content.
 */
function buildUpcomingWidget({
  shows,
  now,
  today,
  timeZone,
  config,
  ready,
  fetchedAt,
  settings = {},
}) {
  const count = COUNTS.includes(Number(settings.count)) ? Number(settings.count) : DEFAULT_COUNT;
  const filters = widgetFilters(settings, config);
  const list = upcomingShows(shows, { now, today, timeZone, ...filters }).slice(0, count);
  const caption = { type: 'text', variant: 'caption', text: sourceCaption(fetchedAt, timeZone) };
  if (list.length === 0) {
    return {
      ttl_seconds: TTL_SECONDS.upcoming,
      components: [caption, ...emptyState({ ready, config })],
    };
  }
  return {
    ttl_seconds: TTL_SECONDS.upcoming,
    components: [
      caption,
      {
        type: 'card-list',
        display: 'list',
        items: list.map((show) => cardItem(show, timeZone)),
      },
    ],
  };
}

/**
 * @description One card of the `upcoming` list.
 * @param {object} show - A show.
 * @param {string} [timeZone] - IANA timezone.
 * @returns {object} The card-list item.
 */
function cardItem(show, timeZone) {
  const promotion = promotionOf(show.promotion);
  const place = [show.venue, show.city].filter(Boolean).join(', ');
  const item = {
    title: truncate(showTitle(show), 60),
    // A list shows the date OR the subtitle: the time goes in the subtitle,
    // 60 characters at most (the core cuts longer ones).
    subtitle: each((language) =>
      truncate([when(show, language, timeZone), place].filter(Boolean).join(' · '), 60),
    ),
    badge: { text: truncate(promotion?.name ?? show.promotion, 16), color: KIND_COLORS[show.kind] },
    description: each((language) =>
      truncate(
        [
          show.postponed ? t('postponed', language) : '',
          kindName(show.kind, language),
          showPlace(show),
          show.card ? `${t('cardHeading', language)}\n${show.card}` : t('cardUnknown', language),
        ]
          .filter(Boolean)
          .join('\n\n'),
        2000,
      ),
    ),
    links: [{ url: showUrl(show), label: all('linkSportsDb') }],
  };
  const image = showImage(show, 'small');
  if (image) {
    item.image = image.key;
  }
  if (show.video) {
    item.links.push({ url: show.video, label: all('linkVideo') });
  }
  return item;
}

/**
 * @description The `next_show` widget.
 * @param {object} data - `{ shows, now, today, timeZone, config, ready, fetchedAt, settings }`.
 * @returns {object} The widget content.
 */
function buildNextShowWidget({
  shows,
  now,
  today,
  timeZone,
  config,
  ready,
  fetchedAt,
  settings = {},
}) {
  const filters = widgetFilters(settings, config);
  const [show] = upcomingShows(shows, { now, today, timeZone, ...filters });
  if (!show) {
    return {
      ttl_seconds: TTL_SECONDS.next_show,
      components: [
        { type: 'text', variant: 'caption', text: sourceCaption(fetchedAt, timeZone) },
        ...emptyState({ ready, config }),
      ],
    };
  }
  const promotion = promotionOf(show.promotion);
  const matches = show.card ? show.card.split('\n').length : 0;
  const components = [
    { type: 'text', variant: 'heading', text: truncate(showTitle(show), 40) },
    {
      type: 'value',
      value: each((language) => truncate(countdown(show, now, language, today, timeZone), 12)),
      label: all('tileStarts'),
      icon: 'clock',
      color: show.start !== null && show.start <= now ? 'danger' : 'primary',
    },
    {
      type: 'value',
      value: each((language) => truncate(dayMonth(showDay(show, timeZone), language), 12)),
      label:
        show.start === null
          ? all('tileDay')
          : all('tileAt', { time: formatTime(show.start, timeZone) }),
      icon: 'calendar',
    },
    {
      type: 'value',
      value: matches,
      label: all('tileMatches'),
      icon: 'list',
    },
  ];
  const image = showImage(show, 'medium');
  if (image) {
    components.push({
      type: 'image',
      key: image.key,
      alt: truncate(showTitle(show), 100),
      fit: 'cover',
    });
  }
  const status = [
    {
      label: all('statusPromotion'),
      value: truncate(promotion?.name ?? show.promotion, 40),
      color: 'primary',
    },
    {
      label: all('statusKind'),
      value: each((language) => kindName(show.kind, language)),
      color: KIND_COLORS[show.kind],
    },
  ];
  if (show.venue || show.city) {
    status.push({
      label: all('statusVenue'),
      value: truncate(show.venue || show.city, 40),
      color: 'neutral',
    });
  }
  if (show.city && show.venue) {
    status.push({ label: all('statusCity'), value: truncate(show.city, 40), color: 'neutral' });
  }
  if (show.postponed) {
    status.push({ label: all('statusState'), value: all('postponed'), color: 'warning' });
  }
  components.push({ type: 'status', items: status });
  components.push({
    type: 'text',
    variant: 'body',
    text: show.card
      ? each((language) => truncate(`${t('cardHeading', language)}\n${show.card}`, 300))
      : all('cardUnknown'),
  });
  components.push({
    type: 'button',
    label: all('buttonDetails'),
    icon: 'external-link',
    style: 'secondary',
    link: { url: showUrl(show) },
  });
  return { ttl_seconds: TTL_SECONDS.next_show, components };
}

export {
  WIDGETS,
  COUNTS,
  DEFAULT_COUNT,
  KIND_COLORS,
  widgetFilters,
  countdown,
  buildUpcomingWidget,
  buildNextShowWidget,
};
