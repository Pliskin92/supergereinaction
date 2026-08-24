// Local highscore table, persisted per browser.
//
// The title screen reads this. Nothing writes to it yet: scoring belongs to
// the story mode, which is still a 404 placeholder (web/game/), so
// saveHighscore() is the ready-made entry point for when that lands.

const HIGHSCORE_KEY = 'supergere.highscores';
const HIGHSCORE_MAX = 8;

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch (e) { /* unreadable or unavailable; start empty */ }
  return [];
}

function saveHighscore(name, score) {
  const list = loadHighscores();
  list.push({ name: String(name || '???').slice(0, 8).toUpperCase(), score: score | 0 });
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, HIGHSCORE_MAX);
  try {
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(trimmed));
  } catch (e) { /* storage unavailable; score stays session-only */ }
  return trimmed;
}
