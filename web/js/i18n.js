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
    level1Title: 'LEVEL 1 — THE STREET',
    loading: 'LOADING...',
    difficulty: 'DIFFICULTY',
    exhausted: 'GERE IS EXHAUSTED!',
    comeback: "GERE'S BACK!!!",
    gameOver: 'GAME OVER',
    gameOverHint: 'ENTER TO RESTART',
    // Shown in place of the boss's name while it is untouchable.
    bossShielded: 'SHIELDED!',
    // Kept identical in both languages: they are the cartoon title cards.
    furyOn: 'SUPER GERE TRANSFORMATION!!',
    furyOff: 'SUPER GERE IS OFF! :(',
    gymTitle: 'GYM — FREE PLAY',
    controls: 'WASD/ARROWS MOVE · J PUNCH · K ROLL · L HEAVY · SPACE JUMP',
    resetSack: 'R RESET SACK · F FURY',
    // Scoring / end of run.
    score: 'SCORE',
    combo: 'COMBO',
    levelClear: 'LEVEL CLEAR!',
    finalScore: 'FINAL SCORE',
    timeBonus: 'TIME BONUS',
    livesBonus: 'LIVES BONUS',
    newRecord: 'NEW RECORD!',
    enterName: 'TYPE YOUR NAME + ENTER',
    continueHint: 'ENTER TO CONTINUE',
    // Difficulty names, looked up by key from Difficulties.
    diffEasy: 'EASY',
    diffMedium: 'MEDIUM',
    diffHard: 'HARD',
    diffHell: 'HELL',
    // Opening cutscene. The dialogue is Italian in BOTH languages -- the
    // characters are Italian and the shouts are performance, not UI. Only
    // the chrome (the skip prompt and the level card) is translated.
    // The exchange, in order. Meeottee taunts, Roger refuses, Meeottee
    // knocks him down and gloats, then calls Gere out by name; Roger, on
    // the ground, manages one last plea.
    introTaunt: 'E FINITA, ROGER. NON PUOI SALVARTI.',
    introDefy: 'MIO FIGLIO TI FERMERA!',
    introMock: 'NESSUNO TI SENTE QUAGGIU.',
    introDefeat: 'SAN GIORGIO E MIA. PER SEMPRE.',
    introCall: 'MI SENTI, GERE? TUO PADRE E A TERRA!',
    introSave: 'GERE... SALVAMI!',
    // Gere's answer, thrown at a villain who cannot hear it, and the line
    // he leaves on.
    introVow: 'MR. MEEOTTEE! ORA HAI PROPRIO ESAGERATO!!!',
    introComing: 'PAPA, STO ARRIVANDO!',
    introSkip: 'ENTER TO SKIP',
    introRoger: 'ROGER',
    introVillain: 'MR. MEEOTTEE',
    introGere: 'GERE',
    levelStart: 'LEVEL 1 - START!',
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
    difficulty: 'DIFFICOLTA',
    exhausted: 'GERE E ESAUSTO!',
    comeback: 'GERE E TORNATO!!!',
    gameOver: 'GAME OVER',
    gameOverHint: 'INVIO PER RICOMINCIARE',
    bossShielded: 'INVULNERABILE!',
    furyOn: 'SUPER GERE TRANSFORMATION!!',
    furyOff: 'SUPER GERE IS OFF! :(',
    gymTitle: 'PALESTRA — GIOCO LIBERO',
    controls: 'WASD/FRECCE MUOVI · J PUGNO · K ROTOLA · L POTENTE · SPAZIO SALTO',
    resetSack: 'R RIPRISTINA SACCO · F FURIA',
    score: 'PUNTI',
    combo: 'COMBO',
    levelClear: 'LIVELLO COMPLETATO!',
    finalScore: 'PUNTEGGIO FINALE',
    timeBonus: 'BONUS TEMPO',
    livesBonus: 'BONUS VITE',
    newRecord: 'NUOVO RECORD!',
    enterName: 'SCRIVI IL TUO NOME + INVIO',
    continueHint: 'INVIO PER CONTINUARE',
    diffEasy: 'FACILE',
    diffMedium: 'MEDIA',
    diffHard: 'DIFFICILE',
    diffHell: 'INFERNO',
    // The dialogue is Italian in BOTH languages -- the characters are
    // Italian and the shouts are performance, not UI. Only the chrome
    // (the skip prompt and the level card) is translated.
    // The exchange, in order. Meeottee taunts, Roger refuses, Meeottee
    // knocks him down and gloats, then calls Gere out by name; Roger, on
    // the ground, manages one last plea.
    introTaunt: 'E FINITA, ROGER. NON PUOI SALVARTI.',
    introDefy: 'MIO FIGLIO TI FERMERA!',
    introMock: 'NESSUNO TI SENTE QUAGGIU.',
    introDefeat: 'SAN GIORGIO E MIA. PER SEMPRE.',
    introCall: 'MI SENTI, GERE? TUO PADRE E A TERRA!',
    introSave: 'GERE... SALVAMI!',
    introVow: 'MR. MEEOTTEE! ORA HAI PROPRIO ESAGERATO!!!',
    introComing: 'PAPA, STO ARRIVANDO!',
    introSkip: 'INVIO PER SALTARE',
    introRoger: 'ROGER',
    introVillain: 'MR. MEEOTTEE',
    introGere: 'GERE',
    levelStart: 'LIVELLO 1 - VIA!',
  },
};

// Difficulty is purely how many lives a run starts with. Stored in
// Settings so the title screen and the level agree without either having
// to know about the other.
const Difficulties = {
  easy: { labelKey: 'diffEasy', lives: 10 },
  medium: { labelKey: 'diffMedium', lives: 5 },
  hard: { labelKey: 'diffHard', lives: 2 },
  hell: { labelKey: 'diffHell', lives: 1 },
};
const DEFAULT_DIFFICULTY = 'medium';

// Lives for the chosen difficulty, falling back to the default if the
// stored value is missing or no longer a known setting.
function difficultyLives() {
  const d = Difficulties[Settings.difficulty] || Difficulties[DEFAULT_DIFFICULTY];
  return d.lives;
}

// Translated name of the chosen difficulty. Call sites used to read
// `.label` directly, which was English whatever the language was set to.
function difficultyLabel(key) {
  const d = Difficulties[key || Settings.difficulty] || Difficulties[DEFAULT_DIFFICULTY];
  return t(d.labelKey);
}

const SETTINGS_KEY = 'supergere.settings';

function loadSettings() {
  // Browsers with site data blocked throw on access rather than returning
  // null, so this has to be guarded, not just null-checked.
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      // Settings saved before difficulty existed have no such key.
      if (!stored.difficulty) stored.difficulty = DEFAULT_DIFFICULTY;
      return stored;
    }
  } catch (e) { /* no stored settings available */ }
  return { lang: 'it', difficulty: DEFAULT_DIFFICULTY };
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
