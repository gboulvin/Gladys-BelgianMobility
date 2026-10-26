# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Changed

- Requires Gladys 5.3.0 or later: the manifest declares search keywords and
  the countries where the integration works, for the new catalog of Gladys
  5.3. Listed under the **Transport & mobility** catalog category.
- Integration SDK 0.16.

## [1.0.1] - 2026-10-22

### Security

- `brace-expansion`, pulled in by ESLint, raised to 5.0.12 against the
  high-severity denial-of-service advisories (GHSA-mh99-v99m-4gvg and
  related). A development tool only: the published image never shipped it.
- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [1.0.0] - 2026-10-14

### Added

- Follow train stations and metro, tram and bus stops anywhere in Belgium:
  SNCB/NMBS through iRail, STIB/MIVB, De Lijn and TEC through Transitous. No
  account, no API key.
- One device per followed stop: minutes until the next departure, its delay
  (with history) and a summary with line, destination and platform. A stop can
  be limited to some lines (`be-stib_6 | 1, 5`, `Namur | IC`).
- An optional "SNCB network" device with the latest disruption.
- Scene triggers: departure delayed, departure cancelled, departure soon
  ("time to leave") and new SNCB disruption — once per trip, never replayed
  after a restart.
- Scene actions: get the next departure of a stop, plan a train journey
  between two stations, get the SNCB network status.
- Dashboard widgets: a departures board per stop and the SNCB network status.
- Configuration screen buttons: search a stop identifier, test the connection.
- English, French, German and Spanish texts and documentation.

[Unreleased]: https://github.com/gboulvin/Gladys-BelgianMobility/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/gboulvin/Gladys-BelgianMobility/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/gboulvin/Gladys-BelgianMobility/releases/tag/v1.0.0
