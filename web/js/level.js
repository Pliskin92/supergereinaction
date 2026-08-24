// Level 1: a scrolling street you can walk along.
//
// This is the side-scrolling counterpart to the free-play arena. The arena
// is one fixed screen (it draws every actor at cameraX 0); here the world is
// wider than the canvas, so a camera follows the player and the backdrop
// repeats to fill however far they walk.
//
// Entities already speak world space -- Player.update() clamps against a
// world-space BOUNDS, and both Player.draw() and Enemy.draw() take a
// cameraX and subtract it -- so scrolling needs no changes to them at all.

const canvas = document.getElementById('levelCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width;
const H = canvas.height;

// How many times the background strip repeats end to end. The art loops, so
// the level is simply the strip laid down this many times; walking off the
// last copy is what ends the level once there is somewhere to go.
const LEVEL_LOOPS = 12;

// Enemy layout, as fractions along the world. Minions are spread through
// the walk so the level has a rhythm rather than one long empty stretch;
// the boss waits at the very end.
// Groups of minions rather than a even sprinkle: a beat-em-up wants
// encounters with breathing room between them, not one enemy every few
// seconds. Each entry is a fraction along the world and how many stand
// there; they are spread over a short span so a group arrives together.
const LEVEL_WAVES = [
  { at: 0.045, count: 2 }, { at: 0.10, count: 3 }, { at: 0.16, count: 2 },
  { at: 0.22, count: 3 }, { at: 0.28, count: 3 }, { at: 0.34, count: 4 },
  { at: 0.40, count: 3 }, { at: 0.46, count: 4 }, { at: 0.52, count: 3 },
  { at: 0.58, count: 4 }, { at: 0.64, count: 4 }, { at: 0.70, count: 3 },
  { at: 0.76, count: 4 }, { at: 0.82, count: 5 }, { at: 0.88, count: 4 },
];
const LEVEL_WAVE_SPREAD = 220;   // px a group is scattered across
const LEVEL_BOSS_AT = 0.95;

// A minion only wakes when the player gets near, so the whole street is not
// charging at once from the moment the level loads.
const ENEMY_ACTIVATE_RANGE = 520;

// The street strip. Repeated LEVEL_LOOPS times to make the world.
const LEVEL_BACKGROUND = 'assets/release/backgrounds/lv1/lv1-background.png';

// Where the pavement sits inside the background art, as fractions of the
// image height (see stages.js for the same convention). Measured off
// lv1-background.png (1855x336): the kerb edge is at y=238 and the front
// of the pavement at y=300, past which is the grey basement wall.
const LEVEL_WALK_TOP = 0.708;
const LEVEL_WALK_BOTTOM = 0.893;
// Keep actors clear of both edges of that band, as the arena stages do.
const LEVEL_EDGE_MARGIN = 0.18;

const Input = {
  held: { left: false, right: false, up: false, down: false, run: false },
  pressed: { punch: false, slide: false, heavy: false, jump: false },
};

const keyMap = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  Shift: 'run',
};

const heldKeys = new Set();

window.addEventListener('keydown', (e) => {
  if (keyMap[e.key]) Input.held[keyMap[e.key]] = true;
  if (!heldKeys.has(e.key)) {
    if (e.key === 'j' || e.key === 'J') Input.pressed.punch = true;
    if (e.key === 'k' || e.key === 'K') Input.pressed.slide = true;
    if (e.key === 'l' || e.key === 'L') Input.pressed.heavy = true;
    if (e.key === ' ') Input.pressed.jump = true;
    if (e.key === 'f' || e.key === 'F') player.startFury();
    // Root-relative: this page sets <base href="/">.
    if (e.key === 'Escape') window.location.href = '/index.html';
  }
  heldKeys.add(e.key);
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  if (keyMap[e.key]) Input.held[keyMap[e.key]] = false;
  heldKeys.delete(e.key);
});

function clearPressed() {
  Input.pressed.punch = false;
  Input.pressed.slide = false;
  Input.pressed.heavy = false;
  Input.pressed.jump = false;
}

let background = null;
let worldWidth = W;       // total walkable width, set once the art loads
let cameraX = 0;
// Layout of the drawn backdrop, derived from the image once it is loaded.
let bgScale = 1;
let bgDrawW = W;
let bgDrawH = H;
let bgTop = 0;

let BOUNDS = { left: 24, right: W - 24, top: H * 0.6, bottom: H - 30 };
let player = new Player(120, BOUNDS.bottom, 'gere');
let enemies = [];
const furyPopup = new FuryPopup();

// Scales the strip to fill the canvas height, then works out the world's
// width and the walkable band from the art's own proportions.
function layoutLevel(img) {
  bgScale = H / img.height;
  bgDrawW = img.width * bgScale;
  bgDrawH = H;
  bgTop = 0;
  worldWidth = bgDrawW * LEVEL_LOOPS;

  const top = bgTop + LEVEL_WALK_TOP * bgDrawH;
  const bottom = bgTop + LEVEL_WALK_BOTTOM * bgDrawH;
  const margin = (bottom - top) * LEVEL_EDGE_MARGIN;
  BOUNDS = {
    left: 24,
    right: worldWidth - 24,
    top: top + margin,
    bottom: bottom - margin,
  };
  player.x = 120;
  player.y = BOUNDS.bottom;
  spawnEnemies();
}

// Lays the cast out along the world. Enemies are placed once, at load, and
// simply idle until the player is close enough to matter.
function spawnEnemies() {
  enemies = [];
  const lane = BOUNDS.bottom - BOUNDS.top;
  let n = 0;
  for (const wave of LEVEL_WAVES) {
    const baseX = worldWidth * wave.at;
    for (let i = 0; i < wave.count; i++) {
      // Scatter each group along the street and across the lane's depth so
      // they arrive as a loose crowd rather than a single file.
      const x = baseX + (i - (wave.count - 1) / 2) * (LEVEL_WAVE_SPREAD / wave.count);
      const depth = BOUNDS.top + lane * (0.18 + ((n + i) % 4) * 0.22);
      enemies.push(new Enemy('minion', x, depth));
    }
    n += wave.count;
  }
  enemies.push(new Enemy('boss1', worldWidth * LEVEL_BOSS_AT, BOUNDS.top + lane * 0.5));
}

// Camera centres on the player but never scrolls past either end of the
// world, so the player walks toward the screen edges at the extremes rather
// than the backdrop pulling away from them.
function updateCamera() {
  const target = player.x - W / 2;
  cameraX = clamp(target, 0, Math.max(0, worldWidth - W));
}

function update() {
  // The transformation freezes the street exactly as it freezes the arena,
  // so the cut-in reads as a hard stop rather than playing out over a fight.
  furyPopup.follow(player, strings());
  if (furyPopup.freezing) {
    furyPopup.update();
    clearPressed();
    return;
  }
  player.update(Input, BOUNDS);
  // Only enemies near the player think or move. Distant ones stay put, so
  // a long street costs nothing and nobody sprints in from off-screen.
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    if (Math.abs(enemy.x - player.x) > ENEMY_ACTIVATE_RANGE) continue;
    enemy.update(player, BOUNDS);
  }
  resolvePlayerAttacks(player, enemies);
  updateCamera();
  furyPopup.update();
  clearPressed();
}

// Repeats the strip across the visible span. Only the copies overlapping the
// camera are drawn, so a long level costs no more than a short one.
function drawBackground() {
  if (!background) {
    ctx.fillStyle = '#1b1b2b';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const first = Math.floor(cameraX / bgDrawW);
  const last = Math.floor((cameraX + W) / bgDrawW);
  for (let i = first; i <= last; i++) {
    ctx.drawImage(background, i * bgDrawW - cameraX, bgTop, bgDrawW, bgDrawH);
  }
}

function drawHud() {
  ctx.save();
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#ffd54d';
  ctx.textAlign = 'left';
  ctx.fillText(t('level1Title'), 12, 12);

  // Player health.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 28, 120, 7);
  ctx.fillStyle = player.hp / player.maxHp > 0.3 ? '#5ac85a' : '#e84c4c';
  ctx.fillRect(12, 28, 120 * clamp(player.hp / player.maxHp, 0, 1), 7);

  // FURY belongs to the character who can transform; see Player.canFury().
  if (player.canFury()) drawFuryBar(ctx, player, 12, 42, 120, 7, strings());

  // The boss gets a bar of its own once it is on screen and fighting.
  const boss = enemies.find((e) => e.def.boss && !e.dead);
  if (boss && Math.abs(boss.x - player.x) < ENEMY_ACTIVATE_RANGE) {
    const bw = Math.min(300, W * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect((W - bw) / 2, 12, bw, 9);
    ctx.fillStyle = '#e84c4c';
    ctx.fillRect((W - bw) / 2, 12, bw * clamp(boss.hp / boss.maxHp, 0, 1), 9);
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(boss.def.name || 'BOSS', W / 2, 30);
    ctx.textAlign = 'left';
  }

  // Progress along the level, below the health/FURY readouts.
  const pct = worldWidth > W ? clamp(player.x / worldWidth, 0, 1) : 0;
  const py = player.canFury() ? 62 : 42;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(12, py, 120, 4);
  ctx.fillStyle = '#8a8ad0';
  ctx.fillRect(12, py, 120 * pct, 4);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  const quake = furyPopup.shake();
  ctx.save();
  ctx.translate(quake.x, quake.y);
  drawBackground();
  // Depth sort so whoever stands further down the lane draws in front.
  // Only what is on screen (plus a margin for part-visible sprites) draws.
  const visible = enemies.filter((e) => {
    const sx = e.x - cameraX;
    return sx > -200 && sx < W + 200 && (!e.dead || e.deathTimer < 90);
  });
  const actors = [player, ...visible].sort((a, b) => a.y - b.y);
  for (const actor of actors) actor.draw(ctx, cameraX);
  ctx.restore();
  drawHud();
  furyPopup.draw(ctx, W, H);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function levelSetUp() {
  const select = document.getElementById('characterSelect');
  if (select) {
    player = new Player(120, BOUNDS.bottom, select.value);
    select.addEventListener('change', () => {
      player = new Player(player.x, BOUNDS.bottom, select.value);
      select.blur();
    });
  }
  loadAssets();
  loadImage(LEVEL_BACKGROUND).then((img) => {
    if (!img) return;
    background = img;
    layoutLevel(img);
  });
  loop();
}

levelSetUp();
