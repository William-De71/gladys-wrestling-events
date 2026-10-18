// -----------------------------------------------------------------------------
// Entry point of the Wrestling Events external integration.
//
// Brings the program of the professional wrestling promotions (WWE, AEW,
// NJPW, TNA, AAA, ROH, CMLL, Stardom…) into Gladys, from TheSportsDB:
//   - calendars: one per followed promotion, for every user who enabled the
//     integration in "My calendars" (src/calendar.js);
//   - scene triggers: a show starts (or will start), a show is announced,
//     matches are added to a card;
//   - scene action: the next show;
//   - dashboard widgets: the next shows, the next show.
//
// This file only wires the SDK client: the handlers are in src/app.js.
//
// Environment variables provided by the Gladys supervisor:
//   GLADYS_HOST_API_URL / GLADYS_INTEGRATION_TOKEN / GLADYS_INTEGRATION_SELECTOR, TZ
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const gladys = new GladysIntegration();
const app = createApp(gladys, {
  userAgent: `gladys-wrestling-events/${version} (+https://github.com/William-De71/gladys-wrestling-events)`,
});

gladys.handleShutdown(async (signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  app.stop();
});

// --- Startup -----------------------------------------------------------------------
logger.info(`Starting the Wrestling Events integration ${version}...`);
gladys
  .connect()
  .then(() => app.start())
  .catch((err) => {
    logger.error('Initial connection failed', err);
    process.exit(1);
  });
