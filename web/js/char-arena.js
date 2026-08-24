// The gym (web/arena/). Pick a character from the dropdown and play them
// directly against a training sack. Reached from the title screen's Arena
// entry; Escape goes back there.
//
// Controls: WASD/arrows move, Space jump, J punch-combo, K roll, L heavy,
// R resets the sack, F force-fills the FURY meter. This is the real Player
// class in a real arena — not an animation viewer.

const canvas = document.getElementById('arenaCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width;
const H = canvas.height;

// The procedural gym's band, used as-is for the gym stage and as the
// fallback for any stage whose art hasn't loaded. An image-backed stage
// replaces this with a band measured off its own floor/horizon.
const DEFAULT_BOUNDS = { left: 24, right: W - 24, top: H * 0.5, bottom: H - 30 };
let BOUNDS = { ...DEFAULT_BOUNDS };

let stageId = DEFAULT_STAGE;

// On-screen height of a standing character, in canvas pixels. AutoSprite
// clips are authored around this (it's the trim data's reference_height),
// and sprites are blitted unscaled, so it's the yardstick every piece of
// gym furniture is sized against. The backdrop was originally drawn with
// hand-picked pixel sizes from an era of much smaller characters, which
// made the room look like a doll's house next to Gere.
const CHARACTER_HEIGHT = 194;

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
    if (e.key === 'r' || e.key === 'R') resetArena();
    // Root-relative: this page sets <base href="/">, so a relative path
    // would resolve against the root rather than against /arena/.
    if (e.key === 'Escape') window.location.href = '/index.html';
    // Debug shortcut: fill the meter so the transformation can be checked
    // without landing 100 hits first.
    // startFury() already no-ops for a character without a transformation,
    // so this stays a Gere-only debug shortcut.
    if (e.key === 'f' || e.key === 'F') player.startFury();
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

let player = new Player(W * 0.32, BOUNDS.bottom - 10, 'gere');
// The gym's training target, standing in front of the player. Inert and
// self-reviving (see EnemyTypes.sack), so the arena is always playable.
let enemies = [new Enemy('sack', W * 0.62, BOUNDS.bottom - 10)];
const furyPopup = new FuryPopup();

function selectCharacter(character) {
  player = new Player(W * 0.32, BOUNDS.bottom - 10, character);
}

// Switching stage moves the floor, so everything standing on it has to be
// re-seated: leaving actors at the old y would leave them buried in the
// ground or hovering above it.
function selectStage(id) {
  stageId = id;
  BOUNDS = stageBounds(stageId, W, H, DEFAULT_BOUNDS);
  resetArena();
}

function resetArena() {
  const stageDef = Stages[stageId];
  // Each stage names the prop you practise against: the gym has its bag,
  // the bonus stage has the car.
  const propType = (stageDef && stageDef.prop) || 'sack';
  enemies = [new Enemy(propType, W * 0.62, BOUNDS.bottom - 10)];
  for (const enemy of enemies) enemy.mount = (stageDef && stageDef.sack) || 'hanging';
  player.x = W * 0.32;
  player.y = BOUNDS.bottom - 10;
  player.hp = player.maxHp;
  if (player.furyActive) player.endFury();
  player.fury = 0;
  player.furyEvent = null;
  furyPopup.timer = 0;
}

function update() {
  // The transformation freezes the world: the popup keeps animating, but
  // nothing else advances, so the cut-in reads as a hard stop rather than
  // playing out over continued movement. follow() still runs first so the
  // freeze can begin on the very frame FURY fires.
  furyPopup.follow(player, strings());
  if (furyPopup.freezing) {
    furyPopup.update();
    clearPressed();
    return;
  }
  player.update(Input, BOUNDS);
  for (const enemy of enemies) enemy.update(player, BOUNDS);
  resolvePlayerAttacks(player, enemies);
  furyPopup.update();
  clearPressed();
}

// Gym backdrop: a floor line, a back wall and some equipment silhouettes,
// so the free-play arena reads as a room rather than a void.
function drawGym() {
  // wall
  const wall = ctx.createLinearGradient(0, 0, 0, BOUNDS.top);
  wall.addColorStop(0, '#1b1b2b');
  wall.addColorStop(1, '#2a2a3f');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, BOUNDS.top);

  // floor
  const floor = ctx.createLinearGradient(0, BOUNDS.top, 0, H);
  floor.addColorStop(0, '#4a3a2a');
  floor.addColorStop(1, '#241a14');
  ctx.fillStyle = floor;
  ctx.fillRect(0, BOUNDS.top, W, H - BOUNDS.top);

  // floorboards
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const y = BOUNDS.top + (i / 8) * (H - BOUNDS.top);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // wall bars (a gym staple), drawn as a ladder on the left. Sized off
  // CHARACTER_HEIGHT so the equipment reads at human scale: real wall bars
  // are roughly one and a half people tall and about shoulder-width wide.
  // Bars hang on the back wall, so they must end exactly at the wall/floor
  // join (BOUNDS.top) and start below the HUD band at the top of the canvas.
  const HUD_BAND = 66;
  const barsW = CHARACTER_HEIGHT * 0.62;
  const barsTop = HUD_BAND;
  const barsH = BOUNDS.top - barsTop;
  const barsX = 40;
  const rungs = 9;
  ctx.strokeStyle = 'rgba(200,170,120,0.45)';
  ctx.lineWidth = 5;
  for (let i = 0; i < rungs; i++) {
    const y = barsTop + (i / (rungs - 1)) * barsH;
    ctx.beginPath();
    ctx.moveTo(barsX, y);
    ctx.lineTo(barsX + barsW, y);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(barsX, barsTop); ctx.lineTo(barsX, barsTop + barsH); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(barsX + barsW, barsTop);
  ctx.lineTo(barsX + barsW, barsTop + barsH);
  ctx.stroke();

  // a rack of weights on the right, roughly waist-high on a character
  const rackW = CHARACTER_HEIGHT * 1.1;
  const rackH = CHARACTER_HEIGHT * 0.5;
  const rackX = W - 60 - rackW;
  const rackTop = BOUNDS.top - rackH;
  ctx.fillStyle = '#33333f';
  ctx.fillRect(rackX, rackTop, rackW, rackH * 0.14);
  ctx.fillRect(rackX + 4, rackTop, rackW * 0.035, rackH);
  ctx.fillRect(rackX + rackW - 4 - rackW * 0.035, rackTop, rackW * 0.035, rackH);
  ctx.fillStyle = '#5a5a6a';
  const plateR = rackH * 0.14;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(rackX + rackW * 0.2 + i * rackW * 0.2, rackTop - plateR, plateR, 0, Math.PI * 2);
    ctx.fill();
  }

  // fight-lane guides, so the playable band is obvious
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, BOUNDS.top); ctx.lineTo(W, BOUNDS.top); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, BOUNDS.bottom); ctx.lineTo(W, BOUNDS.bottom); ctx.stroke();
}

// The control hints live in the page's HTML above the canvas, not in the
// playfield, so the arena itself stays clear of overlay text.
function drawHud() {
  // The FURY meter belongs to the character who can actually transform;
  // for anyone else there is no mechanic to report, so no bar is drawn.
  if (player.canFury()) drawFuryBar(ctx, player, 12, 14, 110, 7, strings());

  ctx.save();
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#ffd54d';
  ctx.textAlign = 'left';
  // Name the stage being played, not always the gym.
  const stageDef = Stages[stageId];
  const title = stageDef && !stageDef.procedural ? stageDef.name.toUpperCase() : t('gymTitle');
  ctx.fillText(title, 12, 10);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  // Earthquake: the whole world (backdrop and actors) is offset, while the
  // HUD and the popup itself stay rock-steady on top of it.
  const quake = furyPopup.shake();
  ctx.save();
  ctx.translate(quake.x, quake.y);
  // An image-backed stage draws itself; the gym (and any stage whose art is
  // missing) falls back to the procedural backdrop.
  if (!drawStage(ctx, stageId, W, H)) drawGym();
  // Depth sort: whoever is further down the lane draws in front.
  const actors = [player, ...enemies].sort((a, b) => a.y - b.y);
  for (const actor of actors) actor.draw(ctx, 0);
  ctx.restore();
  drawHud();
  furyPopup.draw(ctx, W, H);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// Drawn while sprite art is still in flight. The game loop does not start
// until everything has resolved, so nothing is ever rendered with a
// half-loaded cast.
function drawLoadingScreen(progress) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#12121c';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd54d';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(t('loading'), W / 2, H / 2 - 18);

  const barW = Math.min(360, W * 0.5);
  const barX = (W - barW) / 2;
  const barY = H / 2 + 6;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(barX, barY, barW, 8);
  ctx.fillStyle = '#ffd54d';
  ctx.fillRect(barX, barY, barW * clamp(progress, 0, 1), 8);
  ctx.restore();
}

function arenaSetUp() {
  const select = document.getElementById('characterSelect');
  if (select) {
    selectCharacter(select.value);
    select.addEventListener('change', () => {
      selectCharacter(select.value);
      select.blur();
    });
  }

  // The stage picker is populated from the Stages table rather than from
  // hardcoded <option>s, so adding a stage there is all it takes to make it
  // selectable.
  const stageSelect = document.getElementById('stageSelect');
  if (stageSelect) {
    for (const [id, def] of Object.entries(Stages)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = def.name;
      stageSelect.appendChild(opt);
    }
    stageSelect.value = stageId;
    stageSelect.addEventListener('change', () => {
      selectStage(stageSelect.value);
      stageSelect.blur();
    });
  }

  // Hold the loop until every sheet has resolved. Previously the loop ran
  // immediately and anything not yet loaded fell back to a procedural
  // stand-in, which meant a cold load briefly showed the superseded
  // placeholder art before swapping to the real sprites mid-frame.
  let ready = false;
  let progress = 0;
  // Creeps toward 90% while loading so the bar always shows motion, then
  // snaps to full when the assets actually resolve.
  (function spin() {
    if (ready) return;
    progress = Math.min(0.9, progress + 0.008);
    drawLoadingScreen(progress);
    requestAnimationFrame(spin);
  })();

  Promise.all([loadAssets(), loadStages()]).then(() => {
    ready = true;
    drawLoadingScreen(1);
    selectStage(stageId);
    loop();
  });
}

arenaSetUp();
