import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseStopEntries } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig coerces the numbers a form sends as strings', () => {
  const config = normalizeConfig({
    delay_threshold: '3',
    imminent_minutes: '0',
    poll_frequency: '120',
  });
  assert.equal(config.delay_threshold, 3);
  assert.equal(config.imminent_minutes, 0);
  assert.equal(config.poll_frequency, 120);
});

test('normalizeConfig keeps the values in their bounds', () => {
  const config = normalizeConfig({
    poll_frequency: 5,
    delay_threshold: 'abc',
    imminent_minutes: -4,
  });
  assert.equal(config.poll_frequency, 60, 'Gladys polls once a minute at most');
  assert.equal(config.delay_threshold, DEFAULT_CONFIG.delay_threshold);
  assert.equal(config.imminent_minutes, 0);
});

test('normalizeConfig falls back to the default language for an unknown one', () => {
  assert.equal(normalizeConfig({ language: 'es' }).language, 'es');
  assert.equal(normalizeConfig({ language: 'xx' }).language, DEFAULT_CONFIG.language);
});

test('monitor_network is on unless explicitly turned off', () => {
  assert.equal(normalizeConfig().monitor_network, true);
  assert.equal(normalizeConfig({ monitor_network: false }).monitor_network, false);
});

test('parseStopEntries splits the entries and their lines', () => {
  assert.deepEqual(parseStopEntries('Namur; be-stib_6 | 1, 5\nBE.NMBS.008813003 ;; '), [
    { ref: 'Namur', lines: [] },
    { ref: 'be-stib_6', lines: ['1', '5'] },
    { ref: 'BE.NMBS.008813003', lines: [] },
  ]);
});

test('parseStopEntries keeps a stop once, but a stop per set of lines', () => {
  assert.deepEqual(parseStopEntries('Namur; namur; be-stib_6 | 1; be-stib_6 | 5'), [
    { ref: 'Namur', lines: [] },
    { ref: 'be-stib_6', lines: ['1'] },
    { ref: 'be-stib_6', lines: ['5'] },
  ]);
});

test('parseStopEntries accepts an empty field', () => {
  assert.deepEqual(parseStopEntries(''), []);
  assert.deepEqual(parseStopEntries(undefined), []);
});
