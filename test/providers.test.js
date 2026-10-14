import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createIrailClient,
  normalizeConnections,
  normalizeDisturbances,
  normalizeLiveboard,
  normalizeName,
  sncbStationNumber,
} from '../src/providers/irail.js';
import {
  createTransitousClient,
  familyOfMode,
  isTransitousStopId,
  normalizeStopTimes,
} from '../src/providers/transitous.js';
import { USER_AGENT } from '../src/http.js';
import { createFakeFetch, editStopTimes, fixture } from './helpers.js';

test('the iRail liveboard becomes normalized departures', () => {
  const { stopName, departures } = normalizeLiveboard(fixture('irail-liveboard'));
  assert.equal(stopName, 'Namur');
  assert.equal(departures.length, 6);
  const [first] = departures;
  assert.equal(first.line, 'IC');
  assert.equal(first.vehicle, 'IC 2113');
  assert.equal(first.destination, 'Luxembourg');
  assert.equal(first.mode, 'train');
  assert.equal(first.operator, 'SNCB');
  assert.equal(first.platform, '10');
  assert.equal(first.delayMinutes, 20);
  assert.equal(first.expectedAt - first.scheduledAt, 20 * 60_000);
  assert.equal(first.cancelled, false);
});

test('a cancelled train and a changed platform are flagged', () => {
  const body = fixture('irail-liveboard');
  body.departures.departure[0].canceled = '1';
  body.departures.departure[1].platforminfo.normal = '0';
  body.departures.departure[2].platform = '?';
  const { departures } = normalizeLiveboard(body);
  assert.equal(departures[0].cancelled, true);
  assert.equal(departures[1].platformChanged, true);
  assert.equal(departures[2].platform, null, 'an unknown platform is no platform');
});

test('the disruptions get a stable id and an https link', () => {
  const disruptions = normalizeDisturbances(fixture('irail-disturbances'));
  assert.equal(disruptions.length, 3);
  for (const disruption of disruptions) {
    assert.ok(!/^\d+$/.test(disruption.id), 'not the position in the list');
    assert.match(disruption.link, /^https:\/\//);
    assert.ok(['disturbance', 'planned'].includes(disruption.type));
  }
  assert.deepEqual(
    normalizeDisturbances(fixture('irail-disturbances')).map((d) => d.id),
    disruptions.map((d) => d.id),
  );
});

test('the iRail connections become journeys', () => {
  const [journey] = normalizeConnections(fixture('irail-connections'));
  assert.equal(journey.from, 'Namur');
  assert.equal(journey.train, 'IC 2136');
  assert.equal(journey.platform, '9');
  assert.equal(journey.durationMinutes, 66);
  assert.equal(journey.transfers, 0);
});

test('SNCB ids and names are recognized', () => {
  assert.equal(sncbStationNumber('BE.NMBS.008863008'), '008863008');
  assert.equal(sncbStationNumber('Namur'), null);
  assert.equal(normalizeName('Liège-Guillemins'), 'liege guillemins');
});

test('a station is found by any of its official names', async () => {
  const irail = createIrailClient({ fetch: createFakeFetch() });
  assert.equal((await irail.findStation('Brussel-Centraal', 'fr')).id, 'BE.NMBS.008813003');
  assert.equal((await irail.findStation('liege guillemins', 'fr')).name, 'Liège-Guillemins');
  assert.equal(await irail.findStation('Atlantis', 'fr'), null);
});

test('the station list is downloaded once', async () => {
  const fetch = createFakeFetch();
  const irail = createIrailClient({ fetch });
  await irail.findStation('Namur', 'fr');
  await irail.findStation('Ottignies', 'fr');
  assert.equal(fetch.calls.length, 1);
});

test('every request identifies the integration', async () => {
  const fetch = createFakeFetch();
  await createIrailClient({ fetch }).disturbances('fr');
  await createTransitousClient({ fetch }).departures('be-stib_6');
  for (const call of fetch.calls) {
    assert.equal(call.headers['User-Agent'], USER_AGENT);
  }
});

test('iRail is asked in a language it speaks', async () => {
  const fetch = createFakeFetch();
  await createIrailClient({ fetch }).disturbances('es');
  assert.match(fetch.calls[0].url, /lang=en/);
});

test('an HTTP error rejects with the status', async () => {
  const irail = createIrailClient({
    fetch: createFakeFetch({ 'irail:disturbances': { status: 503 } }),
  });
  await assert.rejects(irail.disturbances('fr'), /HTTP 503/);
});

test('the Transitous stop times become normalized departures', () => {
  const { stopName, departures } = normalizeStopTimes(fixture('transitous-stoptimes'));
  assert.equal(stopName, 'De Brouckère');
  assert.ok(departures.length > 0);
  for (const departure of departures) {
    assert.equal(departure.operator, 'STIB');
    assert.ok(['metro', 'tram', 'bus'].includes(departure.mode));
    assert.ok(Number.isFinite(departure.scheduledAt));
  }
  const metro = departures.find((departure) => departure.mode === 'metro');
  assert.equal(metro.line, '1');
  assert.notEqual(metro.destination, metro.destination.toUpperCase(), 'capitals are softened');
});

test('a real-time delay, a cancellation and an arrival-only stop are understood', () => {
  const body = editStopTimes((stopTime, index) => {
    if (index === 0) {
      stopTime.realTime = true;
      stopTime.place.departure = new Date(
        Date.parse(stopTime.place.scheduledDeparture) + 4 * 60_000,
      ).toISOString();
    }
    if (index === 1) {
      stopTime.tripCancelled = true;
    }
    if (index === 2) {
      stopTime.place.pickupType = 'NOT_ALLOWED';
    }
  });
  const { departures } = normalizeStopTimes(body);
  assert.equal(departures[0].delayMinutes, 4);
  assert.equal(departures[0].realtime, true);
  assert.equal(departures[1].cancelled, true);
  assert.equal(departures.length, body.stopTimes.length - 1, 'nobody boards at a terminus');
});

test('the stop search keeps the Belgian stops', async () => {
  const transitous = createTransitousClient({ fetch: createFakeFetch() });
  const stops = await transitous.searchStops('De Brouckère');
  assert.ok(stops.length > 0);
  assert.equal(stops[0].id, 'be-stib_6');
  assert.ok(stops.every((stop) => stop.id.startsWith('be-')));
});

test('Transitous ids and modes are recognized', () => {
  assert.ok(isTransitousStopId('be-stib_6'));
  assert.ok(isTransitousStopId('be-delijn_gs:delijn:200780'));
  assert.ok(!isTransitousStopId('Namur'));
  assert.ok(!isTransitousStopId('BE.NMBS.008863008'));
  assert.equal(familyOfMode('SUBWAY'), 'metro');
  assert.equal(familyOfMode('HIGHSPEED_RAIL'), 'train');
  assert.equal(familyOfMode('COACH'), 'bus');
});

test('a train leaves from a track, a bus from a stop', async () => {
  const { departureSummary } = await import('../src/format.js');
  const base = { line: '71', vehicle: '71', destination: 'Delta', scheduledAt: 0, platform: '2' };
  assert.match(departureSummary({ ...base, mode: 'bus' }, 'fr'), /Quai 2/);
  assert.match(departureSummary({ ...base, mode: 'train', vehicle: 'IC 1' }, 'fr'), /Voie 2/);
  assert.match(
    departureSummary({ ...base, mode: 'train', vehicle: 'IC 1', platformChanged: true }, 'de'),
    /Gleis 2 \(geändert\)/,
  );
});
