// -----------------------------------------------------------------------------
// Dashboard widgets (Gladys 5.1+).
//
//   - `departures`: the departure board of one followed stop, picked in the
//     widget settings — live tiles for the next departure, then the list of
//     the coming departures with their delay or cancellation;
//   - `network_status`: the current disruptions and planned works of the SNCB
//     network.
//
// The content is declarative (text, value, status, card-list, button): the
// core renders it with its own theme and picks the language of every
// multi-language object. Each entry exposes `get` (onWidgetGet) and, for the
// widgets with a button, `action` (onWidgetAction).
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { departureTitle, formatTime, platformKey, truncate } from './format.js';
import { t } from './i18n.js';
import { resolveDevice } from './devices/index.js';
import { STOP_FEATURES, stopIds } from './devices/stop.js';
import { sortDisruptions } from './devices/network.js';

const logger = createLogger({ name: 'widgets' });

// Widget keys, as declared in the manifest `widgets` field.
export const DEPARTURES_WIDGET = 'departures';
export const NETWORK_WIDGET = 'network_status';

const DEPARTURES_ACTIONS = { REFRESH: 'refresh' };

const DEFAULT_COUNT = 5;
const MAX_LIST_ITEMS = 8;

function badgeOf(departure) {
  if (departure.cancelled) {
    return { text: t('cancelled'), color: WIDGET_COLORS.DANGER };
  }
  if (departure.delayMinutes > 0) {
    return {
      text: t('delay_badge', { minutes: departure.delayMinutes }),
      color: WIDGET_COLORS.WARNING,
    };
  }
  if (departure.realtime) {
    return { text: t('on_time'), color: WIDGET_COLORS.SUCCESS };
  }
  return { text: t('scheduled'), color: WIDGET_COLORS.NEUTRAL };
}

function subtitleOf(departure) {
  const time =
    departure.delayMinutes > 0 && !departure.cancelled
      ? `${formatTime(departure.scheduledAt)} → ${formatTime(departure.expectedAt)}`
      : formatTime(departure.scheduledAt);
  const platform = departure.platform
    ? t(platformKey(departure), { platform: departure.platform })
    : null;
  // One multi-language subtitle: the platform word is the only translated part.
  return Object.fromEntries(
    Object.keys(t('on_time')).map((language) => [
      language,
      [time, platform?.[language], departure.operator].filter(Boolean).join(' · '),
    ]),
  );
}

function message(key) {
  return { type: 'text', variant: 'body', text: t(key) };
}

function clampCount(value) {
  const count = Number(value ?? DEFAULT_COUNT);
  return Number.isFinite(count) ? Math.min(MAX_LIST_ITEMS, Math.max(1, Math.round(count))) : 5;
}

export const WIDGETS = {
  [DEPARTURES_WIDGET]: {
    async get(gladys, { settings = {}, mobility }) {
      logger.debug(`onWidgetGet <- ${DEPARTURES_WIDGET} (${settings.stop})`);
      const target = resolveDevice(gladys, mobility, settings.stop);
      if (!target || target.kind !== 'stop') {
        return { ttl_seconds: 300, components: [message('choose_stop')] };
      }
      const { stop } = target;
      const ids = stopIds(gladys, stop);
      const components = [
        { type: 'text', variant: 'heading', text: truncate(stop.stopName, 40) },
        // Live tiles: they follow the published states, nothing to refresh.
        {
          type: 'value',
          label: t('next_departure'),
          icon: 'clock',
          device_feature: ids.feature(STOP_FEATURES.NEXT_DEPARTURE),
        },
        {
          type: 'value',
          label: t('delay'),
          icon: 'alert-triangle',
          device_feature: ids.feature(STOP_FEATURES.NEXT_DELAY),
        },
      ];
      try {
        const { departures } = await mobility.departures(stop);
        const shown = departures.slice(0, clampCount(settings.count));
        if (shown.length === 0) {
          components.push(message('no_departure'));
        } else {
          components.push({
            type: 'card-list',
            display: 'list',
            items: shown.map((departure) => ({
              title: truncate(departureTitle(departure), 60),
              subtitle: subtitleOf(departure),
              badge: badgeOf(departure),
            })),
          });
        }
      } catch (err) {
        logger.warn(`Departures of ${stop.key} unavailable: ${err.message}`);
        components.push(message('departures_unavailable'));
      }
      components.push({
        type: 'button',
        label: t('refresh'),
        icon: 'refresh-cw',
        style: 'secondary',
        action: { key: DEPARTURES_ACTIONS.REFRESH, params: { stop: stop.key } },
      });
      // Departures move every minute: re-pulled as often.
      return { ttl_seconds: 60, components };
    },

    async action(gladys, { actionKey, params, mobility }) {
      logger.info(`onWidgetAction <- ${DEPARTURES_WIDGET}.${actionKey}`);
      if (actionKey === DEPARTURES_ACTIONS.REFRESH) {
        // The core refetches the content after a successful action: dropping
        // the cache makes that refetch read the API again.
        mobility.invalidate(params.stop);
        return t('refreshed');
      }
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  },

  [NETWORK_WIDGET]: {
    async get(gladys, { mobility }) {
      logger.debug(`onWidgetGet <- ${NETWORK_WIDGET}`);
      let disruptions;
      try {
        disruptions = sortDisruptions(await mobility.irail.disturbances(mobility.config.language));
      } catch (err) {
        logger.warn(`Network status unavailable: ${err.message}`);
        return { ttl_seconds: 120, components: [message('network_unavailable')] };
      }
      const current = disruptions.filter((disruption) => disruption.type !== 'planned');
      const planned = disruptions.length - current.length;
      const components = [
        {
          type: 'status',
          items: [
            {
              label: t('network_disturbances'),
              icon: 'alert-triangle',
              value: current.length,
              color: current.length > 0 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
            },
            {
              label: t('network_works'),
              icon: 'tool',
              value: planned,
              color: WIDGET_COLORS.INFO,
            },
          ],
        },
      ];
      if (disruptions.length === 0) {
        components.push(message('network_ok'));
      } else {
        components.push({
          type: 'card-list',
          display: 'list',
          items: disruptions.slice(0, MAX_LIST_ITEMS).map((disruption) => ({
            title: truncate(disruption.title, 60),
            ...(disruption.publishedAt
              ? { date: new Date(disruption.publishedAt).toISOString() }
              : {}),
            badge:
              disruption.type === 'planned'
                ? { text: t('badge_works'), color: WIDGET_COLORS.INFO }
                : { text: t('badge_disruption'), color: WIDGET_COLORS.WARNING },
            description: truncate(disruption.description, 2000),
            ...(disruption.link?.startsWith('https://')
              ? { links: [{ url: disruption.link, label: t('more_info') }] }
              : {}),
          })),
        });
      }
      return { ttl_seconds: 300, components };
    },
  },
};

/**
 * Ask the core to re-pull every widget now (after a (re)connection or a
 * configuration change), instead of waiting for the content TTL.
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
