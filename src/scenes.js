// -----------------------------------------------------------------------------
// Scene actions (Gladys 5.1+).
//
// Operations a scene author places in a scene, declared in the manifest
// `scene_actions` field and handled here under the same key. Each handler
// receives the RESOLVED fields and returns the declared scalar outputs, which
// the following actions read (e.g. "send me a message: the {{line}} leaves in
// {{minutes}} min"). "Nothing found" is an output (`found: false`), never an
// error: a scene action is not a condition, the scene author gates on it.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { departureSummary, formatTime, minutesUntil, truncate } from './format.js';
import { tl } from './i18n.js';
import { resolveDevice } from './devices/index.js';
import { nextDeparture } from './devices/stop.js';
import { normalizeName } from './providers/irail.js';

const logger = createLogger({ name: 'scenes' });

const MAX_SUMMARY = 1000;
const SUMMARY_DEPARTURES = 3;

const TIME_FIELD = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export const SCENE_ACTIONS = {
  // Next departure of a followed stop, optionally of one line or towards one
  // destination.
  async get_next_departure(gladys, { fields, mobility, now = Date.now() }) {
    logger.info(`Scene action get_next_departure <- ${fields.device}`);
    const target = resolveDevice(gladys, mobility, fields.device);
    if (!target || target.kind !== 'stop') {
      throw new Error(`${fields.device} is not a followed stop`);
    }
    const { language } = mobility.config;
    const { departures } = await mobility.departures(target.stop);
    const wantedLine = String(fields.line ?? '')
      .trim()
      .toLowerCase();
    const wantedDestination = normalizeName(fields.destination ?? '');
    const matching = departures.filter(
      (departure) =>
        (!wantedLine ||
          [departure.line, departure.vehicle].some(
            (v) => String(v).toLowerCase() === wantedLine,
          )) &&
        (!wantedDestination || normalizeName(departure.destination).includes(wantedDestination)),
    );
    const next = nextDeparture(matching);
    if (!next) {
      return { found: false, summary: tl(language, 'no_departure') };
    }
    const summary = matching
      .slice(0, SUMMARY_DEPARTURES)
      .map((departure) => departureSummary(departure, language))
      .join('\n');
    return {
      found: true,
      line: next.line,
      vehicle: next.vehicle,
      destination: next.destination,
      operator: next.operator,
      departure_time: formatTime(next.expectedAt),
      scheduled_time: formatTime(next.scheduledAt),
      minutes: minutesUntil(next.expectedAt, now),
      delay_minutes: Math.max(0, next.delayMinutes),
      platform: next.platform ?? '',
      summary: truncate(summary, MAX_SUMMARY),
    };
  },

  // Next train between two SNCB stations (names or ids), now or at a time.
  async plan_train_journey(gladys, { fields, mobility }) {
    logger.info(`Scene action plan_train_journey <- ${fields.from} -> ${fields.to}`);
    const { language } = mobility.config;
    const time = String(fields.time ?? '').trim();
    if (time && !TIME_FIELD.test(time)) {
      throw new Error(`Invalid time "${time}", expected HH:MM`);
    }
    const connections = await mobility.irail.connections({
      from: fields.from,
      to: fields.to,
      time: time ? time.padStart(5, '0') : undefined,
      language,
    });
    const journey = connections.find((connection) => !connection.cancelled);
    if (!journey) {
      return { found: false, summary: tl(language, 'no_departure') };
    }
    const summary = connections
      .slice(0, SUMMARY_DEPARTURES)
      .map((connection) => journeySummary(connection, language))
      .join('\n');
    return {
      found: true,
      train: journey.train,
      departure_time: formatTime(journey.departureAt),
      arrival_time: formatTime(journey.arrivalAt + journey.arrivalDelayMinutes * 60_000),
      duration_minutes: journey.durationMinutes,
      transfers: journey.transfers,
      delay_minutes: Math.max(0, journey.departureDelayMinutes),
      platform: journey.platform ?? '',
      summary: truncate(summary, MAX_SUMMARY),
    };
  },

  // Is the SNCB network disrupted right now?
  async get_network_status(gladys, { mobility }) {
    logger.info('Scene action get_network_status');
    const { language } = mobility.config;
    const disruptions = await mobility.irail.disturbances(language);
    const current = disruptions.filter((disruption) => disruption.type !== 'planned');
    return {
      disrupted: current.length > 0,
      disruption_count: current.length,
      planned_works_count: disruptions.length - current.length,
      summary: truncate(
        current.length > 0
          ? current.map((disruption) => `• ${disruption.title}`).join('\n')
          : tl(language, 'network_ok'),
        MAX_SUMMARY,
      ),
    };
  },
};

function journeySummary(connection, language) {
  const parts = [
    `${formatTime(connection.departureAt)} → ${formatTime(connection.arrivalAt)} ${connection.train}`,
  ];
  if (connection.platform) {
    parts.push(tl(language, 'platform', { platform: connection.platform }));
  }
  if (connection.cancelled) {
    parts.push(tl(language, 'cancelled'));
  } else if (connection.departureDelayMinutes > 0) {
    parts.push(tl(language, 'delay_badge', { minutes: connection.departureDelayMinutes }));
  }
  return parts.join(', ');
}
