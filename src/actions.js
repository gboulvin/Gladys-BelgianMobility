// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen.
//
//   - `search_stop`: find the identifier of a stop to paste in the `stops`
//     field (every Belgian operator, through Transitous);
//   - `test_connection`: check that both APIs answer.
//
// The resolved multi-language message is displayed under the button.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { t } from './i18n.js';

const logger = createLogger({ name: 'actions' });

const MAX_RESULTS = 6;

export const ACTIONS = {
  async search_stop(gladys, { fields, mobility }) {
    const query = String(fields.query ?? '').trim();
    logger.info(`Action search_stop <- "${query}"`);
    if (!query) {
      return t('search_no_result', { query });
    }
    const stops = await mobility.transitous.searchStops(query, mobility.config.language);
    if (stops.length === 0) {
      return t('search_no_result', { query });
    }
    const results = stops
      .slice(0, MAX_RESULTS)
      .map(
        (stop) =>
          `${stop.name}${stop.modes.length ? ` (${stop.modes.join(', ')})` : ''} → ${stop.id}`,
      )
      .join(' ; ');
    return t('search_results', { results });
  },

  async test_connection(gladys, { mobility }) {
    logger.info('Action test_connection');
    try {
      await Promise.all([
        mobility.irail.stations(mobility.config.language),
        mobility.transitous.searchStops('Bruxelles', 'en'),
      ]);
    } catch (err) {
      return t('test_failed', { error: err.message });
    }
    return t('test_ok', { stops: mobility.stops.length });
  },
};
