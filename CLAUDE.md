# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** for professional wrestling: a
Node.js service (Node 22+, ESM, no build step) that runs in its own sandboxed
Docker container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. The program of the shows (WWE, AEW, NJPW, TNA,
AAA and nine other promotions) comes from the API v1 of
[TheSportsDB](https://www.thesportsdb.com), with its free key or the premium
key of the user. Transport: cloud only.

A **calendar integration** (`type: "calendar"`, Gladys 5.2.0+): one calendar
per followed promotion for every user who enabled it in "My calendars", two
dashboard widgets, three scene triggers and one scene action. No devices:
Gladys does not let one manifest be both.

Cagematch (the reference database of the fans) was the first idea and was
dropped on purpose: no API, a Sucuri JavaScript challenge in front of every
page and `Crawl-delay: 527` in its robots.txt. Never scrape it nor work around
its protection.

## Commands

```bash
npm install
npm test                                  # node --test, never touches the network
node --test test/app.test.js              # one file
DEBUG=gladys-integration-sdk npm test     # with the SDK debug logs
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store . --skip-image-check   # store checks
scripts/build-cover.sh                    # cover.jpg from docs/assets/cover.svg
docs/illustrations/render.sh              # docs/assets/widgets.<lang>.png
node .github/scripts/release.mjs next     # the version the next release would get
```

## Architecture

```
index.js                SDK wiring only (new GladysIntegration + createApp + shutdown)
src/app.js              every handler, registered before connect(); the one-minute tick
src/sportsdb.js         HTTP client of TheSportsDB: eventsday / eventsseason, spacing, pause
src/scan.js             which day (free key) or season (premium key) to read, and when
src/shows.js            TheSportsDB event -> show; days, ends, sorting, image keys
src/kinds.js            weekly / tour / special, guessed from the name of a show
src/promotions.js       our promotion keys -> league ids of TheSportsDB, names, colors
src/calendar.js         one calendar per promotion and user, one event per show
src/events.js           scene trigger transitions, payloads, scene action outputs
src/widgets.js          `upcoming` and `next_show` (pure, reused by docs/illustrations/gen.mjs)
src/images.js           widget images: the reduced posters of TheSportsDB, checked
src/store.js            /data/state.json: shows, coverage of the days, reminders fired
src/config.js           configuration (promotions, kinds, horizon, key, language)
src/i18n.js             runtime texts, en / fr / de / es
src/time.js             dates and times in the timezone of the instance (TZ)
gladys-assistant-integration.json   manifest
docs/{en,fr,de,es}.md   user documentation, re-hosted by the store
docs/illustrations/     generated widget images (render.sh, gen.mjs, render.js)
test/fixtures/          real answers of TheSportsDB (2026-10-18), reduced
.github/scripts/release.mjs         version, changelog, bump (tested in test/)
```

## Rules

- **Keys are forever**: the promotion keys of `src/promotions.js` (never a
  league id nor a label), the kinds (`weekly`, `tour`, `special`), the
  calendar ids `ext:<selector>:<user>:promotion-<key>`, the event ids
  `ext:<selector>:<user>:show-<TheSportsDB id>`, the keys of `config_schema`,
  of the widgets and their settings, of the scene triggers (fields, options,
  variables, the `lead` values) and of the scene action (fields, outputs).
  `test/manifest.test.js` ties the manifest to the code.
- **Be gentle with TheSportsDB.** The free key is shared by everybody and its
  Cloudflare blocks bursts well below the documented 30 requests a minute:
  one request every 7 seconds (1 s with a premium key), one at a time
  (`src/sportsdb.js`), a 15-minute pause after any refusal, never a retry in
  a loop. Free key: the near days every 3 hours, the far ones once a day, 30
  days ahead at most. Never ask for a day or season that is not due.
- **Coverage, not guesses.** An answer replaces the shows kept for exactly
  what it covers (one UTC day, or one year). A failed request keeps what was
  known; a promotion no longer followed loses its shows and its calendar.
- **Events once, on transitions.** `show_announced` only for a show that
  appears on a day already read (`firstRead` is false); `card_updated` only
  when lines are added to the card of a show to come; `show_starting` once per
  show and lead, at most 10 minutes late, never for an unknown time or a
  postponed show (`fired` in /data survives restarts). A scene action or a
  widget never fires an event.
- **Times.** `strTimestamp` is UTC. A show at midnight UTC with no local time
  has an unknown time: it is an all-day event on its local date. Ends are
  estimated by kind (2, 3 or 4 hours).
- **Calendars.** Pushed after each batch of 20 requests that changed
  something, at the end of a scan and at midnight (the window slides); at most
  30 writes a minute; a calendar the user stopped synchronizing is skipped. A
  calendar starts private: the user shares it in "My calendars".
- **Images.** Only `r2.thesportsdb.com` reduced copies (`/small`, `/medium`),
  rebuilt from the key alone, 300 KB at most, checked by magic number. The
  repository ships no image of TheSportsDB (fan art of unknown license): the
  illustrations draw their own posters.
- **The container rootfs is read-only.** Write only under `/data`.
- **Four languages.** Every user-facing text (manifest, runtime messages in
  `src/i18n.js`, `docs/*.md`, README) exists in English, French, German and
  Spanish. `test/i18n.test.js` checks it. Show names, venues and cards stay
  as TheSportsDB writes them; scene variables carry keys, not labels. Use
  the words of the Gladys UI (My calendars / Mes calendriers / Meine Kalender
  / Mis calendarios, Enable for me, Share with the household…).
- **Widget images.** After any change to the content of a widget, run
  `docs/illustrations/render.sh` again and look at the four PNG files.
- **Versions belong to the Release workflow**: never edit `version` in
  `package.json`, the lockfile or the manifest, nor the `docker_image` tag.
  The version stays below 1.0.0 until the maintainer runs the Release workflow
  with `release-as: 1.0.0`.
- **Changelog.** Never edit CHANGELOG.md by hand, it is generated at the
  release. Write the PR title as the line the user will read.
- **Commits and PR titles** follow Conventional Commits, in English: `feat` ->
  minor, `fix` / `perf` -> patch, `!` or `BREAKING CHANGE:` -> major (minor
  below 1.0.0); `docs`, `chore`, `ci`, `test`, `style`, `refactor`, `build`
  release nothing.
- **Manifest.** Texts are objects `{ "en", "fr", "de", "es" }`; the catalog
  `description` holds 10 to 100 characters per language; the file stays under
  100 KB (the promotion list is repeated in 7 places: mind it when adding
  promotions). `type: "calendar"` needs `gladys_version >=5.2.0`.
  Transport: `["cloud"]`. No permission.
- **Forum drafts** (`.github/forum-*.md`) are never committed.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network (`test/helpers.js` fakes
  TheSportsDB from `test/fixtures/`).

## Pitfalls

- The free key answers at most 3 shows per request (`eventsday`), 15 per
  season and 1 for "next events": that is why it reads day by day. CMLL can
  have more than 3 shows a day.
- `eventsday` answers `{"events": null}` for a day without a show, and HTTP
  200 with `error code: 1015` (plain text) when Cloudflare blocks.
- A refused premium key is HTTP 400 `{"Message":"Invalid Premium API key…"}`.
- `structuredClone` loses the class of an error: the fake client of the tests
  must receive the `SportsDbError` instances themselves.
- Inside a card-list, the list display shows the date OR the subtitle: the
  time goes in the subtitle, never in `date`.
