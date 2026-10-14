// -----------------------------------------------------------------------------
// Device registry.
//
// The devices follow the configuration: one per followed stop (./stop.js),
// plus the SNCB network (./network.js) when `monitor_network` is on. This
// module builds the discovery payload and routes a polled device back to what
// it represents.
// -----------------------------------------------------------------------------

import { DEVICE_POLL_FREQUENCIES } from '@gladysassistant/integration-sdk';
import { TRIGGERS } from '../events.js';
import { STOP_TRIGGERS, buildStopDevice, pollStop, stopIds } from './stop.js';
import {
  NETWORK_MIN_INTERVAL_SECONDS,
  buildNetworkDevice,
  networkIds,
  pollNetwork,
} from './network.js';

// Every scene trigger key the devices fire: each one must be declared in the
// manifest `scene_triggers` field, or the core answers 404 (see the tests).
export const SCENE_TRIGGER_KEYS = [...STOP_TRIGGERS, TRIGGERS.NETWORK_DISRUPTION];

/**
 * Build the discovery payload for Gladys.
 */
export function buildDiscoveredDevices(gladys, mobility) {
  const devices = mobility.stops.map((stop) => buildStopDevice(gladys, stop));
  if (mobility.config.monitor_network) {
    devices.push(buildNetworkDevice(gladys));
  }
  return devices;
}

/**
 * What a device external_id stands for: `{ kind: 'stop', stop }`,
 * `{ kind: 'network' }`, or null when it is not (or no longer) configured.
 */
export function resolveDevice(gladys, mobility, externalId) {
  const stop = mobility.stops.find((s) => stopIds(gladys, s).device === externalId);
  if (stop) {
    return { kind: 'stop', stop };
  }
  if (mobility.config.monitor_network && networkIds(gladys).device === externalId) {
    return { kind: 'network' };
  }
  return null;
}

// Gladys' poll ticks drift by a few milliseconds: a read due within the next
// half-minute runs now, so a 120 s interval does not slip to 180 s.
const POLL_TOLERANCE_MS = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES / 2;

/**
 * Create the `onPoll` dispatcher. Gladys polls every device once a minute; a
 * stop is read at the refresh interval of the configuration, the network
 * every 5 minutes at least. Resolves `true` when the device was read, `false`
 * when the poll was skipped. A read that throws is retried at the next poll.
 */
export function createPoller({ mobility, tracker, disruptionTracker }) {
  const lastReads = new Map();
  return async function pollDevice(gladys, device, now = Date.now()) {
    const target = resolveDevice(gladys, mobility, device.external_id);
    if (!target) {
      return false;
    }
    const intervalSeconds =
      target.kind === 'network'
        ? Math.max(NETWORK_MIN_INTERVAL_SECONDS, mobility.config.poll_frequency)
        : mobility.config.poll_frequency;
    const lastRead = lastReads.get(device.external_id);
    if (lastRead !== undefined && now - lastRead < intervalSeconds * 1000 - POLL_TOLERANCE_MS) {
      return false;
    }
    if (target.kind === 'network') {
      await pollNetwork(gladys, { mobility, disruptionTracker });
    } else {
      await pollStop(gladys, { mobility, tracker, stop: target.stop, now });
    }
    lastReads.set(device.external_id, now);
    return true;
  };
}
