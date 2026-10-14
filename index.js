// -----------------------------------------------------------------------------
// Entry point of the Belgian Mobility integration for Gladys Assistant.
//
// This file only wires the SDK to the modules of src/: it registers every
// handler BEFORE connect(), then (re)initializes on each connection. The
// Gladys supervisor injects GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN and
// GLADYS_INTEGRATION_SELECTOR: `new GladysIntegration()` reads them.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { t } from './src/i18n.js';
import { createMobility } from './src/mobility.js';
import { createDepartureTracker, createDisruptionTracker } from './src/events.js';
import { buildDiscoveredDevices, createPoller } from './src/devices/index.js';
import { ACTIONS } from './src/actions.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();
const mobility = createMobility();
const tracker = createDepartureTracker();
const disruptionTracker = createDisruptionTracker();

// When an API cannot be reached at startup, try again a bit later.
const RETRY_DELAY_MS = 2 * 60 * 1000;
let retryTimer = null;

// --- Discovery ----------------------------------------------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing the followed stops');
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, mobility));
});

// --- Polling --------------------------------------------------------------------
// Gladys polls each device once a minute; the poller reads the APIs at the
// refresh interval of the configuration.
const pollDevice = createPoller({ mobility, tracker, disruptionTracker });
gladys.onPoll(async (device) => {
  if (!(await pollDevice(gladys, device))) {
    logger.debug(`onPoll skipped (not due) for ${device.external_id}`);
  }
});

// --- Configuration screen buttons ----------------------------------------------
for (const [key, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(key, (fields) => handler(gladys, { fields, mobility }));
}

// --- Scene actions ----------------------------------------------------------------
for (const [key, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(key, (fields) => handler(gladys, { fields, mobility }));
}

// --- Dashboard widgets ------------------------------------------------------------
for (const [key, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(key, (request) => widget.get(gladys, { ...request, mobility }));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(key, (actionKey, params, { settings }) =>
      widget.action(gladys, { actionKey, params, settings, mobility }),
    );
  }
}

// --- Configuration updated by the user --------------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  await initialize(newConfig);
});

// --- Connection lifecycle -----------------------------------------------------------
gladys.on('connected', async () => {
  try {
    await initialize(await gladys.getConfig());
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys.setConnectionStatus(false, t('status_init_failed')).catch(() => {});
  }
});

gladys.on('disconnected', () => {
  clearRetry();
});

/**
 * Resolve the followed stops, publish them and report the status. An
 * unreachable API is reported and retried; an unknown stop is only reported.
 */
async function initialize(rawConfig) {
  clearRetry();
  try {
    await mobility.load(rawConfig);
  } catch (err) {
    logger.error('The public transport APIs cannot be reached', err);
    await gladys.setConnectionStatus(false, t('status_api_unreachable', { error: err.message }));
    retryTimer = setTimeout(() => {
      initialize(rawConfig).catch((retryErr) => logger.error('Retry failed', retryErr));
    }, RETRY_DELAY_MS);
    return;
  }
  // A new configuration may change the thresholds: start the event memory
  // over rather than firing what the previous one did not.
  tracker.reset();
  disruptionTracker.reset();

  // publishDiscoveredDevices is an upsert by external_id: the stops removed
  // from the configuration simply stop being polled.
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, mobility));
  refreshWidgets(gladys);

  if (mobility.unresolved.length > 0) {
    await gladys.setConnectionStatus(
      true,
      t('status_unresolved_stops', { stops: mobility.unresolved.join(', ') }),
    );
  } else if (mobility.stops.length === 0) {
    await gladys.setConnectionStatus(true, t('status_no_stop'));
  } else {
    await gladys.setConnectionStatus(true);
  }
}

function clearRetry() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

// --- Graceful shutdown ----------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
  clearRetry();
});

// --- Startup --------------------------------------------------------------------
logger.info('Starting the Belgian Mobility integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
