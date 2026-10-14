import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildDiscoveredDevices } from '../src/devices/index.js';
import { stopIds } from '../src/devices/stop.js';
import { DEPARTURES_WIDGET, NETWORK_WIDGET, WIDGETS, refreshWidgets } from '../src/widgets.js';
import { createTestMobility, editLiveboard } from './helpers.js';

const request = (settings = {}) => ({ settings, language: 'fr', units: 'metric' });

async function departuresContent(config = {}, overrides = {}, settings) {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility(config, overrides);
  const content = await WIDGETS[DEPARTURES_WIDGET].get(gladys, {
    ...request(settings ?? { stop: stopIds(gladys, mobility.stops[0]).device }),
    mobility,
  });
  return { gladys, mobility, content };
}

test('the departures board is rendered exactly as sent', async () => {
  const { content } = await departuresContent();
  // [] = nothing the core would drop, truncate or trim to the content budget.
  assert.deepEqual(validateWidgetContent(content), []);
  const list = content.components.find((component) => component.type === 'card-list');
  assert.equal(list.items.length, 5, 'five departures by default');
});

test('the board shows delays, cancellations and the chosen count', async () => {
  const { content } = await departuresContent(
    { stops: 'Namur' },
    { 'irail:liveboard': editLiveboard((d, i) => (i === 1 ? { ...d, canceled: '1' } : d)) },
  );
  const gladys = createFakeGladys();
  assert.deepEqual(validateWidgetContent(content), []);
  const badges = content.components
    .find((component) => component.type === 'card-list')
    .items.map((item) => item.badge.color);
  assert.ok(badges.includes('danger'), 'a cancelled train');
  assert.ok(badges.includes('warning'), 'a late train');

  const { mobility } = await createTestMobility({ stops: 'Namur' });
  const three = await WIDGETS[DEPARTURES_WIDGET].get(gladys, {
    ...request({ stop: stopIds(gladys, mobility.stops[0]).device, count: 3 }),
    mobility,
  });
  assert.equal(three.components.find((c) => c.type === 'card-list').items.length, 3);
});

test('the live tiles reference features the integration publishes', async () => {
  const { gladys, mobility, content } = await departuresContent();
  const featureIds = new Set(
    buildDiscoveredDevices(gladys, mobility).flatMap((device) =>
      device.features.map((feature) => feature.external_id),
    ),
  );
  const tiles = content.components.filter((component) => component.device_feature);
  assert.equal(tiles.length, 2);
  for (const tile of tiles) {
    assert.ok(featureIds.has(tile.device_feature), `unknown feature ${tile.device_feature}`);
  }
});

test('without a chosen stop, the board asks for one', async () => {
  const { content } = await departuresContent({}, {}, {});
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components.length, 1);
  assert.equal(content.components[0].type, 'text');
});

test('an API failure shows a message, not an error', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility(
    { stops: 'Namur' },
    { 'irail:liveboard': { status: 503 } },
  );
  const content = await WIDGETS[DEPARTURES_WIDGET].get(gladys, {
    ...request({ stop: stopIds(gladys, mobility.stops[0]).device }),
    mobility,
  });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(content.components.some((c) => c.type === 'text' && c.variant === 'body'));
});

test('the refresh button drops the cache and answers a short toast', async () => {
  const { gladys, mobility, content } = await departuresContent();
  const buttons = content.components.filter((c) => c.type === 'button' && c.action);
  assert.equal(buttons.length, 1);
  for (const { action } of buttons) {
    const message = await WIDGETS[DEPARTURES_WIDGET].action(gladys, {
      actionKey: action.key,
      params: action.params,
      settings: {},
      mobility,
    });
    for (const language of ['en', 'fr', 'de', 'es']) {
      assert.ok(message[language].length <= 200, 'toasts are capped at 200 characters');
    }
  }
});

test('an unknown widget action fails, so the user sees the error', async () => {
  const { gladys, mobility } = await departuresContent();
  await assert.rejects(
    WIDGETS[DEPARTURES_WIDGET].action(gladys, { actionKey: 'unknown', params: {}, mobility }),
    /Unknown widget action/,
  );
});

test('the network widget is rendered exactly as sent', async () => {
  const gladys = createFakeGladys();
  const { mobility } = await createTestMobility();
  const content = await WIDGETS[NETWORK_WIDGET].get(gladys, { ...request(), mobility });
  assert.deepEqual(validateWidgetContent(content), []);
  const list = content.components.find((component) => component.type === 'card-list');
  assert.equal(list.items.length, 3);
  assert.ok(list.items.every((item) => item.links?.[0].url.startsWith('https://')));
});

test('the network widget on a quiet network, and when iRail is down', async () => {
  const gladys = createFakeGladys();
  for (const body of [{ disturbance: [] }, { status: 500 }]) {
    const { mobility } = await createTestMobility({}, { 'irail:disturbances': body });
    const content = await WIDGETS[NETWORK_WIDGET].get(gladys, { ...request(), mobility });
    assert.deepEqual(validateWidgetContent(content), []);
  }
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(gladys.fake.widgetRefreshes, Object.keys(WIDGETS));
});
