import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGERS, createDepartureTracker, createDisruptionTracker } from '../src/events.js';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const OPTIONS = { now: NOW, delayThreshold: 5, imminentMinutes: 10 };

function departure(id, { inMinutes = 30, delay = 0, cancelled = false } = {}) {
  const expectedAt = NOW + inMinutes * 60_000;
  return {
    id,
    line: '71',
    vehicle: '71',
    destination: 'Delta',
    scheduledAt: expectedAt - delay * 60_000,
    expectedAt,
    delayMinutes: delay,
    cancelled,
  };
}

const triggersOf = (events) => events.map((event) => `${event.trigger}:${event.departure.id}`);

test('the first read only learns what is already there', () => {
  const tracker = createDepartureTracker();
  const events = tracker.track(
    'stop',
    [departure('a', { delay: 8 }), departure('b', { cancelled: true })],
    OPTIONS,
  );
  assert.deepEqual(events, []);
  // ...and does not fire it later either.
  assert.deepEqual(
    tracker.track(
      'stop',
      [departure('a', { delay: 9 }), departure('b', { cancelled: true })],
      OPTIONS,
    ),
    [],
  );
});

test('a delay over the threshold fires once per trip', () => {
  const tracker = createDepartureTracker();
  tracker.track('stop', [departure('a')], OPTIONS);
  assert.deepEqual(triggersOf(tracker.track('stop', [departure('a', { delay: 4 })], OPTIONS)), []);
  assert.deepEqual(triggersOf(tracker.track('stop', [departure('a', { delay: 6 })], OPTIONS)), [
    `${TRIGGERS.DEPARTURE_DELAYED}:a`,
  ]);
  assert.deepEqual(triggersOf(tracker.track('stop', [departure('a', { delay: 12 })], OPTIONS)), []);
});

test('a cancellation fires once, and no delay with it', () => {
  const tracker = createDepartureTracker();
  tracker.track('stop', [departure('a')], OPTIONS);
  const events = tracker.track('stop', [departure('a', { cancelled: true, delay: 20 })], OPTIONS);
  assert.deepEqual(triggersOf(events), [`${TRIGGERS.DEPARTURE_CANCELLED}:a`]);
  assert.deepEqual(tracker.track('stop', [departure('a', { cancelled: true })], OPTIONS), []);
});

test('a departure entering the time to leave fires departure_imminent once', () => {
  const tracker = createDepartureTracker();
  tracker.track('stop', [departure('a', { inMinutes: 15 })], OPTIONS);
  assert.deepEqual(
    triggersOf(tracker.track('stop', [departure('a', { inMinutes: 10 })], OPTIONS)),
    [`${TRIGGERS.DEPARTURE_IMMINENT}:a`],
  );
  assert.deepEqual(tracker.track('stop', [departure('a', { inMinutes: 9 })], OPTIONS), []);
});

test('imminent_minutes = 0 turns departure_imminent off', () => {
  const tracker = createDepartureTracker();
  const options = { ...OPTIONS, imminentMinutes: 0 };
  tracker.track('stop', [departure('a', { inMinutes: 15 })], options);
  assert.deepEqual(tracker.track('stop', [departure('a', { inMinutes: 2 })], options), []);
});

test('stops are tracked separately, and reset seeds again', () => {
  const tracker = createDepartureTracker();
  tracker.track('one', [departure('a')], OPTIONS);
  assert.deepEqual(tracker.track('two', [departure('a', { delay: 10 })], OPTIONS), [], 'two seeds');
  tracker.reset();
  assert.deepEqual(tracker.track('one', [departure('a', { delay: 10 })], OPTIONS), []);
});

test('a new disruption fires once, the ones known at start never', () => {
  const tracker = createDisruptionTracker();
  const known = { id: 'known', title: 'Known' };
  const fresh = { id: 'fresh', title: 'Fresh' };
  assert.deepEqual(tracker.track([known]), []);
  assert.deepEqual(tracker.track([known, fresh]), [fresh]);
  assert.deepEqual(tracker.track([known, fresh]), []);
  // Gone, then back: a new disruption again.
  tracker.track([known]);
  assert.deepEqual(tracker.track([known, fresh]), [fresh]);
});
