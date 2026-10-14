// -----------------------------------------------------------------------------
// Test helpers: a fake `fetch` answering with the recorded API responses of
// test/fixtures/ (real answers of iRail and Transitous, trimmed), so the tests
// never touch the network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createMobility } from '../src/mobility.js';

export function fixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
}

// The fixtures were recorded on 2026-10-14 around 14:40 Belgian time: every
// departure they list is still to come at this instant.
export const NOW = Date.parse('2026-10-14T12:40:00Z');

const ROUTES = [
  ['irail:stations', /api\.irail\.be\/v1\/stations\//, 'irail-stations'],
  ['irail:liveboard', /api\.irail\.be\/v1\/liveboard\//, 'irail-liveboard'],
  ['irail:disturbances', /api\.irail\.be\/v1\/disturbances\//, 'irail-disturbances'],
  ['irail:connections', /api\.irail\.be\/v1\/connections\//, 'irail-connections'],
  ['transitous:stoptimes', /api\.transitous\.org\/api\/v1\/stoptimes/, 'transitous-stoptimes'],
  ['transitous:geocode', /api\.transitous\.org\/api\/v1\/geocode/, 'transitous-geocode'],
];

/**
 * A fake fetch. `overrides[route]` replaces the fixture of a route: a body,
 * a function `(url) => body`, or `{ status }` for an HTTP error.
 * `fetch.calls` lists the requested URLs.
 */
export function createFakeFetch(overrides = {}) {
  const calls = [];
  async function fakeFetch(url, options = {}) {
    calls.push({ url: String(url), headers: options.headers });
    const route = ROUTES.find(([, pattern]) => pattern.test(url));
    if (!route) {
      throw new Error(`Unexpected request: ${url}`);
    }
    const [name, , fixtureName] = route;
    let body = name in overrides ? overrides[name] : fixture(fixtureName);
    if (typeof body === 'function') {
      body = await body(String(url));
    }
    if (body && typeof body.status === 'number' && Object.keys(body).length === 1) {
      return { ok: false, status: body.status, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => structuredClone(body) };
  }
  fakeFetch.calls = calls;
  return fakeFetch;
}

/** A mobility state whose APIs are the fixtures, clock frozen at NOW. */
export async function createTestMobility(config = {}, overrides = {}, { now = NOW } = {}) {
  const fetch = createFakeFetch(overrides);
  const mobility = createMobility({ fetch, now: () => now });
  await mobility.load({ stops: 'Namur; be-stib_6', ...config });
  return { mobility, fetch };
}

/** A stoptimes body derived from the fixture, each entry changed by `edit`. */
export function editStopTimes(edit) {
  const body = fixture('transitous-stoptimes');
  body.stopTimes = body.stopTimes.map((stopTime, index) => edit(stopTime, index) ?? stopTime);
  return body;
}

/** A liveboard body derived from the fixture, each departure changed by `edit`. */
export function editLiveboard(edit) {
  const body = fixture('irail-liveboard');
  body.departures.departure = body.departures.departure.map(
    (departure, index) => edit(departure, index) ?? departure,
  );
  return body;
}
