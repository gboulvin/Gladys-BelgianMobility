import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDiscoveredDevices, createPoller, resolveDevice } from '../src/devices/index.js';
import { STOP_FEATURES, departureEventData, pollStop, stopIds } from '../src/devices/stop.js';
import { NETWORK_FEATURES, networkIds } from '../src/devices/network.js';
import { TRIGGERS, createDepartureTracker, createDisruptionTracker } from '../src/events.js';
import { NOW, createTestMobility, editLiveboard, fixture } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

function createPollerFor(mobility) {
  return createPoller({
    mobility,
    tracker: createDepartureTracker(),
    disruptionTracker: createDisruptionTracker(),
  });
}

test('the discovery payload is accepted by Gladys', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  // The fake Gladys refuses what the host API refuses (category, unit,
  // poll frequency...), with the same 400.
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, mobility));
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Namur (SNCB)', 'De Brouckère (STIB)', 'SNCB network'],
  );
});

test('the network device follows monitor_network', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility({ monitor_network: false });
  const names = buildDiscoveredDevices(gladys, mobility).map((device) => device.name);
  assert.ok(!names.includes('SNCB network'));
  assert.equal(resolveDevice(gladys, mobility, networkIds(gladys).device), null);
});

test('external ids are stable and free of separators inside the platform id', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility({ stops: 'be-delijn_gs:delijn:200780 | 1' });
  const [device] = buildDiscoveredDevices(gladys, mobility);
  assert.equal(device.external_id, 'ext:test-integration:stop:be-delijn_gs-delijn-200780~1');
});

test('polling a station publishes the next departure', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility({ stops: 'Namur' });
  const [stop] = mobility.stops;
  const ids = stopIds(gladys, stop);
  const poll = createPollerFor(mobility);
  assert.equal(await poll(gladys, { external_id: ids.device }, NOW), true);
  // The IC 2113 of 14:45 is 20 minutes late: the S61 of 14:47 leaves first.
  assert.equal(gladys.fake.lastState(ids.feature(STOP_FEATURES.NEXT_DEPARTURE)), 7);
  assert.equal(gladys.fake.lastState(ids.feature(STOP_FEATURES.NEXT_DELAY)), 0);
  assert.equal(
    gladys.fake.lastState(ids.feature(STOP_FEATURES.NEXT_SUMMARY)),
    '14:47 S61 4586 → Wavre, Voie 5',
  );
});

test('the next departure skips the cancelled trains', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility(
    { stops: 'Namur' },
    {
      'irail:liveboard': editLiveboard((departure, index) =>
        index === 1 ? { ...departure, canceled: '1' } : departure,
      ),
    },
  );
  const [stop] = mobility.stops;
  await createPollerFor(mobility)(gladys, { external_id: stopIds(gladys, stop).device }, NOW);
  assert.match(
    gladys.fake.lastState(stopIds(gladys, stop).feature(STOP_FEATURES.NEXT_SUMMARY)),
    /S61 4163 → Jambes/,
  );
});

test('a stop with no departure says so', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility(
    { stops: 'Namur', language: 'de' },
    {
      'irail:liveboard': editLiveboard(() => undefined),
    },
    { now: NOW + 24 * 60 * 60_000 },
  );
  const [stop] = mobility.stops;
  await createPollerFor(mobility)(
    gladys,
    { external_id: stopIds(gladys, stop).device },
    NOW + 24 * 60 * 60_000,
  );
  assert.equal(
    gladys.fake.lastState(stopIds(gladys, stop).feature(STOP_FEATURES.NEXT_SUMMARY)),
    'Keine Abfahrt in den nächsten Stunden.',
  );
});

test('the poller follows the refresh interval and ignores unknown devices', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility({ stops: 'Namur', poll_frequency: 120 });
  const device = { external_id: stopIds(gladys, mobility.stops[0]).device };
  const poll = createPollerFor(mobility);
  assert.equal(await poll(gladys, device, NOW), true);
  assert.equal(await poll(gladys, device, NOW + 60_000), false);
  assert.equal(await poll(gladys, device, NOW + 120_000), true);
  assert.equal(await poll(gladys, { external_id: 'ext:test-integration:stop:gone' }, NOW), false);
});

test('the network is read every 5 minutes at most and shows the latest disruption', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  const device = { external_id: networkIds(gladys).device };
  const poll = createPollerFor(mobility);
  assert.equal(await poll(gladys, device, NOW), true);
  assert.equal(await poll(gladys, device, NOW + 2 * 60_000), false);
  assert.equal(await poll(gladys, device, NOW + 5 * 60_000), true);
  const latest = gladys.fake.lastState(
    networkIds(gladys).feature(NETWORK_FEATURES.LATEST_DISRUPTION),
  );
  assert.ok(fixture('irail-disturbances').disturbance.some((d) => d.title === latest));
});

test('a train becoming late fires departure_delayed with the declared data only', async () => {
  const gladys = createFakeGladys();
  let delay = '0';
  const { mobility } = await createTestMobility(
    { stops: 'Namur' },
    { 'irail:liveboard': () => editLiveboard((d, i) => (i === 1 ? { ...d, delay } : d)) },
  );
  const [stop] = mobility.stops;
  const tracker = createDepartureTracker();
  await pollStop(gladys, { mobility, tracker, stop, now: NOW });
  assert.equal(gladys.fake.sceneEvents.length, 0, 'the first read seeds');

  delay = '480';
  mobility.invalidate();
  await pollStop(gladys, { mobility, tracker, stop, now: NOW + 60_000 });
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [{ key, data }] = gladys.fake.sceneEvents;
  assert.equal(key, TRIGGERS.DEPARTURE_DELAYED);
  assert.equal(data.vehicle, 'S61 4586');
  assert.equal(data.line, 'S61');
  assert.equal(data.delay_minutes, 8);
  assert.equal(data.device, stopIds(gladys, stop).device);

  const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
  const declared = [...trigger.fields, ...trigger.variables].map((entry) => entry.key);
  for (const [name, value] of Object.entries(data)) {
    assert.ok(declared.includes(name), `data.${name} is not declared, the core would drop it`);
    assert.ok(value === null || typeof value !== 'object', `data.${name} must be a primitive`);
  }
});

test('every departure trigger declares the same data', () => {
  const gladys = createFakeGladys();
  const data = departureEventData(
    gladys,
    { key: 'k', stopName: 'Namur' },
    {
      line: 'IC',
      vehicle: 'IC 1',
      destination: 'X',
      operator: 'SNCB',
      mode: 'train',
      scheduledAt: NOW,
      expectedAt: NOW,
      delayMinutes: 0,
      platform: null,
    },
    NOW,
  );
  for (const key of [
    TRIGGERS.DEPARTURE_DELAYED,
    TRIGGERS.DEPARTURE_CANCELLED,
    TRIGGERS.DEPARTURE_IMMINENT,
  ]) {
    const trigger = manifest.scene_triggers.find((entry) => entry.key === key);
    const declared = [...trigger.fields, ...trigger.variables].map((entry) => entry.key);
    assert.deepEqual(
      Object.keys(data).filter((name) => !declared.includes(name)),
      [],
      key,
    );
  }
});

test('a new SNCB disruption fires network_disruption', async () => {
  const gladys = createFakeGladys();
  const body = fixture('irail-disturbances');
  const extra = body.disturbance.pop();
  let current = body;
  const { mobility } = await createTestMobility({}, { 'irail:disturbances': () => current });
  const device = { external_id: networkIds(gladys).device };
  const poll = createPollerFor(mobility);
  await poll(gladys, device, NOW);
  assert.equal(gladys.fake.sceneEvents.length, 0);
  current = { ...body, disturbance: [...body.disturbance, extra] };
  await poll(gladys, device, NOW + 5 * 60_000);
  assert.equal(gladys.fake.sceneEvents.length, 1);
  assert.equal(gladys.fake.sceneEvents[0].key, TRIGGERS.NETWORK_DISRUPTION);
  assert.equal(gladys.fake.sceneEvents[0].data.title, extra.title);
});
