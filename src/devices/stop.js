// -----------------------------------------------------------------------------
// Device type: FOLLOWED STOP
//
// One device per stop of the `stops` configuration field: a train station, a
// metro, tram or bus stop, optionally restricted to some lines. Its features
// follow the next departure; its departures fire the scene triggers.
//
// The external id is built from the stop identifier given by the operator
// (and the kept lines): it never changes as long as the configuration entry
// stays the same.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { departureSummary, formatTime, minutesUntil, truncate } from '../format.js';
import { tl } from '../i18n.js';
import { TRIGGERS } from '../events.js';

export const STOP_DEVICE_TYPE = 'stop';

const logger = createLogger({ name: STOP_DEVICE_TYPE });

// Feature keys: part of the external ids, never renamed.
export const STOP_FEATURES = {
  NEXT_DEPARTURE: 'next-departure',
  NEXT_DELAY: 'next-delay',
  NEXT_SUMMARY: 'next-summary',
};

// An unchanged value is still re-sent every 30 minutes.
const HEARTBEAT_MS = 30 * 60 * 1000;

// Gladys stores texts up to this length.
const MAX_TEXT_STATE = 255;

export function stopIds(gladys, stop) {
  return gladys.externalIds(STOP_DEVICE_TYPE, stop.key);
}

export function buildStopDevice(gladys, stop) {
  const ids = stopIds(gladys, stop);
  return {
    name: stop.name,
    external_id: ids.device,
    // Polled every minute; the refresh interval of the configuration is
    // applied by skipping polls (see createPoller in ./index.js).
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: [
      {
        name: 'Next departure in',
        external_id: ids.feature(STOP_FEATURES.NEXT_DEPARTURE),
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        min: 0,
        max: 1440,
        read_only: true,
        has_feedback: false,
        keep_history: false,
      },
      {
        name: 'Delay of the next departure',
        external_id: ids.feature(STOP_FEATURES.NEXT_DELAY),
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.INTEGER,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        min: 0,
        max: 1440,
        read_only: true,
        has_feedback: false,
        // Delays are worth a chart: "how late is my train, day after day".
        keep_history: true,
      },
      {
        name: 'Next departure',
        external_id: ids.feature(STOP_FEATURES.NEXT_SUMMARY),
        category: DEVICE_FEATURE_CATEGORIES.TEXT,
        type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
        read_only: true,
        has_feedback: false,
        keep_history: false,
      },
    ],
  };
}

/** The next departure someone can actually take. */
export function nextDeparture(departures) {
  return departures.find((departure) => !departure.cancelled) ?? null;
}

/** The states of a stop device, from its departures. */
export function buildStopStates(gladys, stop, departures, { now, language }) {
  const ids = stopIds(gladys, stop);
  const next = nextDeparture(departures);
  if (!next) {
    return [
      {
        device_feature_external_id: ids.feature(STOP_FEATURES.NEXT_SUMMARY),
        text: tl(language, 'no_departure'),
      },
    ];
  }
  return [
    {
      device_feature_external_id: ids.feature(STOP_FEATURES.NEXT_DEPARTURE),
      state: minutesUntil(next.expectedAt, now),
    },
    {
      device_feature_external_id: ids.feature(STOP_FEATURES.NEXT_DELAY),
      state: Math.max(0, next.delayMinutes),
    },
    {
      device_feature_external_id: ids.feature(STOP_FEATURES.NEXT_SUMMARY),
      text: truncate(departureSummary(next, language), MAX_TEXT_STATE),
    },
  ];
}

/**
 * The `data` of a departure scene event: flat, primitives only, and only the
 * keys the manifest declares for the trigger (the core drops the others).
 */
export function departureEventData(gladys, stop, departure, now) {
  return {
    device: stopIds(gladys, stop).device,
    line: departure.line,
    vehicle: departure.vehicle,
    destination: departure.destination,
    stop_name: stop.stopName,
    operator: departure.operator,
    mode: departure.mode,
    scheduled_time: formatTime(departure.scheduledAt),
    expected_time: formatTime(departure.expectedAt),
    delay_minutes: Math.max(0, departure.delayMinutes),
    minutes: minutesUntil(departure.expectedAt, now),
    platform: departure.platform ?? '',
  };
}

/**
 * Read a stop, publish its states and fire the scene events of its departures.
 */
export async function pollStop(gladys, { mobility, tracker, stop, now = Date.now() }) {
  const { config } = mobility;
  const { departures } = await mobility.departures(stop);
  await gladys.publishChangedStates(
    buildStopStates(gladys, stop, departures, { now, language: config.language }),
    { heartbeat: HEARTBEAT_MS },
  );

  const events = tracker.track(stop.key, departures, {
    now,
    delayThreshold: config.delay_threshold,
    imminentMinutes: config.imminent_minutes,
  });
  for (const { trigger, departure } of events) {
    logger.info(`${trigger} at ${stop.stopName}: ${departure.vehicle} → ${departure.destination}`);
    await gladys.publishSceneEvent(trigger, departureEventData(gladys, stop, departure, now));
  }
  return { departures, events };
}

export const STOP_TRIGGERS = [
  TRIGGERS.DEPARTURE_DELAYED,
  TRIGGERS.DEPARTURE_CANCELLED,
  TRIGGERS.DEPARTURE_IMMINENT,
];
