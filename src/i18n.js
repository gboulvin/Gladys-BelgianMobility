// -----------------------------------------------------------------------------
// User-facing texts, in the four languages the integration speaks.
//
// Gladys picks the language of a multi-language object (`{ en, fr, de, es }`)
// itself, `en` being the fallback: every text the integration sends back
// (action messages, widget labels, connection status, toasts) is built here so
// no language is ever forgotten. test/i18n.test.js checks that every entry
// carries the four languages.
//
// Placeholders are written `{name}` and replaced by `t(key, vars)`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const MESSAGES = {
  // --- Connection status -----------------------------------------------------
  status_api_unreachable: {
    en: 'The public transport APIs cannot be reached: {error}',
    fr: 'Les API de transport en commun sont injoignables : {error}',
    de: 'Die ÖPNV-Schnittstellen sind nicht erreichbar: {error}',
    es: 'No se puede acceder a las API de transporte público: {error}',
  },
  status_unresolved_stops: {
    en: 'Unknown stops ignored: {stops}. Use the "Search a stop" action.',
    fr: "Arrêts inconnus ignorés : {stops}. Utilisez l'action « Rechercher un arrêt ».",
    de: 'Unbekannte Haltestellen ignoriert: {stops}. Nutzen Sie „Haltestelle suchen“.',
    es: 'Paradas desconocidas ignoradas: {stops}. Use la acción «Buscar una parada».',
  },
  status_no_stop: {
    en: 'No stop configured yet: add one in the "Stops to follow" field.',
    fr: 'Aucun arrêt configuré : ajoutez-en un dans le champ « Arrêts à suivre ».',
    de: 'Noch keine Haltestelle: fügen Sie eine unter „Haltestellen“ hinzu.',
    es: 'Ninguna parada configurada: añada una en el campo «Paradas a seguir».',
  },
  status_init_failed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, prüfen Sie die Logs der Integration.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },

  // --- Configuration screen actions ------------------------------------------
  search_no_result: {
    en: 'No stop found for "{query}". Try another spelling or a nearby town.',
    fr: 'Aucun arrêt trouvé pour « {query} ». Essayez une autre orthographe ou la commune.',
    de: 'Keine Haltestelle für „{query}“ gefunden. Andere Schreibweise oder Ort versuchen.',
    es: 'No se encontró ninguna parada para «{query}». Pruebe otra ortografía o la localidad.',
  },
  search_results: {
    en: 'Copy the identifier into "Stops to follow": {results}',
    fr: "Copiez l'identifiant dans « Arrêts à suivre » : {results}",
    de: 'Kopieren Sie die Kennung in „Haltestellen“: {results}',
    es: 'Copie el identificador en «Paradas a seguir»: {results}',
  },
  test_ok: {
    en: 'Connection OK: iRail (SNCB) and Transitous answer. {stops} stop(s) followed.',
    fr: 'Connexion OK : iRail (SNCB) et Transitous répondent. {stops} arrêt(s) suivi(s).',
    de: 'Verbindung OK: iRail (SNCB) und Transitous antworten. {stops} Haltestelle(n).',
    es: 'Conexión OK: iRail (SNCB) y Transitous responden. {stops} parada(s) seguida(s).',
  },
  test_failed: {
    en: 'Connection failed: {error}',
    fr: 'Échec de la connexion : {error}',
    de: 'Verbindung fehlgeschlagen: {error}',
    es: 'Error de conexión: {error}',
  },

  // --- Departures (widgets, scene summaries) ---------------------------------
  on_time: { en: 'On time', fr: "À l'heure", de: 'Pünktlich', es: 'Puntual' },
  scheduled: { en: 'Scheduled', fr: 'Théorique', de: 'Planmäßig', es: 'Programado' },
  cancelled: { en: 'Cancelled', fr: 'Supprimé', de: 'Entfällt', es: 'Cancelado' },
  delay_badge: {
    en: '+{minutes} min',
    fr: '+{minutes} min',
    de: '+{minutes} Min.',
    es: '+{minutes} min',
  },
  platform: {
    en: 'Platform {platform}',
    fr: 'Voie {platform}',
    de: 'Gleis {platform}',
    es: 'Vía {platform}',
  },
  stop_platform: {
    en: 'Stop {platform}',
    fr: 'Quai {platform}',
    de: 'Steig {platform}',
    es: 'Andén {platform}',
  },
  platform_changed: {
    en: 'Platform {platform} (changed)',
    fr: 'Voie {platform} (modifiée)',
    de: 'Gleis {platform} (geändert)',
    es: 'Vía {platform} (cambiada)',
  },
  next_departure: {
    en: 'Next departure',
    fr: 'Prochain départ',
    de: 'Nächste Abfahrt',
    es: 'Próxima salida',
  },
  delay: { en: 'Delay', fr: 'Retard', de: 'Verspätung', es: 'Retraso' },
  no_departure: {
    en: 'No departure in the coming hours.',
    fr: 'Aucun départ dans les prochaines heures.',
    de: 'Keine Abfahrt in den nächsten Stunden.',
    es: 'Ninguna salida en las próximas horas.',
  },
  departures_unavailable: {
    en: 'Departures unavailable right now, retrying soon.',
    fr: 'Départs indisponibles pour le moment, nouvel essai bientôt.',
    de: 'Abfahrten derzeit nicht verfügbar, neuer Versuch in Kürze.',
    es: 'Salidas no disponibles por ahora, se reintentará pronto.',
  },
  choose_stop: {
    en: 'Pick a followed stop in the settings of this widget.',
    fr: 'Choisissez un arrêt suivi dans les réglages de ce widget.',
    de: 'Wählen Sie in den Einstellungen dieses Widgets eine Haltestelle.',
    es: 'Elija una parada seguida en los ajustes de este widget.',
  },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  refreshed: {
    en: 'Departures refreshed.',
    fr: 'Départs actualisés.',
    de: 'Abfahrten aktualisiert.',
    es: 'Salidas actualizadas.',
  },

  // --- SNCB network status -----------------------------------------------------
  network_disturbances: {
    en: 'Disruptions',
    fr: 'Perturbations',
    de: 'Störungen',
    es: 'Incidencias',
  },
  network_works: {
    en: 'Planned works',
    fr: 'Travaux prévus',
    de: 'Geplante Bauarbeiten',
    es: 'Obras previstas',
  },
  network_normal: {
    en: 'Normal service',
    fr: 'Trafic normal',
    de: 'Normaler Betrieb',
    es: 'Servicio normal',
  },
  network_ok: {
    en: 'No disruption on the SNCB network right now.',
    fr: 'Aucune perturbation sur le réseau SNCB pour le moment.',
    de: 'Derzeit keine Störung im SNCB-Netz.',
    es: 'Ninguna incidencia en la red SNCB por ahora.',
  },
  network_unavailable: {
    en: 'Network status unavailable right now.',
    fr: 'État du réseau indisponible pour le moment.',
    de: 'Netzstatus derzeit nicht verfügbar.',
    es: 'Estado de la red no disponible por ahora.',
  },
  badge_disruption: { en: 'Disruption', fr: 'Perturbation', de: 'Störung', es: 'Incidencia' },
  badge_works: { en: 'Works', fr: 'Travaux', de: 'Bauarbeiten', es: 'Obras' },
  more_info: {
    en: 'More information',
    fr: "Plus d'informations",
    de: 'Mehr erfahren',
    es: 'Más información',
  },
  updated_at: { en: 'Updated', fr: 'Mis à jour', de: 'Aktualisiert', es: 'Actualizado' },
};

/**
 * Resolve a message as a multi-language object, placeholders substituted.
 * @param {keyof typeof MESSAGES} key
 * @param {Record<string, string | number>} [vars]
 * @returns {{ en: string, fr: string, de: string, es: string }}
 */
export function t(key, vars = {}) {
  const entry = MESSAGES[key];
  if (!entry) {
    throw new Error(`Unknown message key: ${key}`);
  }
  return Object.fromEntries(
    LANGUAGES.map((language) => [language, interpolate(entry[language], vars)]),
  );
}

/**
 * The text of a message in ONE language (states published as text, scene
 * outputs): `en` when the language is not one the integration speaks.
 */
export function tl(language, key, vars = {}) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  return t(key, vars)[lang];
}

function interpolate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    vars[name] === undefined ? match : String(vars[name]),
  );
}
