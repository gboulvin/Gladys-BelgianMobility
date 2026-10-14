// -----------------------------------------------------------------------------
// Formatting helpers: the times are always shown in Belgian time, whatever the
// timezone of the container.
// -----------------------------------------------------------------------------

import { tl } from './i18n.js';

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Brussels',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 1791981900000 -> "14:45" (Europe/Brussels). */
export function formatTime(ms) {
  return TIME_FORMAT.format(new Date(ms));
}

/** Whole minutes from `now` until `ms`, never negative. */
export function minutesUntil(ms, now = Date.now()) {
  return Math.max(0, Math.floor((ms - now) / 60_000));
}

/** "IC 2113 → Luxembourg", "71 → Delta". */
export function departureTitle(departure) {
  const label = departure.mode === 'train' ? departure.vehicle : departure.line;
  return `${label} → ${departure.destination}`.trim();
}

/**
 * One line describing a departure, in one language, e.g.
 * "14:45 IC 2113 → Luxembourg, Voie 10, +20 min".
 */
export function departureSummary(departure, language) {
  const parts = [`${formatTime(departure.scheduledAt)} ${departureTitle(departure)}`];
  if (departure.platform) {
    parts.push(tl(language, platformKey(departure), { platform: departure.platform }));
  }
  if (departure.cancelled) {
    parts.push(tl(language, 'cancelled'));
  } else if (departure.delayMinutes > 0) {
    parts.push(tl(language, 'delay_badge', { minutes: departure.delayMinutes }));
  }
  return parts.join(', ');
}

/**
 * The message key naming the platform of a departure: a train leaves from a
 * track ("Voie 5"), a bus or a tram from a stop ("Quai 2").
 */
export function platformKey(departure) {
  if (departure.mode !== 'train') {
    return 'stop_platform';
  }
  return departure.platformChanged ? 'platform_changed' : 'platform';
}

/** Cut a text to `max` characters, with an ellipsis when it was longer. */
export function truncate(text, max) {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}
