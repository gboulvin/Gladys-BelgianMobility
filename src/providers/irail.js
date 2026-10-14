// -----------------------------------------------------------------------------
// iRail: the open API of the Belgian railways (SNCB/NMBS), https://docs.irail.be
//
// Free, no account, no key. Used for the train stations: live departures
// (platform, delay, cancellation), the network disruptions and the journey
// planner. Fair use: 3 requests per second, a User-Agent identifying the app.
// -----------------------------------------------------------------------------

import { createHttpClient } from '../http.js';

const BASE_URL = 'https://api.irail.be/v1';

// iRail answers in English, French, Dutch or German.
const IRAIL_LANGUAGES = ['en', 'fr', 'nl', 'de'];

// The station list barely changes: one download a day is plenty.
const STATIONS_TTL_MS = 24 * 60 * 60 * 1000;

const SNCB_ID = /^BE\.NMBS\.(\d{9})$/i;

export function irailLanguage(language) {
  return IRAIL_LANGUAGES.includes(language) ? language : 'en';
}

/** "BE.NMBS.008863008" -> "008863008", or null for anything else. */
export function sncbStationNumber(id) {
  const match = SNCB_ID.exec(String(id));
  return match ? match[1] : null;
}

/** Lowercase, no accents, no punctuation: "Liège-Guillemins" -> "liege guillemins". */
export function normalizeName(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * @param {{ fetch?: typeof fetch }} [options]
 */
export function createIrailClient({ fetch } = {}) {
  const http = createHttpClient({ fetch, minIntervalMs: 350 });
  let stationsCache = null;

  function url(path, params) {
    const query = new URLSearchParams({ format: 'json', ...params });
    return `${BASE_URL}/${path}/?${query}`;
  }

  async function stations(language) {
    const lang = irailLanguage(language);
    if (stationsCache && stationsCache.lang === lang && stationsCache.expiresAt > Date.now()) {
      return stationsCache.list;
    }
    const body = await http.getJson(url('stations', { lang }));
    const list = (body.station ?? []).map((station) => ({
      id: station.id,
      name: station.name,
      standardName: station.standardname,
    }));
    stationsCache = { lang, list, expiresAt: Date.now() + STATIONS_TTL_MS };
    return list;
  }

  return {
    stations,

    /**
     * Find a station from a name typed by the user. Accepts the name in any
     * of the official languages ("Bruxelles-Central", "Brussel-Centraal").
     * @returns {Promise<{ id: string, name: string } | null>}
     */
    async findStation(name, language) {
      const wanted = normalizeName(name);
      const list = await stations(language);
      const names = (station) => [
        station.name,
        station.standardName,
        ...String(station.standardName ?? '').split('/'),
      ];
      return (
        list.find((station) => names(station).some((n) => n && normalizeName(n) === wanted)) ?? null
      );
    },

    /** Live departures of a station, normalized (see normalizeLiveboard). */
    async departures(stationId, language) {
      const body = await http.getJson(
        url('liveboard', { id: stationId, lang: irailLanguage(language), alerts: 'false' }),
      );
      return normalizeLiveboard(body);
    },

    /** Current disruptions and planned works of the SNCB network. */
    async disturbances(language) {
      const body = await http.getJson(
        url('disturbances', { lang: irailLanguage(language), lineBreakCharacter: ' ' }),
      );
      return normalizeDisturbances(body);
    },

    /**
     * Next train journeys between two stations (names or SNCB ids).
     * @param {{ from: string, to: string, time?: string, language?: string, results?: number }} query
     *   `time` is "HH:MM" (Belgian time), now when omitted.
     */
    async connections({ from, to, time, language, results = 3 }) {
      const params = { from, to, lang: irailLanguage(language), results, alerts: 'false' };
      if (time) {
        params.time = time.replace(':', '');
        params.timesel = 'departure';
      }
      const body = await http.getJson(url('connections', params));
      return normalizeConnections(body);
    },
  };
}

/**
 * iRail liveboard -> normalized departures.
 * `time` is the SCHEDULED departure (Unix seconds), `delay` in seconds.
 */
export function normalizeLiveboard(body) {
  const departures = body?.departures?.departure ?? [];
  return {
    stopName: body?.stationinfo?.name ?? body?.station ?? null,
    departures: departures.map((departure) => {
      const scheduledAt = Number(departure.time) * 1000;
      const delaySeconds = Number(departure.delay) || 0;
      const vehicle = departure.vehicleinfo?.shortname ?? departure.vehicle ?? '';
      const platform = departure.platform && departure.platform !== '?' ? departure.platform : null;
      return {
        id: departure.departureConnection ?? `${departure.vehicle}:${departure.time}`,
        line: departure.vehicleinfo?.type || vehicle.split(' ')[0] || 'SNCB',
        vehicle,
        mode: 'train',
        operator: 'SNCB',
        destination: departure.station ?? departure.direction?.name ?? '',
        scheduledAt,
        expectedAt: scheduledAt + delaySeconds * 1000,
        delayMinutes: Math.round(delaySeconds / 60),
        cancelled: departure.canceled === '1' || departure.canceled === 1,
        platform,
        platformChanged: platform !== null && departure.platforminfo?.normal === '0',
        realtime: true,
      };
    }),
  };
}

export function normalizeDisturbances(body) {
  return (body?.disturbance ?? []).map((disturbance) => ({
    // iRail's own `id` is only the position in the list: build a stable key.
    id: `${disturbance.type}:${disturbance.timestamp}:${disturbance.title}`,
    title: disturbance.title ?? '',
    description: disturbance.description ?? '',
    type: disturbance.type === 'planned' ? 'planned' : 'disturbance',
    publishedAt: Number(disturbance.timestamp) * 1000,
    // The widget only accepts https links.
    link: disturbance.link ? String(disturbance.link).replace(/^http:\/\//, 'https://') : null,
  }));
}

export function normalizeConnections(body) {
  return (body?.connection ?? []).map((connection) => {
    const departure = connection.departure ?? {};
    const arrival = connection.arrival ?? {};
    const departureAt = Number(departure.time) * 1000;
    const arrivalAt = Number(arrival.time) * 1000;
    return {
      from: departure.stationinfo?.name ?? departure.station ?? '',
      to: arrival.stationinfo?.name ?? arrival.station ?? '',
      departureAt,
      arrivalAt,
      departureDelayMinutes: Math.round((Number(departure.delay) || 0) / 60),
      arrivalDelayMinutes: Math.round((Number(arrival.delay) || 0) / 60),
      durationMinutes: Math.round((Number(connection.duration) || 0) / 60),
      transfers: Number(connection.vias?.number ?? 0),
      platform:
        departure.platform && departure.platform !== '?' ? String(departure.platform) : null,
      train: departure.vehicleinfo?.shortname ?? departure.vehicle ?? '',
      direction: departure.direction?.name ?? '',
      cancelled: departure.canceled === '1' || arrival.canceled === '1',
    };
  });
}
