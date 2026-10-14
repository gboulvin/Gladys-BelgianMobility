// -----------------------------------------------------------------------------
// Device type: SNCB NETWORK
//
// One device for the whole Belgian rail network (when `monitor_network` is
// on): it shows the latest disruption and fires `network_disruption` for each
// new one. Read every 5 minutes at most, disruptions do not move faster.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { tl } from '../i18n.js';
import { truncate } from '../format.js';
import { TRIGGERS } from '../events.js';

export const NETWORK_DEVICE_TYPE = 'network';

// There is a single SNCB network: its id is fixed.
const PLATFORM_ID = 'sncb';

const logger = createLogger({ name: NETWORK_DEVICE_TYPE });

export const NETWORK_FEATURES = { LATEST_DISRUPTION: 'latest-disruption' };

export const NETWORK_MIN_INTERVAL_SECONDS = 300;

const HEARTBEAT_MS = 30 * 60 * 1000;
const MAX_TEXT_STATE = 255;
const MAX_EVENT_TEXT = 1000;

export function networkIds(gladys) {
  return gladys.externalIds(NETWORK_DEVICE_TYPE, PLATFORM_ID);
}

export function buildNetworkDevice(gladys) {
  const ids = networkIds(gladys);
  return {
    name: 'SNCB network',
    external_id: ids.device,
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: [
      {
        name: 'Latest disruption',
        external_id: ids.feature(NETWORK_FEATURES.LATEST_DISRUPTION),
        category: DEVICE_FEATURE_CATEGORIES.TEXT,
        type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
        read_only: true,
        has_feedback: false,
        keep_history: false,
      },
    ],
  };
}

/** Current disruptions first, planned works after, newest first. */
export function sortDisruptions(disruptions) {
  return [...disruptions].sort(
    (a, b) =>
      (a.type === 'planned') - (b.type === 'planned') ||
      (b.publishedAt || 0) - (a.publishedAt || 0),
  );
}

export function networkEventData(disruption) {
  return {
    type: disruption.type,
    title: truncate(disruption.title, MAX_EVENT_TEXT),
    description: truncate(disruption.description, MAX_EVENT_TEXT),
  };
}

export async function pollNetwork(gladys, { mobility, disruptionTracker }) {
  const { language } = mobility.config;
  const disruptions = sortDisruptions(await mobility.irail.disturbances(language));
  const current = disruptions.filter((disruption) => disruption.type !== 'planned');
  await gladys.publishChangedStates(
    [
      {
        device_feature_external_id: networkIds(gladys).feature(NETWORK_FEATURES.LATEST_DISRUPTION),
        text: truncate(current[0]?.title ?? tl(language, 'network_normal'), MAX_TEXT_STATE),
      },
    ],
    { heartbeat: HEARTBEAT_MS },
  );

  const fresh = disruptionTracker.track(disruptions);
  for (const disruption of fresh) {
    logger.info(`network_disruption: ${disruption.title}`);
    await gladys.publishSceneEvent(TRIGGERS.NETWORK_DISRUPTION, networkEventData(disruption));
  }
  return { disruptions, fresh };
}
