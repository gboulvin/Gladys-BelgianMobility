import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { stopIds } from '../src/devices/stop.js';
import { networkIds } from '../src/devices/network.js';
import { NOW, createTestMobility, fixture } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

function assertDeclaredOutputs(key, outputs) {
  const declared = manifest.scene_actions.find((action) => action.key === key).outputs;
  for (const [name, value] of Object.entries(outputs)) {
    const output = declared.find((entry) => entry.key === name);
    assert.ok(output, `output "${name}" of ${key} is not declared, the core would drop it`);
    assert.equal(typeof value, output.type, `output "${name}" of ${key} must be a ${output.type}`);
  }
}

test('get_next_departure returns the next departure of a stop', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  const outputs = await SCENE_ACTIONS.get_next_departure(gladys, {
    fields: { device: stopIds(gladys, mobility.stops[0]).device },
    mobility,
    now: NOW,
  });
  assert.equal(outputs.found, true);
  assert.equal(outputs.vehicle, 'S61 4586');
  assert.equal(outputs.minutes, 7);
  assert.equal(outputs.departure_time, '14:47');
  assert.equal(outputs.summary.split('\n').length, 3);
  assertDeclaredOutputs('get_next_departure', outputs);
});

test('get_next_departure filters on a line and a destination', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  const device = stopIds(gladys, mobility.stops[0]).device;
  const byLine = await SCENE_ACTIONS.get_next_departure(gladys, {
    fields: { device, line: 'ic' },
    mobility,
    now: NOW,
  });
  assert.equal(byLine.vehicle, 'IC 3813', 'the IC 2113 is later, 20 minutes late');
  const byDestination = await SCENE_ACTIONS.get_next_departure(gladys, {
    fields: { device, destination: 'libramont' },
    mobility,
    now: NOW,
  });
  assert.equal(byDestination.destination, 'Libramont');
});

test('get_next_departure answers found: false rather than failing', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility({ language: 'es' });
  const outputs = await SCENE_ACTIONS.get_next_departure(gladys, {
    fields: { device: stopIds(gladys, mobility.stops[1]).device, line: '999' },
    mobility,
    now: NOW,
  });
  assert.deepEqual(outputs, { found: false, summary: 'Ninguna salida en las próximas horas.' });
  assertDeclaredOutputs('get_next_departure', outputs);
});

test('get_next_departure refuses a device that is not a followed stop', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  await assert.rejects(
    SCENE_ACTIONS.get_next_departure(gladys, {
      fields: { device: networkIds(gladys).device },
      mobility,
    }),
    /not a followed stop/,
  );
});

test('plan_train_journey returns the next train between two stations', async () => {
  const gladys = createFakeGladys();
  const { mobility, fetch } = await createTestMobility();
  const outputs = await SCENE_ACTIONS.plan_train_journey(gladys, {
    fields: { from: 'Namur', to: 'Bruxelles-Central', time: '7:45' },
    mobility,
  });
  assert.equal(outputs.found, true);
  assert.equal(outputs.train, 'IC 2136');
  assert.equal(outputs.duration_minutes, 66);
  assertDeclaredOutputs('plan_train_journey', outputs);
  assert.match(fetch.calls.at(-1).url, /time=0745/);
});

test('plan_train_journey refuses a malformed time', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  await assert.rejects(
    SCENE_ACTIONS.plan_train_journey(gladys, {
      fields: { from: 'Namur', to: 'Liège-Guillemins', time: '25:00' },
      mobility,
    }),
    /HH:MM/,
  );
});

test('get_network_status counts the disruptions', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  const outputs = await SCENE_ACTIONS.get_network_status(gladys, { fields: {}, mobility });
  const disturbances = fixture('irail-disturbances').disturbance;
  const current = disturbances.filter((d) => d.type !== 'planned');
  assert.equal(outputs.disruption_count, current.length);
  assert.equal(outputs.disrupted, current.length > 0);
  assertDeclaredOutputs('get_network_status', outputs);
});

test('get_network_status on a quiet network', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility(
    { language: 'en' },
    { 'irail:disturbances': { disturbance: [] } },
  );
  const outputs = await SCENE_ACTIONS.get_network_status(gladys, { fields: {}, mobility });
  assert.equal(outputs.disrupted, false);
  assert.equal(outputs.summary, 'No disruption on the SNCB network right now.');
});
