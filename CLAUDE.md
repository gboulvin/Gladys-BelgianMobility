# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

**Belgian Mobility**, a Gladys Assistant **external integration**: a Node.js
service (Node 22+, ESM, no build step) running in its own sandboxed Docker
container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template.

It reads two free, keyless, public APIs:

- **iRail** (`api.irail.be`) for the SNCB/NMBS trains: station list, liveboard,
  disturbances, connections. Fair use: 3 requests/s, so `src/http.js` spaces
  the calls (350 ms) and the station list is cached a day.
- **Transitous** (`api.transitous.org`, MOTIS API) for every other operator
  (STIB/MIVB, De Lijn, TEC): stop search (`geocode`) and departures
  (`stoptimes`). STIB has no real-time feed there: its stops show the timetable.

Both ask for a User-Agent identifying the app (`USER_AGENT` in `src/http.js`).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/devices.test.js          # one file
node --test --test-name-pattern "delay"   # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three before pushing.

## Architecture

```
index.js                     SDK wiring only: handlers registered before connect()
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults), normalization, `stops` parsing
src/i18n.js                  MESSAGES: every user-facing text in en/fr/de/es; t() and tl()
src/http.js                  JSON GET with User-Agent, throttle, timeout, injectable fetch
src/providers/irail.js       iRail client + normalizers (liveboard, disturbances, connections)
src/providers/transitous.js  Transitous client + normalizers (stoptimes, geocode)
src/mobility.js              createMobility(): config, resolved stops, departures cache
src/events.js                trackers deciding which scene events fire (once, seeded at start)
src/devices/stop.js          one device per followed stop: discovery, states, events
src/devices/network.js       the SNCB network device
src/devices/index.js         discovery list, external id -> stop routing, poll dispatcher
src/scenes.js                scene actions (manifest `scene_actions`)
src/widgets.js               dashboard widgets (manifest `widgets`)
src/actions.js               Configuration screen buttons (manifest `actions`)
gladys-assistant-integration.json  manifest
docs/{en,fr,de,es}.md        user documentation, re-hosted by Gladys (en and fr mandatory)
test/fixtures/               recorded (trimmed) answers of both APIs
test/helpers.js              fake fetch over the fixtures, createTestMobility()
```

A normalized departure, whatever the provider:
`{ id, line, vehicle, mode, operator, destination, scheduledAt, expectedAt,
delayMinutes, cancelled, platform, platformChanged, realtime }` (times in ms).

## Rules

- **External ids are forever.** A stop device is
  `gladys.externalIds('stop', stop.key)`, `stop.key` derived from the
  operator's stop id (`sncb-008863008`, `be-stib_6`, plus `~<lines>` when
  lines are kept), sanitized of `:`. Never derive it from a display name;
  never rename a feature key (`STOP_FEATURES`, `NETWORK_FEATURES`), a manifest
  `config_schema` / `actions` / `scene_triggers` / `scene_actions` / `widgets`
  key, nor a scene event data key: scenes and dashboards store them.
- **Four languages.** Every user-facing text exists in English, French, German
  and Spanish: manifest texts, `MESSAGES` in `src/i18n.js`, and
  `docs/*.md`. `test/i18n.test.js` fails on a missing language or a
  placeholder that differs between languages. Add new runtime texts to
  `MESSAGES`, never inline.
- **Scene events fire once.** Use the trackers of `src/events.js`; the first
  read after a (re)start or a config change only seeds. Event `data` carries
  only the keys declared in the trigger's `fields` + `variables` (tested).
- **Tests never touch the network.** Inject the fake fetch of
  `test/helpers.js`; to cover a new case, derive a body from a fixture
  (`editLiveboard`, `editStopTimes`) rather than recording a new one.
- **The container rootfs is read-only.** Write only under `/data` (nothing is
  stored today). Never log tokens.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Texts are multi-language objects `{ en, fr, de, es }`,
  `placeholder` included. The catalog `description` holds 10 to 100
  characters per language, widget labels 3 to 30. `scene_triggers`,
  `scene_actions` and `widgets` need `gladys_version >= 5.1.0`.
  `test/manifest.test.js` ties the manifest to the code: change both sides
  together.
- **Widgets** must pass `validateWidgetContent` (tested): badges ≤ 16
  characters, card titles ≤ 60, status labels ≤ 40, https links only.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
