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
const LEVEL_LOOPS = 4;

// Where the pavement sits inside the background art, as fractions of the
// image height (see stages.js for the same convention). Measured off
// Background.png: the kerb edge is at y=230 and the front of the pavement
// at y=300, past which is the dark basement wall.
const LEVEL_WALK_TOP = 0.685;
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
}

// Camera centres on the player but never scrolls past either end of the
// world, so the player walks toward the screen edges at the extremes rather
// than the backdrop pulling away from them.
function updateCamera() {
  const target = player.x - W / 2;
  cameraX = clamp(target, 0, Math.max(0, worldWidth - W));
}

function update() {
  player.update(Input, BOUNDS);
  updateCamera();
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

  // Progress along the level, so the scroll has a visible sense of distance.
  const pct = worldWidth > W ? clamp(player.x / worldWidth, 0, 1) : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(12, 18, 120, 5);
  ctx.fillStyle = '#ffd54d';
  ctx.fillRect(12, 18, 120 * pct, 5);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  player.draw(ctx, cameraX);
  drawHud();
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
  loadImage('assets/release/backgrounds/lv1/Background.png').then((img) => {
    if (!img) return;
    background = img;
    layoutLevel(img);
  });
  loop();
}

levelSetUp();
