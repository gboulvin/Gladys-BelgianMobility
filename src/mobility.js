// -----------------------------------------------------------------------------
// The integration's state: the configuration, the followed stops resolved
// from it, and the departures of those stops (cached briefly, so a poll, a
// widget and a scene action asking at the same time cost one API call).
//
// A followed stop is served by one of two providers:
//   - iRail      for the SNCB/NMBS train stations (platforms, delays);
//   - Transitous for every other stop (STIB/MIVB, De Lijn, TEC...).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, parseStopEntries } from './config.js';
import { createIrailClient, sncbStationNumber } from './providers/irail.js';
import { createTransitousClient, isTransitousStopId } from './providers/transitous.js';

const logger = createLogger({ name: 'mobility' });

export const PROVIDERS = { IRAIL: 'irail', TRANSITOUS: 'transitous' };

// How long fetched departures are reused.
const DEPARTURES_TTL_MS = 30_000;

// A departure that left more than this long ago is no longer shown.
const DEPARTED_GRACE_MS = 30_000;

// Transitous lists the trips of every line of a stop: ask for more of them
// when only some lines are kept.
const TRANSITOUS_COUNT = 30;
const TRANSITOUS_COUNT_FILTERED = 100;

// "be-sncb_S8863008" (a Transitous id of an SNCB station) -> iRail's id.
const TRANSITOUS_SNCB_ID = /^be-sncb_S?(\d{7})$/i;

/** Characters allowed in the platform part of an external id. */
export function sanitizeId(value) {
  return String(value)
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Does a departure belong to one of the lines the user kept? */
export function matchesLines(departure, lines) {
  if (!lines || lines.length === 0) {
    return true;
  }
  const candidates = [departure.line, departure.vehicle, String(departure.vehicle).split(' ')[0]]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return lines.some((line) => candidates.includes(String(line).toLowerCase()));
}

/**
 * @param {{ fetch?: typeof fetch, now?: () => number }} [options]
 */
export function createMobility({ fetch, now = () => Date.now() } = {}) {
  const irail = createIrailClient({ fetch });
  const transitous = createTransitousClient({ fetch });

  let config = normalizeConfig();
  let stops = [];
  let unresolved = [];
  const cache = new Map();

  async function resolveStop({ ref, lines }) {
    const suffix = lines.length > 0 ? `~${sanitizeId(lines.join('-'))}` : '';
    const linesLabel = lines.length > 0 ? ` – ${lines.join(', ')}` : '';

    // 1. An SNCB station, by id (iRail's, or Transitous' for the same station).
    const transitousSncb = TRANSITOUS_SNCB_ID.exec(ref);
    const sncbNumber = transitousSncb ? `00${transitousSncb[1]}` : sncbStationNumber(ref);
    if (sncbNumber) {
      const id = `BE.NMBS.${sncbNumber}`;
      const station = (await irail.stations(config.language)).find((s) => s.id === id);
      return irailStop(id, station?.name ?? ref);
    }

    // 2. Any other stop, by its Transitous id.
    if (isTransitousStopId(ref)) {
      let name = ref;
      let operators = [];
      try {
        const { stopName, departures } = await transitous.departures(ref, { count: 10 });
        name = stopName ?? ref;
        operators = [...new Set(departures.map((d) => d.operator).filter(Boolean))];
      } catch (err) {
        logger.warn(`Could not read the name of the stop ${ref}: ${err.message}`);
      }
      const operatorLabel = operators.length > 0 ? ` (${operators.join(', ')})` : '';
      return {
        key: `${sanitizeId(ref)}${suffix}`,
        ref,
        provider: PROVIDERS.TRANSITOUS,
        providerId: ref,
        name: `${name}${operatorLabel}${linesLabel}`,
        stopName: name,
        lines,
      };
    }

    // 3. An SNCB station, by name.
    const station = await irail.findStation(ref, config.language);
    return station ? irailStop(station.id, station.name) : null;

    function irailStop(id, name) {
      return {
        key: `sncb-${sncbStationNumber(id)}${suffix}`,
        ref,
        provider: PROVIDERS.IRAIL,
        providerId: id,
        name: `${name} (SNCB)${linesLabel}`,
        stopName: name,
        lines,
      };
    }
  }

  async function fetchDepartures(stop) {
    if (stop.provider === PROVIDERS.IRAIL) {
      return irail.departures(stop.providerId, config.language);
    }
    const count = stop.lines.length > 0 ? TRANSITOUS_COUNT_FILTERED : TRANSITOUS_COUNT;
    return transitous.departures(stop.providerId, { count });
  }

  return {
    irail,
    transitous,

    get config() {
      return config;
    },
    get stops() {
      return stops;
    },
    /** References of the configured entries that match no stop. */
    get unresolved() {
      return unresolved;
    },

    /**
     * Apply a new configuration: resolve the followed stops. Rejects when an
     * API cannot be reached (the caller retries later); an entry that matches
     * no stop is only reported in `unresolved`.
     */
    async load(rawConfig) {
      config = normalizeConfig(rawConfig);
      const resolved = [];
      const missing = [];
      for (const entry of parseStopEntries(config.stops)) {
        const stop = await resolveStop(entry);
        if (!stop) {
          missing.push(entry.ref);
        } else if (!resolved.some((other) => other.key === stop.key)) {
          resolved.push(stop);
        }
      }
      stops = resolved;
      unresolved = missing;
      cache.clear();
      logger.info(
        `${stops.length} stop(s) followed` +
          (missing.length > 0 ? `, unknown: ${missing.join(', ')}` : ''),
      );
      return { stops, unresolved };
    },

    stopByKey(key) {
      return stops.find((stop) => stop.key === key) ?? null;
    },

    /**
     * Upcoming departures of a followed stop, line filter applied, sorted by
     * expected time. Cached for 30 s unless `force` is set.
     * @returns {Promise<{ stopName: string, departures: object[], fetchedAt: number }>}
     */
    async departures(stop, { force = false } = {}) {
      let entry = cache.get(stop.key);
      if (force || !entry || now() - entry.at >= DEPARTURES_TTL_MS) {
        const fresh = { at: now(), promise: fetchDepartures(stop) };
        fresh.promise.catch(() => {
          // A failed call is not cached: the next caller tries again.
          if (cache.get(stop.key) === fresh) {
            cache.delete(stop.key);
          }
        });
        cache.set(stop.key, fresh);
        entry = fresh;
      }
      const result = await entry.promise;
      const limit = now() - DEPARTED_GRACE_MS;
      return {
        stopName: result.stopName ?? stop.stopName,
        fetchedAt: entry.at,
        departures: result.departures
          .filter((departure) => departure.expectedAt >= limit)
          .filter((departure) => matchesLines(departure, stop.lines))
          .sort((a, b) => a.expectedAt - b.expectedAt),
      };
    },

    /** Forget the cached departures (all stops, or one). */
    invalidate(stopKey) {
      if (stopKey) {
        cache.delete(stopKey);
      } else {
        cache.clear();
      }
    },
  };
}
