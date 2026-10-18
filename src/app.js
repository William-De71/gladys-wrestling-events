// -----------------------------------------------------------------------------
// The integration: every Gladys handler, registered before connect().
//
// A calendar integration (manifest `type: "calendar"`): one calendar per
// followed promotion for every user who enabled it (src/calendar.js), the
// `upcoming` and `next_show` widgets, the scene triggers and the
// `get_next_show` scene action.
//
// A one-minute tick drives everything: it sends the reminders that are due,
// slides the calendar window at midnight, and starts a scan of TheSportsDB
// when jobs are due (src/scan.js). A scan runs in the background, one request
// every 7 seconds with the free key: its changes fire the scene triggers at
// once, the calendars and widgets follow every 20 requests and at its end.
// The tests drive it with the fake Gladys of the SDK, a fake TheSportsDB and a
// clock moved by hand (test/app.test.js).
// -----------------------------------------------------------------------------

import { logger as sdkLogger } from '@gladysassistant/integration-sdk';
import { createCalendarSync } from './calendar.js';
import { INTERNAL_KEYS, normalizeConfig, readKeys, textLanguage } from './config.js';
import { changeEvents, dueReminders, nextShowOutputs } from './events.js';
import { all, truncate } from './i18n.js';
import { createImages } from './images.js';
import { KINDS } from './kinds.js';
import { PROMOTION_KEYS } from './promotions.js';
import { createScanner } from './scan.js';
import { createSportsDbClient } from './sportsdb.js';
import { upcomingShows } from './shows.js';
import { createStore } from './store.js';
import { MINUTE_MS, formatTime, localClock } from './time.js';
import { buildNextShowWidget, buildUpcomingWidget, WIDGETS } from './widgets.js';

const SCENE_ACTIONS = { NEXT: 'get_next_show' };
const TICK_MS = MINUTE_MS;
const PUBLISH_EVERY_JOBS = 20;
const WIDGET_REFRESH_SPACING_MS = 11 * 1000;

/**
 * @description Wire the integration.
 * @param {object} gladys - SDK client (or the fake one of the tests).
 * @param {object} [deps] - Dependencies, replaced in the tests.
 * @param {object} [deps.client] - TheSportsDB client (src/sportsdb.js).
 * @param {object} [deps.store] - State file (src/store.js).
 * @param {object} [deps.images] - Widget images (src/images.js).
 * @param {Function} [deps.now] - Clock, in ms.
 * @param {string} [deps.timeZone] - Timezone of the instance (TZ by default).
 * @param {Function} [deps.sleep] - Delay between calendar writes.
 * @param {string} [deps.userAgent] - Sent to TheSportsDB.
 * @param {object} [deps.logger] - SDK logger.
 * @returns {object} `{ start, stop, tick, scan, nextShow, store }`.
 */
export function createApp(gladys, deps = {}) {
  const {
    now = () => Date.now(),
    timeZone = process.env.TZ || undefined,
    sleep,
    userAgent = 'gladys-wrestling-events (+https://github.com/William-De71/gladys-wrestling-events)',
    logger = sdkLogger,
  } = deps;
  let config = normalizeConfig(gladys.config ?? {});
  const client = deps.client ?? createSportsDbClient({ apiKey: config.apiKey, userAgent });
  const store = deps.store ?? createStore({ logger });
  const images = deps.images ?? createImages({ userAgent });

  let timer = null;
  let stopped = false;
  let today = null;
  let ticking = null;
  let scanning = null;
  let lastConnection = null;
  const lastWidgetRefresh = new Map();
  const pendingWidgetRefresh = new Map();

  const currentDay = () => localClock(now(), timeZone).date;

  const scanner = createScanner({
    client,
    store,
    config: () => config,
    today: currentDay,
    now,
    logger,
  });

  /** A promotion read at least once: its calendar can be published. */
  const ready = (promotion) =>
    scanner.windowJobs().some((job) => job.promotion === promotion && store.coveredAt(job.key) > 0);

  const calendarSync = createCalendarSync(gladys, {
    config: () => config,
    shows: () => store.shows(),
    ready,
    today: currentDay,
    timeZone,
    sleep,
    logger,
  });

  const safely = async (call) => {
    try {
      return await call();
    } catch (error) {
      logger.warn(error.message);
      return undefined;
    }
  };

  // --- Publications ------------------------------------------------------------

  const refreshWidget = (key) => {
    const wait = (lastWidgetRefresh.get(key) ?? 0) + WIDGET_REFRESH_SPACING_MS - Date.now();
    if (wait <= 0) {
      lastWidgetRefresh.set(key, Date.now());
      safely(() => gladys.requestWidgetRefresh(key));
      return;
    }
    if (!pendingWidgetRefresh.has(key)) {
      const pending = setTimeout(() => {
        pendingWidgetRefresh.delete(key);
        refreshWidget(key);
      }, wait);
      pending.unref?.();
      pendingWidgetRefresh.set(key, pending);
    }
  };

  const connectionStatus = () => {
    const status = scanner.status();
    if (status.keyRefused) {
      return { connected: false, message: all('statusKeyRefused') };
    }
    if (status.pausedUntil) {
      return {
        connected: true,
        message: all('statusPaused', { time: formatTime(status.pausedUntil, timeZone) }),
      };
    }
    if (status.lastError && status.lastError.kind !== 'rate_limited') {
      return {
        connected: false,
        message: all('statusUnreachable', { error: truncate(status.lastError.message, 80) }),
      };
    }
    if (status.pending > 0) {
      return {
        connected: true,
        message: all('statusReading', {
          percent: Math.floor((100 * (status.total - status.pending)) / status.total),
        }),
      };
    }
    const count = upcomingShows(store.shows(), {
      now: now(),
      today: currentDay(),
      timeZone,
      promotions: config.promotions,
      kinds: config.kinds,
    }).length;
    return {
      connected: true,
      message: all('statusOk', { count, promotions: config.promotions.length }),
    };
  };

  const publishConnection = async () => {
    const status = connectionStatus();
    const message = Object.fromEntries(
      Object.entries(status.message).map(([language, text]) => [language, truncate(text, 200)]),
    );
    const key = JSON.stringify([status.connected, message]);
    if (key !== lastConnection) {
      await gladys.setConnectionStatus(status.connected, message);
      lastConnection = key;
    }
  };

  const publishAll = async () => {
    if (!gladys.connected) {
      return;
    }
    await safely(() => calendarSync.syncAll());
    await safely(() => publishConnection());
    refreshWidget(WIDGETS.UPCOMING);
    refreshWidget(WIDGETS.NEXT);
  };

  // --- Scanning ----------------------------------------------------------------

  const onChanges = async (changes) => {
    if (!gladys.connected) {
      return;
    }
    const events = changeEvents(changes, { config, now: now(), today: currentDay(), timeZone });
    for (const event of events) {
      await safely(() => gladys.publishSceneEvent(event.trigger, event.data));
    }
  };

  /** Run the due jobs in the background; resolves when the scan is over. */
  const scan = () => {
    if (!scanning) {
      scanning = (async () => {
        // Batches of 20 requests: the calendars and widgets follow each batch.
        for (;;) {
          const ran = await scanner.runDue({
            onChanges,
            shouldStop: () => stopped,
            max: PUBLISH_EVERY_JOBS,
          });
          await publishAll();
          if (ran < PUBLISH_EVERY_JOBS || stopped) {
            break;
          }
        }
      })()
        .catch((error) => logger.warn(`scan failed: ${error.message}`))
        .finally(() => {
          scanning = null;
        });
    }
    return scanning;
  };

  // --- The tick ------------------------------------------------------------------

  const runTick = async () => {
    const day = currentDay();
    const dayChanged = today !== null && day !== today;
    today = day;
    if (gladys.connected) {
      const reminders = dueReminders({
        shows: store.shows(),
        now: now(),
        config,
        wasFired: (key) => store.wasFired(key),
        timeZone,
      });
      for (const reminder of reminders) {
        await safely(() => gladys.publishSceneEvent(reminder.trigger, reminder.data));
        store.markFired(reminder.key, reminder.until);
      }
      store.pruneFired(now());
    }
    if (dayChanged) {
      await publishAll();
    } else if (gladys.connected) {
      // The countdown of the widgets moves on; the status follows the scan.
      await safely(() => publishConnection());
    }
    if (scanner.nextJob()) {
      scan();
    }
  };

  /** One tick at a time. */
  const tick = () => {
    if (!ticking) {
      ticking = runTick()
        .catch((error) => logger.warn(`tick failed: ${error.message}`))
        .finally(() => {
          ticking = null;
        });
    }
    return ticking;
  };

  // --- Language ----------------------------------------------------------------

  const rememberLanguage = (language) => {
    if (
      typeof language !== 'string' ||
      !/^[a-z]{2}$/.test(language) ||
      language === config.lastLanguage
    ) {
      return;
    }
    config = { ...config, lastLanguage: language };
    gladys
      .setConfig({ [INTERNAL_KEYS.language]: language })
      .catch((error) => logger.warn(`unable to store the language: ${error.message}`));
  };

  // --- Handlers ------------------------------------------------------------------

  const applyConfig = async (raw) => {
    const before = config;
    config = normalizeConfig(raw ?? {});
    if (before.apiKey !== config.apiKey) {
      client.setApiKey(config.apiKey);
    }
    scanner.reset();
    lastConnection = null;
    await publishAll();
    tick();
  };

  gladys.on('connected', async () => {
    // Calendars may have changed while disconnected: push everything again.
    calendarSync.forget();
    await applyConfig(gladys.config ?? {});
    logger.info(
      `connected, ${config.promotions.length} promotion(s), ${client.premium ? 'premium' : 'free'} key`,
    );
  });

  gladys.onConfigUpdated(async (raw) => {
    await applyConfig(raw);
  });

  gladys.onCalendarAccountUpdated(async (userSelector) => {
    await calendarSync.syncUser(userSelector);
  });

  const widgetData = (settings) => ({
    shows: store.shows(),
    now: now(),
    today: currentDay(),
    timeZone,
    config,
    ready: config.promotions.some(ready),
    fetchedAt: store.lastRead(),
    settings: settings ?? {},
  });

  gladys.onWidgetGet(WIDGETS.UPCOMING, async ({ settings, language }) => {
    rememberLanguage(language);
    return buildUpcomingWidget(widgetData(settings));
  });

  gladys.onWidgetGet(WIDGETS.NEXT, async ({ settings, language }) => {
    rememberLanguage(language);
    return buildNextShowWidget(widgetData(settings));
  });

  gladys.onWidgetGetImage(async (key) => images.get(key));

  /**
   * @description The next followed show.
   * @param {object} [filters] - `{ promotion, kind }`: lists of keys, empty for every followed one.
   * @returns {object|null} The show.
   */
  const nextShow = (filters = {}) => {
    const promotions = readKeys(filters.promotion, PROMOTION_KEYS, []);
    const kinds = readKeys(filters.kind, KINDS, []);
    const [show] = upcomingShows(store.shows(), {
      now: now(),
      today: currentDay(),
      timeZone,
      promotions: promotions.length ? promotions : config.promotions,
      kinds: kinds.length ? kinds : config.kinds,
    });
    return show ?? null;
  };

  gladys.onSceneAction(SCENE_ACTIONS.NEXT, async (fields) =>
    nextShowOutputs(nextShow(fields ?? {}), {
      now: now(),
      language: textLanguage(config),
      timeZone,
    }),
  );

  return {
    /** Start the one-minute tick (after connect). */
    start() {
      timer ??= setInterval(tick, TICK_MS);
      timer.unref?.();
    },
    /** Stop the timers and write the state (shutdown). */
    stop() {
      stopped = true;
      clearInterval(timer);
      timer = null;
      for (const pending of pendingWidgetRefresh.values()) {
        clearTimeout(pending);
      }
      pendingWidgetRefresh.clear();
      store.flush();
    },
    tick,
    scan,
    nextShow,
    store,
  };
}

export { SCENE_ACTIONS };
