import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMobility, matchesLines, PROVIDERS, sanitizeId } from '../src/mobility.js';
import { NOW, createFakeFetch, createTestMobility, editStopTimes } from './helpers.js';

test('the configured stops are resolved by name, SNCB id and Transitous id', async () => {
  const { mobility } = await createTestMobility({
    stops: 'Namur; BE.NMBS.008813003; be-sncb_S8841004; be-stib_6 | 1, 5; Atlantis',
  });
  assert.deepEqual(
    mobility.stops.map((stop) => [stop.key, stop.provider, stop.providerId]),
    [
      ['sncb-008863008', PROVIDERS.IRAIL, 'BE.NMBS.008863008'],
      ['sncb-008813003', PROVIDERS.IRAIL, 'BE.NMBS.008813003'],
      ['sncb-008841004', PROVIDERS.IRAIL, 'BE.NMBS.008841004'],
      ['be-stib_6~1-5', PROVIDERS.TRANSITOUS, 'be-stib_6'],
    ],
  );
  assert.deepEqual(mobility.unresolved, ['Atlantis']);
  assert.equal(mobility.stops[0].name, 'Namur (SNCB)');
  assert.equal(mobility.stops[2].stopName, 'Liège-Guillemins');
  assert.equal(mobility.stops[3].name, 'De Brouckère (STIB) – 1, 5');
});

test('the same station written twice is followed once', async () => {
  const { mobility } = await createTestMobility({ stops: 'Namur; BE.NMBS.008863008' });
  assert.equal(mobility.stops.length, 1);
});

test('an unreachable API makes load reject, so the caller retries', async () => {
  const mobility = createMobility({
    fetch: createFakeFetch({ 'irail:stations': { status: 500 } }),
    now: () => NOW,
  });
  await assert.rejects(mobility.load({ stops: 'Namur' }), /HTTP 500/);
});

test('a Transitous stop whose name cannot be read keeps its id as name', async () => {
  const { mobility } = await createTestMobility(
    { stops: 'be-stib_6' },
    { 'transitous:stoptimes': { status: 502 } },
  );
  assert.equal(mobility.stops[0].stopName, 'be-stib_6');
});

test('departures are sorted and filtered on the kept lines', async () => {
  const { mobility } = await createTestMobility({ stops: 'be-stib_6 | 71' });
  const { departures } = await mobility.departures(mobility.stops[0]);
  assert.ok(departures.length > 0);
  assert.ok(departures.every((departure) => departure.line === '71'));
  const times = departures.map((departure) => departure.expectedAt);
  assert.deepEqual(
    times,
    [...times].sort((a, b) => a - b),
  );
});

test('a train type keeps every train of that type', () => {
  const ic = { line: 'IC', vehicle: 'IC 2113' };
  assert.ok(matchesLines(ic, ['ic']));
  assert.ok(matchesLines(ic, ['IC 2113']));
  assert.ok(!matchesLines(ic, ['S61']));
  assert.ok(matchesLines(ic, []));
});

test('departures already gone are left out', async () => {
  const { mobility } = await createTestMobility(
    { stops: 'be-stib_6' },
    {},
    { now: NOW + 60 * 60_000 },
  );
  const { departures } = await mobility.departures(mobility.stops[0]);
  assert.deepEqual(departures, []);
});

test('departures are cached 30 seconds, unless forced', async () => {
  const { mobility, fetch } = await createTestMobility({ stops: 'Namur' });
  const [stop] = mobility.stops;
  const before = fetch.calls.length;
  await mobility.departures(stop);
  await mobility.departures(stop);
  assert.equal(fetch.calls.length - before, 1);
  await mobility.departures(stop, { force: true });
  assert.equal(fetch.calls.length - before, 2);
  mobility.invalidate(stop.key);
  await mobility.departures(stop);
  assert.equal(fetch.calls.length - before, 3);
});

test('a failed read is not cached', async () => {
  let fail = true;
  const { mobility } = await createTestMobility(
    { stops: 'be-stib_6' },
    {
      'transitous:stoptimes': (url) => {
        if (fail && /n=30/.test(url)) {
          return { status: 503 };
        }
        return editStopTimes(() => undefined);
      },
    },
  );
  await assert.rejects(mobility.departures(mobility.stops[0]), /HTTP 503/);
  fail = false;
  const { departures } = await mobility.departures(mobility.stops[0]);
  assert.ok(departures.length > 0);
});

test('sanitizeId keeps external ids free of separators', () => {
  assert.equal(sanitizeId('be-delijn_gs:delijn:200780'), 'be-delijn_gs-delijn-200780');
  assert.equal(sanitizeId('a b/c'), 'a-b-c');
});
