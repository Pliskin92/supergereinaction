// Title screen: New Game / Arena / Highscores / Options, drawn to a canvas
// so the menu matches the game's own look rather than being DOM chrome.
//
// The screen is a tiny state machine (MENU -> submenu -> back), driven by
// the arrow keys and Enter. New Game and Arena navigate to their own pages;
// Highscores and Options are submenus handled entirely in here.

const TitleScreen = {
  MENU: 'menu',
  SCORES: 'scores',
  OPTIONS: 'options',
};

// The base menu. CONTINUE is inserted ahead of it when a run is in
// progress, so the entry is only ever shown when it does something.
const MENU_ITEMS = ['newGame', 'arena', 'highscores', 'options'];

// True when a run was left part-played in this tab. Guarded so the title
// screen still works if campaign.js is not loaded (it is, but the menu
// should not be the thing that breaks if that ever changes).
function hasRunInProgress() {
  if (typeof loadRun !== 'function') return false;
  try {
    const run = loadRun();
    return run.level > 0 && run.level < CAMPAIGN_LENGTH;
  } catch (e) {
    return false;
  }
}
// Rows on the Options screen, in display order.
const OPTION_ROWS = ['language', 'difficulty'];

// Both entries that start play are separate pages, served from the same
// root as this one — see the Dockerfile, which copies web/ wholesale into
// the nginx root. Kept as functions so the headless test harness can stub
// them instead of needing a real `location`.
//
// New Game starts the story mode at level 1 (web/level/), the scrolling
// street. Arena is the free-play gym.
const ARENA_URL = '/arena/index.html';
const NEW_GAME_URL = '/level/index.html';

function navigateToArena() {
  window.location.href = ARENA_URL;
}

function navigateToNewGame() {
  // NEW GAME means level 1 with a clean slate. A run left in session
  // storage by an abandoned playthrough would otherwise drop the player
  // straight back into level 4 with that run's score.
  if (typeof clearRun === 'function') clearRun();
  window.location.href = NEW_GAME_URL;
}

// CONTINUE picks the stored run back up wherever it was left. The menu only
// offers it when there is one to resume (see TitleMenu.items).
function navigateToContinue() {
  window.location.href = NEW_GAME_URL;
}

class TitleMenu {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.screen = TitleScreen.MENU;
    this.optionIndex = 0;
    this.index = 0;
    this.tick = 0;
    // Resolved once at construction: whether a run is resumable cannot
    // change while the title screen is up.
    this.items = hasRunInProgress()
      ? ['continue', ...MENU_ITEMS]
      : [...MENU_ITEMS];
  }

  // Arrow keys move the cursor, Enter selects, Escape backs out. Called
  // straight from the keydown handler so it sees discrete presses rather
  // than held state.
  handleKey(key) {
    this.tick = 0;

    if (this.screen === TitleScreen.MENU) {
      if (key === 'ArrowUp') this.index = (this.index + this.items.length - 1) % this.items.length;
      else if (key === 'ArrowDown') this.index = (this.index + 1) % this.items.length;
      else if (key === 'Enter') this.select();
      return;
    }

    if (this.screen === TitleScreen.OPTIONS) {
      // Up/down picks a row, left/right changes it.
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const dir = key === 'ArrowUp' ? -1 : 1;
        this.optionIndex = (this.optionIndex + dir + OPTION_ROWS.length) % OPTION_ROWS.length;
      } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const dir = key === 'ArrowLeft' ? -1 : 1;
        const row = OPTION_ROWS[this.optionIndex];
        const keys = Object.keys(row === 'language' ? Languages : Difficulties);
        const field = row === 'language' ? 'lang' : 'difficulty';
        const at = keys.indexOf(Settings[field]);
        Settings[field] = keys[(at + dir + keys.length) % keys.length];
        saveSettings(Settings);
      } else if (key === 'Enter' || key === 'Escape') {
        this.screen = TitleScreen.MENU;
      }
      return;
    }

    // Highscores: either of Enter/Escape returns.
    if (key === 'Enter' || key === 'Escape') this.screen = TitleScreen.MENU;
  }

  select() {
    const item = this.items[this.index];
    // New Game and Arena are standalone pages with their own loops and
    // script sets, so selecting either is a navigation, not a state change.
    if (item === 'arena') { navigateToArena(); return; }
    if (item === 'newGame') { navigateToNewGame(); return; }
    if (item === 'continue') { navigateToContinue(); return; }
    if (item === 'highscores') this.screen = TitleScreen.SCORES;
    else if (item === 'options') this.screen = TitleScreen.OPTIONS;
  }

  update() {
    this.tick++;
  }

  draw(ctx) {
    const { W, H } = this;
    // Backdrop: deep gradient plus a slow sweep so the screen isn't static.
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#140d2b');
    grad.addColorStop(0.6, '#241145');
    grad.addColorStop(1, '#0d0c1d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Sunburst behind the title.
    ctx.save();
    ctx.translate(W / 2, H * 0.30);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + this.tick * 0.002;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,213,77,0.07)' : 'rgba(255,42,133,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.16) * W, Math.sin(a - 0.16) * W);
      ctx.lineTo(Math.cos(a + 0.16) * W, Math.sin(a + 0.16) * W);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title, with a gentle bob.
    const bob = Math.sin(this.tick / 28) * 2;
    ctx.save();
    ctx.translate(W / 2, H * 0.24 + bob);
    ctx.font = 'bold 30px Impact, "Arial Black", sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1a1020';
    ctx.strokeText('SUPER GERE', 0, 0);
    ctx.fillStyle = '#ffd54d';
    ctx.fillText('SUPER GERE', 0, 0);
    ctx.font = 'bold 11px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeText('PARISE RESCUE', 0, 22);
    ctx.fillStyle = '#ff2a85';
    ctx.fillText('PARISE RESCUE', 0, 22);
    ctx.restore();

    if (this.screen === TitleScreen.MENU) this.drawMenu(ctx);
    else if (this.screen === TitleScreen.SCORES) this.drawScores(ctx);
    else this.drawOptions(ctx);
  }

  drawMenu(ctx) {
    const { W, H } = this;
    const top = H * 0.52;
    this.items.forEach((item, i) => {
      const selected = i === this.index;
      const y = top + i * 22;
      if (selected) {
        // Blinking cartoon arrows around the active entry.
        const blink = Math.floor(this.tick / 10) % 2 === 0;
        if (blink) {
          ctx.fillStyle = '#ff2a85';
          ctx.font = 'bold 12px monospace';
          ctx.fillText('▶', W / 2 - 78, y);
          ctx.fillText('◀', W / 2 + 78, y);
        }
      }
      ctx.font = selected
        ? 'bold 15px Impact, "Arial Black", sans-serif'
        : 'bold 13px Impact, "Arial Black", sans-serif';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1a1020';
      ctx.strokeText(t(item), W / 2, y);
      ctx.fillStyle = selected ? '#00f5d4' : '#cfc9e0';
      ctx.fillText(t(item), W / 2, y);
    });

    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(t('selectHint'), W / 2, H - 14);
  }

  drawScores(ctx) {
    const { W, H } = this;
    const scores = loadHighscores();
    ctx.font = 'bold 13px Impact, "Arial Black", sans-serif';
    ctx.fillStyle = '#ffd54d';
    ctx.fillText(t('highscores'), W / 2, H * 0.48);

    ctx.font = '9px monospace';
    if (scores.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(t('noScores'), W / 2, H * 0.60);
    } else {
      scores.slice(0, 6).forEach((row, i) => {
        const y = H * 0.56 + i * 12;
        ctx.fillStyle = i === 0 ? '#00f5d4' : '#cfc9e0';
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}. ${row.name}`, W / 2 - 60, y);
        ctx.textAlign = 'right';
        ctx.fillText(String(row.score), W / 2 + 60, y);
        ctx.textAlign = 'center';
      });
    }
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(t('back'), W / 2, H - 14);
  }

  drawOptions(ctx) {
    const { W, H } = this;
    ctx.font = 'bold 13px Impact, "Arial Black", sans-serif';
    ctx.fillStyle = '#ffd54d';
    ctx.fillText(t('options'), W / 2, H * 0.48);

    ctx.font = '10px monospace';
    const rows = [
      [t('language'), Languages[Settings.lang]],
      [t('difficulty'), `${difficultyLabel()} (${difficultyLives()}\u2665)`],
    ];
    rows.forEach(([label, value], i) => {
      const selected = i === this.optionIndex;
      ctx.fillStyle = selected ? '#ffd54d' : '#cfc9e0';
      const arrows = selected ? ['\u25C0', '\u25B6'] : [' ', ' '];
      ctx.fillText(
        `${label}:  ${arrows[0]}  ${value}  ${arrows[1]}`,
        W / 2, H * (0.58 + i * 0.09),
      );
    });

    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(t('back'), W / 2, H - 14);
  }
}
