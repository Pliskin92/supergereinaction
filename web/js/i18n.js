// UI strings, keyed by language. The Options menu currently exposes
// language only, so this is the whole settings surface for now.
//
// The game's own title is Italian, so 'it' is the default. Any key missing
// from a language falls back to English rather than rendering blank.

const Languages = {
  en: 'English',
  it: 'Italiano',
};

const Strings = {
  en: {
    newGame: 'NEW GAME',
    arena: 'ARENA',
    highscores: 'HIGHSCORES',
    options: 'OPTIONS',
    back: 'BACK',
    language: 'Language',
    selectHint: 'ARROWS + ENTER',
    noScores: 'NO SCORES YET',
    fury: 'FURY',
    // Kept in English in both languages: they are the cartoon title cards.
    level1Title: 'LIVELLO 1 — LA STRADA',
    loading: 'CARICAMENTO...',
    furyOn: 'SUPER GERE TRANSFORMATION!!',
    furyOff: 'SUPER GERE IS OFF! :(',
    gymTitle: 'GYM — FREE PLAY',
    controls: 'WASD/ARROWS MOVE · J PUNCH · K ROLL · L HEAVY · SPACE JUMP',
    resetSack: 'R RESET SACK · F FURY',
  },
  it: {
    newGame: 'NUOVA PARTITA',
    arena: 'ARENA',
    highscores: 'PUNTEGGI',
    options: 'OPZIONI',
    back: 'INDIETRO',
    language: 'Lingua',
    selectHint: 'FRECCE + INVIO',
    noScores: 'NESSUN PUNTEGGIO',
    fury: 'FURIA',
    level1Title: 'LIVELLO 1 — LA STRADA',
    loading: 'CARICAMENTO...',
    furyOn: 'SUPER GERE TRANSFORMATION!!',
    furyOff: 'SUPER GERE IS OFF! :(',
    gymTitle: 'PALESTRA — GIOCO LIBERO',
    controls: 'WASD/FRECCE MUOVI · J PUGNO · K ROTOLA · L POTENTE · SPAZIO SALTO',
    resetSack: 'R RIPRISTINA SACCO · F FURIA',
  },
};

const SETTINGS_KEY = 'supergere.settings';

function loadSettings() {
  // Browsers with site data blocked throw on access rather than returning
  // null, so this has to be guarded, not just null-checked.
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* no stored settings available */ }
  return { lang: 'it' };
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) { /* storage unavailable; settings stay session-only */ }
}

const Settings = loadSettings();

// Falls back to English for any key a translation hasn't defined yet.
function t(key) {
  const lang = Strings[Settings.lang] ? Settings.lang : 'en';
  const value = Strings[lang][key];
  return value !== undefined ? value : Strings.en[key];
}

// Whole-table accessor for call sites that want to pass `strings` down
// (drawFuryBar, FuryPopup.follow) instead of calling t() per key.
function strings() {
  return new Proxy({}, { get: (_, key) => t(key) });
}
