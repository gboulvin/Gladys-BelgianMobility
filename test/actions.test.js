import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { ACTIONS } from '../src/actions.js';
import { createTestMobility } from './helpers.js';

test('search_stop lists the matching stops with their identifier', async () => {
  const { mobility } = await createTestMobility();
  const message = await ACTIONS.search_stop(createFakeGladys(), {
    fields: { query: 'De Brouckère' },
    mobility,
  });
  assert.match(message.en, /De Brouckère \(metro, tram, bus\) → be-stib_6/);
  assert.match(message.fr, /Copiez l'identifiant/);
});

test('search_stop says when nothing matches', async () => {
  const { mobility } = await createTestMobility({}, { 'transitous:geocode': [] });
  const message = await ACTIONS.search_stop(createFakeGladys(), {
    fields: { query: 'Atlantis' },
    mobility,
  });
  assert.match(message.de, /Keine Haltestelle für „Atlantis“/);
});

test('test_connection reports success, and the error otherwise', async () => {
  const ok = await createTestMobility();
  const success = await ACTIONS.test_connection(createFakeGladys(), {
    fields: {},
    mobility: ok.mobility,
  });
  assert.match(success.en, /Connection OK.*2 stop/);

  const ko = await createTestMobility({}, { 'transitous:geocode': { status: 503 } });
  const failure = await ACTIONS.test_connection(createFakeGladys(), {
    fields: {},
    mobility: ko.mobility,
  });
  assert.match(failure.es, /Error de conexión: HTTP 503/);
});
