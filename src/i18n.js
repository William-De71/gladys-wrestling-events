// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: calendar names, widget contents, connection status, scene action
// outputs. Vocabulary of the Gladys interface (calendrier / Kalender /
// calendario, scène / Szene / escena) and of the fans: "catch" in French,
// "lucha libre" in Spanish, "Wrestling" in German. Show names, venues and
// cards stay as TheSportsDB writes them (in English).
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const KIND_NAMES = {
  weekly: {
    en: 'Weekly TV show',
    fr: 'Émission hebdo',
    de: 'Wöchentliche TV-Show',
    es: 'Programa semanal',
  },
  tour: { en: 'Tour show', fr: 'Show de tournée', de: 'Tour-Show', es: 'Show de gira' },
  special: { en: 'Major event', fr: 'Grand événement', de: 'Großevent', es: 'Gran evento' },
};

const TEXTS = {
  // Calendars
  calendarName: {
    en: 'Wrestling – {promotion}',
    fr: 'Catch – {promotion}',
    de: 'Wrestling – {promotion}',
    es: 'Lucha libre – {promotion}',
  },
  calendarDescription: {
    en: 'Shows of {full}, from TheSportsDB.',
    fr: 'Les shows de {full}, d’après TheSportsDB.',
    de: 'Shows von {full}, laut TheSportsDB.',
    es: 'Shows de {full}, según TheSportsDB.',
  },
  postponedName: {
    en: '{name} (postponed)',
    fr: '{name} (reporté)',
    de: '{name} (verschoben)',
    es: '{name} (aplazado)',
  },
  eventFooter: {
    en: '{kind} · Source: TheSportsDB',
    fr: '{kind} · Source : TheSportsDB',
    de: '{kind} · Quelle: TheSportsDB',
    es: '{kind} · Fuente: TheSportsDB',
  },

  // Widgets
  postponed: { en: 'Postponed', fr: 'Reporté', de: 'Verschoben', es: 'Aplazado' },
  cardHeading: { en: 'Card:', fr: 'Carte :', de: 'Card:', es: 'Cartelera:' },
  cardUnknown: {
    en: 'The card is not announced yet.',
    fr: 'La carte n’est pas encore annoncée.',
    de: 'Die Card ist noch nicht angekündigt.',
    es: 'La cartelera aún no está anunciada.',
  },
  linkSportsDb: {
    en: 'On TheSportsDB',
    fr: 'Sur TheSportsDB',
    de: 'Auf TheSportsDB',
    es: 'En TheSportsDB',
  },
  linkVideo: { en: 'Video', fr: 'Vidéo', de: 'Video', es: 'Vídeo' },
  sourceCaption: {
    en: 'TheSportsDB · read at {time}',
    fr: 'TheSportsDB · lu à {time}',
    de: 'TheSportsDB · gelesen um {time}',
    es: 'TheSportsDB · leído a las {time}',
  },
  sourceCaptionNever: {
    en: 'TheSportsDB · not read yet',
    fr: 'TheSportsDB · pas encore lu',
    de: 'TheSportsDB · noch nicht gelesen',
    es: 'TheSportsDB · aún no leído',
  },
  noShow: {
    en: 'No show planned in the next {days} days.',
    fr: 'Aucun show prévu dans les {days} prochains jours.',
    de: 'Keine Show in den nächsten {days} Tagen geplant.',
    es: 'Ningún show previsto en los próximos {days} días.',
  },
  readingProgram: {
    en: 'Reading the program on TheSportsDB… (a few minutes with the free key)',
    fr: 'Lecture du programme sur TheSportsDB… (quelques minutes avec la clé gratuite)',
    de: 'Programm wird von TheSportsDB gelesen … (mit dem kostenlosen Schlüssel einige Minuten)',
    es: 'Leyendo el programa en TheSportsDB… (unos minutos con la clave gratuita)',
  },
  today: { en: 'Today', fr: 'Aujourd’hui', de: 'Heute', es: 'Hoy' },
  tomorrow: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  inDays: { en: '{days} days', fr: '{days} jours', de: '{days} Tage', es: '{days} días' },
  onNow: { en: 'On now', fr: 'En cours', de: 'Läuft', es: 'En directo' },
  inDaysHours: {
    en: '{days} d {hours} h',
    fr: '{days} j {hours} h',
    de: '{days} T {hours} h',
    es: '{days} d {hours} h',
  },
  inHoursMinutes: {
    en: '{hours} h {minutes} min',
    fr: '{hours} h {minutes} min',
    de: '{hours} h {minutes} min',
    es: '{hours} h {minutes} min',
  },
  inMinutes: { en: '{minutes} min', fr: '{minutes} min', de: '{minutes} min', es: '{minutes} min' },
  tileStarts: { en: 'Start', fr: 'Début', de: 'Beginn', es: 'Inicio' },
  tileDay: { en: 'No time yet', fr: 'Sans heure', de: 'Zeit offen', es: 'Sin hora' },
  tileAt: { en: 'at {time}', fr: 'à {time}', de: 'um {time}', es: 'a las {time}' },
  tileMatches: { en: 'Matches', fr: 'Matchs', de: 'Matches', es: 'Combates' },
  statusPromotion: { en: 'Promotion', fr: 'Fédération', de: 'Promotion', es: 'Empresa' },
  statusKind: { en: 'Kind', fr: 'Type', de: 'Art', es: 'Tipo' },
  statusVenue: { en: 'Venue', fr: 'Salle', de: 'Halle', es: 'Recinto' },
  statusCity: { en: 'City', fr: 'Ville', de: 'Stadt', es: 'Ciudad' },
  statusState: { en: 'State', fr: 'État', de: 'Status', es: 'Estado' },
  buttonDetails: { en: 'Details', fr: 'Détails', de: 'Details', es: 'Detalles' },

  // Scene action
  nextShowNone: {
    en: 'No show planned.',
    fr: 'Aucun show prévu.',
    de: 'Keine Show geplant.',
    es: 'Ningún show previsto.',
  },
  atTime: {
    en: '{date} at {time}',
    fr: '{date} à {time}',
    de: '{date} um {time}',
    es: '{date} a las {time}',
  },
  nextShowText: {
    en: 'Next show: {title}, {when}, {place}.',
    fr: 'Prochain show : {title}, {when}, {place}.',
    de: 'Nächste Show: {title}, {when}, {place}.',
    es: 'Próximo show: {title}, {when}, {place}.',
  },
  nextShowTextNoPlace: {
    en: 'Next show: {title}, {when}.',
    fr: 'Prochain show : {title}, {when}.',
    de: 'Nächste Show: {title}, {when}.',
    es: 'Próximo show: {title}, {when}.',
  },

  // Connection status (200 characters at most)
  statusOk: {
    en: '{count} shows to come for {promotions} promotion(s).',
    fr: '{count} shows à venir pour {promotions} fédération(s).',
    de: '{count} kommende Shows für {promotions} Promotion(s).',
    es: '{count} shows próximos para {promotions} empresa(s).',
  },
  statusReading: {
    en: 'Reading the program on TheSportsDB: {percent} % done.',
    fr: 'Lecture du programme sur TheSportsDB : {percent} % fait.',
    de: 'Programm wird von TheSportsDB gelesen: {percent} % erledigt.',
    es: 'Leyendo el programa en TheSportsDB: {percent} % hecho.',
  },
  statusPaused: {
    en: 'TheSportsDB asked to slow down: reading again at {time}.',
    fr: 'TheSportsDB demande de ralentir : reprise de la lecture à {time}.',
    de: 'TheSportsDB bittet um weniger Anfragen: weiter um {time}.',
    es: 'TheSportsDB pide ir más despacio: se reanuda a las {time}.',
  },
  statusKeyRefused: {
    en: 'TheSportsDB refuses the API key: check it in the configuration, or empty it to use the free key.',
    fr: 'TheSportsDB refuse la clé d’API : vérifiez-la dans la configuration, ou videz-la pour utiliser la clé gratuite.',
    de: 'TheSportsDB lehnt den API-Schlüssel ab: Prüfen Sie ihn in der Konfiguration oder leeren Sie ihn für den kostenlosen Schlüssel.',
    es: 'TheSportsDB rechaza la clave de API: revísela en la configuración, o vacíela para usar la clave gratuita.',
  },
  statusUnreachable: {
    en: 'TheSportsDB cannot be reached ({error}): next try in 15 minutes.',
    fr: 'TheSportsDB est injoignable ({error}) : nouvel essai dans 15 minutes.',
    de: 'TheSportsDB ist nicht erreichbar ({error}): neuer Versuch in 15 Minuten.',
    es: 'No se puede acceder a TheSportsDB ({error}): nuevo intento en 15 minutos.',
  },
};

const isLanguage = (value) => LANGUAGES.includes(value);

/**
 * @description A text in one language, its `{placeholders}` replaced.
 * @param {string} key - A TEXTS key.
 * @param {string} language - en, fr, de or es (English otherwise).
 * @param {object} [values] - The values of the placeholders.
 * @returns {string} The text.
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string} key - A TEXTS key.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description The name of a kind of show.
 * @param {string} kind - weekly, tour or special.
 * @param {string} language - The language.
 * @returns {string} "Weekly TV show".
 */
function kindName(kind, language) {
  const entry = KIND_NAMES[kind];
  if (!entry) {
    return String(kind ?? '');
  }
  return entry[isLanguage(language) ? language : 'en'] ?? entry.en;
}

/**
 * @description Cut a text to a length, with an ellipsis.
 * @param {unknown} value - The text.
 * @param {number} max - The maximum length.
 * @returns {string} The text, at most `max` characters.
 */
function truncate(value, max) {
  const text = String(value ?? '');
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export { LANGUAGES, KIND_NAMES, TEXTS, isLanguage, t, all, kindName, truncate };
