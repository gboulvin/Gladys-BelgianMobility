// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults
// (they MUST match the manifest `default` values, see test/manifest.test.js),
// normalizes the received object and parses the list of followed stops.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './i18n.js';

export const DEFAULT_CONFIG = {
  // Followed stops, separated by `;` or new lines. Each entry is an SNCB
  // station name ("Namur"), an SNCB id ("BE.NMBS.008863008") or a stop
  // identifier returned by the "Search a stop" action ("be-stib_6"),
  // optionally followed by `|` and the lines to keep ("be-stib_6 | 1, 5").
  stops: '',
  // Language of the texts the integration writes itself (summaries published
  // as states, scene outputs, SNCB station names and disruptions).
  language: 'fr',
  // A departure delayed by at least this many minutes fires `departure_delayed`.
  delay_threshold: 5,
  // `departure_imminent` fires when a departure is this many minutes away
  // (0 turns the trigger off).
  imminent_minutes: 10,
  // Publish an "SNCB network" device with the current disruptions.
  monitor_network: true,
  // Seconds between two reads of a stop. Gladys polls at most once a minute:
  // slower intervals are applied by skipping polls (see src/devices/index.js).
  poll_frequency: 60,
};

const MIN_POLL_SECONDS = 60;

/**
 * Merge the user config with the defaults and force the types (a form can
 * send numbers as strings).
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_CONFIG.language;
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    stops: typeof raw.stops === 'string' ? raw.stops : DEFAULT_CONFIG.stops,
    language,
    delay_threshold: clampNumber(raw.delay_threshold, DEFAULT_CONFIG.delay_threshold, 1, 120),
    imminent_minutes: clampNumber(raw.imminent_minutes, DEFAULT_CONFIG.imminent_minutes, 0, 120),
    monitor_network: raw.monitor_network === undefined ? true : raw.monitor_network !== false,
    poll_frequency: clampNumber(
      raw.poll_frequency,
      DEFAULT_CONFIG.poll_frequency,
      MIN_POLL_SECONDS,
      3600,
    ),
  };
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

/**
 * Parse the `stops` field into entries.
 *   "Namur; be-stib_6 | 1, 5" -> [{ ref: 'Namur', lines: [] },
 *                                 { ref: 'be-stib_6', lines: ['1', '5'] }]
 * A stop listed twice with the same lines is kept once.
 * @param {string} text
 * @returns {{ ref: string, lines: string[] }[]}
 */
export function parseStopEntries(text = '') {
  const seen = new Set();
  const entries = [];
  for (const chunk of String(text).split(/[;\n]/)) {
    const [refPart, linesPart = ''] = chunk.split('|');
    const ref = refPart.trim();
    const lines = linesPart
      .split(',')
      .map((line) => line.trim())
      .filter(Boolean);
    const identity = `${ref}|${lines.join(',')}`.toLowerCase();
    if (!ref || seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    entries.push({ ref, lines });
  }
  return entries;
}
