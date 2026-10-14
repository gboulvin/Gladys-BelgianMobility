// -----------------------------------------------------------------------------
// Transitous: the community-run, open public transport API of Europe,
// https://transitous.org — built on the official open data feeds of every
// Belgian operator (STIB/MIVB, De Lijn, TEC, SNCB/NMBS), with real-time
// updates where the operator publishes them.
//
// Free, no account, no key. Used for the stops of the buses, trams and metros
// and for the stop search. Fair use: a User-Agent identifying the app.
// -----------------------------------------------------------------------------

import { createHttpClient } from '../http.js';

const BASE_URL = 'https://api.transitous.org/api/v1';

// A Transitous stop identifier: "<feed>_<stop id>", e.g. "be-stib_6",
// "be-delijn_gs:delijn:200780", "be-tec_tec:s-charleroipalaism".
const STOP_ID = /^[a-z]{2}-[a-z0-9-]+_\S+$/i;

export function isTransitousStopId(ref) {
  return STOP_ID.test(String(ref));
}

// Transitous route modes -> the five families the integration exposes.
const MODES = {
  SUBWAY: 'metro',
  METRO: 'metro',
  TRAM: 'tram',
  CABLE_CAR: 'tram',
  BUS: 'bus',
  COACH: 'bus',
  FERRY: 'other',
};

// The agency names of the feeds, as travellers know them.
const OPERATOR_NAMES = { LETEC: 'TEC', 'NMBS/SNCB': 'SNCB' };

export function operatorName(agency) {
  return OPERATOR_NAMES[agency] ?? agency ?? '';
}

export function familyOfMode(mode) {
  if (MODES[mode]) {
    return MODES[mode];
  }
  return /RAIL|SUBURBAN/.test(String(mode)) ? 'train' : 'other';
}

/**
 * @param {{ fetch?: typeof fetch }} [options]
 */
export function createTransitousClient({ fetch } = {}) {
  const http = createHttpClient({ fetch, minIntervalMs: 200 });

  return {
    /**
     * Search stops by name. Belgian stops first, and only them when there is
     * at least one.
     * @returns {Promise<{ id: string, name: string, modes: string[] }[]>}
     */
    async searchStops(text, language = 'en') {
      const query = new URLSearchParams({ text, type: 'STOP', language });
      const body = await http.getJson(`${BASE_URL}/geocode?${query}`);
      const stops = (Array.isArray(body) ? body : [])
        .filter((match) => match.type === 'STOP' && match.id)
        .map((match) => ({
          id: match.id,
          name: match.name,
          belgian: match.country === 'BE' || String(match.id).startsWith('be-'),
          modes: [...new Set((match.modes ?? []).map(familyOfMode))],
        }));
      const belgian = stops.filter((stop) => stop.belgian);
      return (belgian.length > 0 ? belgian : stops).map(({ belgian: _belgian, ...stop }) => stop);
    },

    /**
     * Next departures of a stop (and of its platforms when it is a parent
     * station), normalized.
     */
    async departures(stopId, { count = 30 } = {}) {
      const query = new URLSearchParams({ stopId, n: String(count) });
      const body = await http.getJson(`${BASE_URL}/stoptimes?${query}`);
      return normalizeStopTimes(body);
    },
  };
}

/**
 * Transitous stoptimes -> normalized departures. `place.departure` is the
 * expected time (real-time when `realTime` is true), `scheduledDeparture` the
 * timetable one.
 */
export function normalizeStopTimes(body) {
  const stopTimes = Array.isArray(body?.stopTimes) ? body.stopTimes : [];
  const departures = stopTimes
    // The last stop of a trip is an arrival, nobody can board there.
    .filter((stopTime) => stopTime.place?.pickupType !== 'NOT_ALLOWED')
    .map((stopTime) => {
      const place = stopTime.place ?? {};
      const scheduledAt = Date.parse(place.scheduledDeparture ?? place.scheduledArrival);
      const expectedAt = Date.parse(place.departure ?? place.arrival) || scheduledAt;
      const platform = place.track ?? place.scheduledTrack ?? null;
      const line = stopTime.routeShortName || stopTime.displayName || stopTime.routeLongName || '';
      return {
        id: stopTime.tripId ?? `${line}:${scheduledAt}`,
        line,
        vehicle: stopTime.tripShortName ? `${line} ${stopTime.tripShortName}`.trim() : line,
        mode: familyOfMode(stopTime.mode),
        operator: operatorName(stopTime.agencyName),
        destination: prettyHeadsign(stopTime.headsign ?? ''),
        scheduledAt,
        expectedAt,
        delayMinutes: Math.round((expectedAt - scheduledAt) / 60_000),
        cancelled: Boolean(stopTime.cancelled || stopTime.tripCancelled || place.cancelled),
        platform: platform ? String(platform) : null,
        platformChanged: Boolean(
          place.track && place.scheduledTrack && place.track !== place.scheduledTrack,
        ),
        realtime: Boolean(stopTime.realTime),
      };
    })
    .filter((departure) => Number.isFinite(departure.scheduledAt));
  return {
    stopName: stopTimes[0]?.place?.name ?? body?.place?.name ?? null,
    departures,
  };
}

// STIB writes its headsigns in capitals ("GARE DE L'OUEST"): make them read
// like the other operators' ("Gare De L'Ouest").
function prettyHeadsign(headsign) {
  if (headsign !== headsign.toUpperCase()) {
    return headsign;
  }
  return headsign
    .toLowerCase()
    .replace(/(^|[\s\-'(/])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());
}
