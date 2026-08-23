// Main game loop, states, HUD, menu, shop.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width;
const H = canvas.height;

// BOUNDS.left/right are the vertical-lane fight box's screen margins, kept
// for reference/UI; horizontal movement clamping is now done in world space
// (see worldBounds()) since levels scroll. top/bottom (the fight lane) span
// roughly the bottom half of the canvas, matching backgrounds composed with
// the street/sidewalk ground plane occupying that same region (buildings
// fill the top half) so characters' feet visually land on the pavement
// instead of floating over architecture.
const BOUNDS = { left: 24, right: W - 24, top: H * 0.5, bottom: H - 30 };

let cameraX = 0;

// World-space horizontal clamp for the player/enemies this frame: the full
// level width, further restricted to the current wave's soft-lock zone
// while enemies are alive (classic beat-em-up "can't outrun the fight").
function worldBounds() {
  const worldWidth = arena ? arena.worldWidth : W;
  const lockRight = arena ? arena.advanceLockX() : worldWidth;
  return { left: 0, right: Math.min(worldWidth, lockRight), top: BOUNDS.top, bottom: BOUNDS.bottom };
}

function updateCamera() {
  const worldWidth = arena ? arena.worldWidth : W;
  const target = player.x - W / 2;
  cameraX = clamp(target, 0, Math.max(0, worldWidth - W));
}

const GameState = {
  LEVEL: 'level',
  PAUSED: 'paused',
};

const Input = {
  held: { left: false, right: false, up: false, down: false, run: false },
  pressed: { punch: false, slide: false, heavy: false, jump: false, assistLeft: false, assistRight: false },
  _prevHeldKeys: new Set(),
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
  if (keyMap[e.key]) { Input.held[keyMap[e.key]] = true; }
  if (!heldKeys.has(e.key)) {
    if (e.key === 'j' || e.key === 'J') Input.pressed.punch = true;
    if (e.key === 'k' || e.key === 'K') Input.pressed.slide = true;
    if (e.key === 'l' || e.key === 'L') Input.pressed.heavy = true;
    if (e.key === ' ') Input.pressed.jump = true;
    if (e.key === 'p' || e.key === 'P') togglePause();
  }
  heldKeys.add(e.key);
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  if (keyMap[e.key]) { Input.held[keyMap[e.key]] = false; }
  heldKeys.delete(e.key);
});

function clearPressed() {
  Input.pressed.punch = false;
  Input.pressed.slide = false;
  Input.pressed.heavy = false;
  Input.pressed.jump = false;
}

// ---- Game context ----
let state = GameState.LEVEL;
let prevState = GameState.LEVEL;
let player = new Player(60, BOUNDS.bottom - 10);
let previewCharacters = [];
let arena = null;

// Decorative showcase: a Gere that patrols the canvas middle on his own.
const WALKER_RANGE = 60;
let centerWalker = null;
let walkerDir = 1;

function resetRun() {
  player = new Player(60, BOUNDS.bottom - 10);
  // giovanni's sprites moved to web/assets/private/ and are no longer
  // shipped, so that preview slot is gone.
  previewCharacters = [
    new Player(300, BOUNDS.bottom - 10, 'minion', true),
    new Player(420, BOUNDS.bottom - 10, 'boss1', true),
  ];
  centerWalker = new Player(W / 2, BOUNDS.bottom - 10, 'gere', true);
  walkerDir = 1;
  arena = new MechanicsArena();
}

function startArena() {
  arena = new MechanicsArena();
  player.x = 60;
  player.y = BOUNDS.bottom - 10;
  for (const character of previewCharacters) {
    character.y = BOUNDS.bottom - 10;
  }
  centerWalker.x = W / 2;
  walkerDir = 1;
  player.hitStun = 0;
  cameraX = 0;
  state = GameState.LEVEL;
}

function triggerAssist() {
  if (state !== GameState.LEVEL) return;
}

function togglePause() {
  if (state === GameState.LEVEL) { prevState = state; state = GameState.PAUSED; }
  else if (state === GameState.PAUSED) { state = prevState; }
}

function update() {
  if (state === GameState.LEVEL) {
    const wBounds = worldBounds();
    player.update(Input, wBounds);
    for (const character of previewCharacters) character.update(Input, wBounds);
    if (centerWalker.x > W / 2 + WALKER_RANGE) walkerDir = -1;
    else if (centerWalker.x < W / 2 - WALKER_RANGE) walkerDir = 1;
    centerWalker.update({ held: { left: walkerDir < 0, right: walkerDir > 0 } }, wBounds);
    player.slingShot = false;
    updateCamera();
  }

  clearPressed();
}

function drawPaused() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('PAUSED', W / 2, H / 2);
  ctx.font = '9px monospace';
  ctx.fillText('Press P to resume', W / 2, H / 2 + 20);
}

function drawLevel() {
  centerWalker.draw(ctx, cameraX);
  player.draw(ctx, cameraX);
  for (const character of previewCharacters) character.draw(ctx, cameraX);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  switch (state) {
    case GameState.LEVEL: drawLevel(); break;
    case GameState.PAUSED: drawLevel(); drawPaused(); break;
  }
}

function loop() {
  if (state !== GameState.PAUSED) {
    update();
  } else {
    clearPressed();
  }
  render();
  requestAnimationFrame(loop);
}

resetRun();
loadAssets();
loop();
