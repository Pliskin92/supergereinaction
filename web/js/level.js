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
// Minions arrive in locked encounters rather than trickling in: walk far
// enough and a group teleports in ON SCREEN, the street locks, and the lock
// only lifts once every one of them is down. That is the beat-em-up shape
// -- fight a room, move on -- instead of a running battle you can outrun.
const LEVEL_MINION_TOTAL = 72;
// How many arrive together in one encounter.
const LEVEL_ENCOUNTER_SIZE = 5;
// Encounters are triggered at these fractions along the world. There are
// enough of them to place the whole roster before the boss.
const LEVEL_ENCOUNTER_COUNT = Math.ceil(LEVEL_MINION_TOTAL / LEVEL_ENCOUNTER_SIZE);
const LEVEL_ENCOUNTER_FROM = 0.05;
const LEVEL_ENCOUNTER_TO = 0.90;
// Where in the visible screen they may appear, as fractions of its width.
// Kept inside the edges so nobody materialises half off-screen, and clear
// of the very centre so they do not land on top of the player.
const LEVEL_SPAWN_SCREEN_MIN = 0.10;
const LEVEL_SPAWN_SCREEN_MAX = 0.90;
const LEVEL_SPAWN_CLEAR_OF_PLAYER = 110;
// The lock holds the player this far back from the right edge of the
// locked zone, so the barrier is felt rather than invisible.
const LEVEL_LOCK_MARGIN = 40;

const LEVEL_BOSS_AT = 0.95;

// A minion only thinks within this range of the player, so distant ones
// cost nothing. It has to comfortably exceed the spawn distance -- minions
// arrive just off either screen edge, which is already ~480px away from a
// centred player -- or a freshly teleported one would stand frozen where
// it landed instead of walking in.
const ENEMY_ACTIVATE_RANGE = 900;

// The street strip. Repeated LEVEL_LOOPS times to make the world.
const LEVEL_BACKGROUND = 'assets/release/backgrounds/lv1/lv1-background.png';

// The walkable band inside the background art, as fractions of the image
// height (see stages.js for the same convention).
//
// Measured off lv1-background.png (1855x387): the pavement runs from its
// kerb edge at y=283 to the front lip at y=351, past which is the basement
// wall. Only the pavement is walkable -- the road above the kerb is
// backdrop, not playfield.
const LEVEL_WALK_TOP = 0.731;
const LEVEL_WALK_BOTTOM = 0.907;
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
    // No debug FURY key here: in the level the meter has to be earned by
    // landing and taking hits. Forcing it is an arena-only convenience.
    // Root-relative: this page sets <base href="/">.
    if (e.key === 'Escape') window.location.href = '/index.html';
    // Enter restarts the level once every life is spent.
    if (e.key === 'Enter' && player.gameOver) window.location.reload();
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
let potions = [];
let minionsSpawned = 0;
let encountersDone = 0;
// Right-hand wall while an encounter is being fought; 0 when the street is
// open. The player cannot walk past it until the group is cleared.
let lockUntilX = 0;
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

// Places only the boss. Minions arrive in encounters as the level is
// walked; see triggerEncounter().
function spawnEnemies() {
  enemies = [];
  potions = [];
  minionsSpawned = 0;
  encountersDone = 0;
  lockUntilX = 0;
  const lane = BOUNDS.bottom - BOUNDS.top;
  enemies.push(new Enemy('boss1', worldWidth * LEVEL_BOSS_AT, BOUNDS.top + lane * 0.5));
}

// World x at which the next encounter fires.
function nextEncounterX() {
  if (encountersDone >= LEVEL_ENCOUNTER_COUNT) return Infinity;
  const span = LEVEL_ENCOUNTER_TO - LEVEL_ENCOUNTER_FROM;
  const step = span / LEVEL_ENCOUNTER_COUNT;
  return worldWidth * (LEVEL_ENCOUNTER_FROM + step * encountersDone);
}

// Teleports a group in around the player, ON SCREEN so the arrival is
// always seen, and locks the street until they are all down.
function triggerEncounter() {
  const lane = BOUNDS.bottom - BOUNDS.top;
  const remaining = LEVEL_MINION_TOTAL - minionsSpawned;
  const count = Math.min(LEVEL_ENCOUNTER_SIZE, remaining);
  for (let i = 0; i < count; i++) {
    // Spread across the visible width, alternating sides of the player so
    // they arrive both in front of and behind him.
    let sx;
    let tries = 0;
    do {
      const f = LEVEL_SPAWN_SCREEN_MIN
        + Math.random() * (LEVEL_SPAWN_SCREEN_MAX - LEVEL_SPAWN_SCREEN_MIN);
      sx = cameraX + W * f;
      tries++;
    } while (Math.abs(sx - player.x) < LEVEL_SPAWN_CLEAR_OF_PLAYER && tries < 12);

    const x = clamp(sx, 40, worldWidth - 40);
    const y = BOUNDS.top + lane * (0.12 + Math.random() * 0.76);
    const minion = new Enemy('minion', x, y);
    minion.spawnTimer = TELEPORT_FRAMES;
    enemies.push(minion);
    minionsSpawned++;
  }
  encountersDone++;
  // Hold the player inside the screen they are fighting on.
  lockUntilX = cameraX + W - LEVEL_LOCK_MARGIN;
}

// True while an encounter is unresolved: every minion currently in the
// world must be down before the street opens again.
function encounterActive() {
  return lockUntilX > 0
    && enemies.some((e) => !e.dead && !e.def.boss);
}

// Camera centres on the player but never scrolls past either end of the
// world, so the player walks toward the screen edges at the extremes rather
// than the backdrop pulling away from them.
function updateCamera() {
  const target = player.x - W / 2;
  let maxX = Math.max(0, worldWidth - W);
  // Freeze the camera on the locked screen, so the arena the fight happens
  // in stays put rather than sliding as the player moves within it.
  if (lockUntilX > 0) maxX = Math.min(maxX, lockUntilX + LEVEL_LOCK_MARGIN - W);
  cameraX = clamp(target, 0, maxX);
}

function update() {
  // The transformation freezes the street exactly as it freezes the arena,
  // so the cut-in reads as a hard stop rather than playing out over a fight.
  furyPopup.follow(player, strings());
  if (furyPopup.freezing) {
    furyPopup.update();
    // The death sequence has to keep running through the freeze: it fires
    // the popups the freeze is displaying, so stalling it would leave the
    // "GERE'S BACK" card hanging with nothing behind it.
    if (player.dead) player.update(Input, BOUNDS);
    clearPressed();
    return;
  }
  // While an encounter is being fought the street is walled off at
  // lockUntilX: the player may move freely inside the zone but cannot walk
  // past it. Passing a tightened BOUNDS is enough -- Player.update already
  // clamps against it -- so nothing in the entity code needs to know.
  const bounds = lockUntilX > 0
    ? { ...BOUNDS, right: Math.min(BOUNDS.right, lockUntilX) }
    : BOUNDS;
  player.update(Input, bounds);
  // Only enemies near the player think or move. Distant ones stay put, so
  // a long street costs nothing and nobody sprints in from off-screen.
  for (const enemy of enemies) {
    // A dead enemy still ticks: its death blast has to play out and set
    // `gone` before it can be dropped. Skipping it froze the burst forever.
    if (!enemy.dead && Math.abs(enemy.x - player.x) > ENEMY_ACTIVATE_RANGE) continue;
    enemy.update(player, bounds);
  }
  // Fire the next encounter once the player reaches it, and lift the lock
  // when the group is cleared.
  if (!encounterActive()) {
    lockUntilX = 0;
    if (player.x >= nextEncounterX()) triggerEncounter();
  }
  resolvePlayerAttacks(player, enemies);
  // Retire finished enemies, leaving a potion behind where one was rolled.
  if (enemies.some((e) => e.gone)) {
    for (const e of enemies) {
      if (e.gone && e.dropsPotion) {
        potions.push(new Potion(e.x, e.y, e.dropsPotion));
      }
    }
    enemies = enemies.filter((e) => !e.gone);
  }
  for (const potion of potions) potion.update(player);
  if (potions.some((p) => p.taken)) potions = potions.filter((p) => !p.taken);
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

  // Lives, as hearts beside the health bar.
  // One pip per life the run started with, so the count reads against the
  // chosen difficulty rather than a fixed five.
  for (let i = 0; i < player.maxLives; i++) {
    drawHeart(ctx, 18 + i * 15, 22, 12, i < player.lives);
  }

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

// Drawn over everything once the last life is spent.
function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,14,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px Impact, "Arial Black", sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a1020';
  ctx.strokeText(t('gameOver'), W / 2, H / 2);
  ctx.fillStyle = '#e84c4c';
  ctx.fillText(t('gameOver'), W / 2, H / 2);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(t('gameOverHint'), W / 2, H / 2 + 34);
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
  // The lock's barrier, so the wall reads as deliberate rather than the
  // player simply sticking at an invisible edge.
  if (lockUntilX > 0) {
    const bx = lockUntilX - cameraX;
    const grad = ctx.createLinearGradient(bx, 0, bx + 40, 0);
    grad.addColorStop(0, 'rgba(122,215,255,0.30)');
    grad.addColorStop(1, 'rgba(122,215,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, BOUNDS.top - 90, 40, (BOUNDS.bottom - BOUNDS.top) + 120);
    ctx.strokeStyle = 'rgba(122,215,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, BOUNDS.top - 90);
    ctx.lineTo(bx, BOUNDS.bottom + 30);
    ctx.stroke();
  }

  // Pickups draw under the cast so a character standing on one still reads.
  for (const potion of potions) potion.draw(ctx, cameraX);
  const actors = [player, ...visible].sort((a, b) => a.y - b.y);
  for (const actor of actors) actor.draw(ctx, cameraX);
  ctx.restore();
  drawHud();
  furyPopup.draw(ctx, W, H);
  if (player.gameOver) drawGameOver();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function levelSetUp() {
  loadAssets();
  loadImage(LEVEL_BACKGROUND).then((img) => {
    if (!img) return;
    background = img;
    layoutLevel(img);
  });
  loop();
}

levelSetUp();
