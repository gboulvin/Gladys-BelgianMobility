# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

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

[Unreleased]: https://github.com/gboulvin/Gladys-BelgianMobility/commits/main
