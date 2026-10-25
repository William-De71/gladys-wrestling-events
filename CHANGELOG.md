# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/). This file is generated at
each release from the Conventional Commits: do not edit it by hand.

## [0.3.0] - 2026-10-25

### Added

- require Gladys 5.3 and declare catalog keywords ([03e2e95](https://github.com/William-De71/gladys-wrestling-events/commit/03e2e9546a7f03a7193e409667989e08f55046f2))

## [0.2.0] - 2026-10-25

### Added

- list the integration under the new Leisure shelf of the catalog ([7f45c9d](https://github.com/William-De71/gladys-wrestling-events/commit/7f45c9d10538b6585628cf78520b74f51bd05af4))

## [0.1.1] - 2026-10-24

### Security

- **security:** build the image on Node.js 24.22.1 or later ([7cf8ddf](https://github.com/William-De71/gladys-wrestling-events/commit/7cf8ddf034eb8b6d10f82f009468eeea64140175))

## [0.1.0] - 2026-10-18

### Added

- The program of 14 professional wrestling promotions from TheSportsDB (WWE, AEW, NJPW, TNA, AAA, ROH, CMLL, Stardom, AJPW, DDT, Dragon Gate, GCW, RevPro, MLP), picked in a list, with the weekly TV shows, the tour shows and the major events (each kind can be left out).
- A Gladys calendar per followed promotion for every user who enables the integration in "My calendars": timed shows when the time is known, all-day otherwise, with the venue, the card of the matches and a link to TheSportsDB.
- Scene triggers: a show starts (at the bell, or 15 minutes to 2 hours before), a new show is announced, matches are added to a card; filters: promotion and kind of show.
- Scene action: the next show (of some promotions or kinds), with a ready-made sentence in four languages.
- Dashboard widgets: the next shows (list with posters, the card behind a tap), and the next show (countdown, time, poster, venue, card).
- Cloud transport: the free key of TheSportsDB (one request every 7 seconds, 30 days ahead) or a premium key (whole seasons, 90 days ahead); what was read is kept in /data.
- English, French, German and Spanish everywhere: settings, calendars, widgets, scenes and documentation.

[0.3.0]: https://github.com/William-De71/gladys-wrestling-events/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/William-De71/gladys-wrestling-events/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/William-De71/gladys-wrestling-events/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/William-De71/gladys-wrestling-events/releases/tag/v0.1.0
