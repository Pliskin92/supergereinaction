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
  held: { left: false, right: false, up: false, down: false },
  pressed: { punch: false, slide: false, jump: false, shoot: false, assistLeft: false, assistRight: false },
  _prevHeldKeys: new Set(),
};

const keyMap = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
};

const heldKeys = new Set();

window.addEventListener('keydown', (e) => {
  if (keyMap[e.key]) { Input.held[keyMap[e.key]] = true; }
  if (!heldKeys.has(e.key)) {
    if (e.key === 'j' || e.key === 'J') Input.pressed.punch = true;
    if (e.key === 'k' || e.key === 'K') Input.pressed.slide = true;
    if (e.key === ' ') Input.pressed.jump = true;
    if (e.key === 'l' || e.key === 'L') Input.pressed.shoot = true;
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
  Input.pressed.jump = false;
  Input.pressed.shoot = false;
}

// ---- Game context ----
let state = GameState.LEVEL;
let prevState = GameState.LEVEL;
let player = new Player(60, BOUNDS.bottom - 10);
let assists = new AssistSystem();
let arena = null;
let score = 0;
let gold = 0;
let frame = 0;
let impacts = [];
let projectiles = [];
let floatTexts = [];

function resetRun() {
  player = new Player(60, BOUNDS.bottom - 10);
  assists = new AssistSystem();
  arena = new MechanicsArena();
  score = 0;
  gold = 0;
}

function startArena() {
  arena = new MechanicsArena();
  player.x = 60;
  player.y = BOUNDS.bottom - 10;
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
  frame++;
  if (state === GameState.LEVEL) {
    const wBounds = worldBounds();
    player.update(Input, wBounds);
    if (player.slingShot) {
      projectiles.push({
        x: player.x + player.facing * 24,
        y: player.y - 30,
        vx: player.facing * 4,
      });
      player.slingShot = false;
    }
    arena.update(player, wBounds);
    updateCamera();
    assists.update(player, arena.enemies);

    // player attack resolution
    const hb = player.getAttackHitbox();
    if (hb && !player.attackHit) {
      for (const e of arena.activeEnemies()) {
        if (rectsOverlap(hb, e.getHitbox())) {
          e.takeDamage(hb.damage + (player._comboBonus || 0));
          impacts.push({ x: e.x, y: e.y - 20, t: 0, color: '#ffe38a' });
          player.attackHit = true;
          score += 10;
          if (e.dead) {
            score += e.def.scoreValue;
            gold += Math.round(e.def.scoreValue / 20);
          }
        }
      }
    }

    if (player.hp <= 0) {
      player.hp = player.maxHp;
      player.hitStun = 0;
      floatTexts.push({ text: 'RECOVERED', t: 0 });
    }

    updateProjectiles();
  }

  impacts = impacts.filter(im => { im.t += 0.06; return im.t < 1; });
  projectiles = projectiles.filter(projectile => projectile.active !== false && projectile.x >= 0 && projectile.x <= W);
  floatTexts = floatTexts.filter(f => { f.t += 1; return f.t < 90; });

  clearPressed();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updateProjectiles() {
  for (const projectile of projectiles) {
    projectile.x += projectile.vx;
    for (const enemy of arena.activeEnemies()) {
      if (Math.abs(projectile.x - enemy.x) > 18 || Math.abs(projectile.y - enemy.y + 20) > 28) continue;
      enemy.takeDamage(12);
      projectile.active = false;
      impacts.push({ x: enemy.x, y: enemy.y - 20, t: 0, color: '#ffe38a' });
      score += 10;
      if (enemy.dead) {
        score += enemy.def.scoreValue;
        gold += Math.round(enemy.def.scoreValue / 20);
      }
      break;
    }
  }
}

// ---- Rendering ----
// Static (non-scrolling) screens: menu/shop/gameover/win — single fixed image.
function drawBackground(colors, imageKey) {
  const image = imageKey ? Assets[imageKey] : null;
  if (image) {
    ctx.drawImage(image, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, colors ? colors[0] : '#101018');
    grad.addColorStop(1, colors ? colors[1] : '#202030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  drawFloor();
}

function drawFloor() {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, BOUNDS.bottom + 10, W, H - BOUNDS.bottom - 10);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < W; i += 24) {
    ctx.beginPath();
    ctx.moveTo(i, BOUNDS.bottom + 10);
    ctx.lineTo(i - 10, H);
    ctx.stroke();
  }
}

// Scrolling level background: tiles the level's background segment(s) side
// by side across worldWidth, offset by cameraX. Today each level has a
// single bgImage key repeated to fill every segment slot (see
// LevelRuntime.backgroundSegments); swapping in distinct art per segment
// later only changes what backgroundSegments() returns, not this code.
function drawHUD() {
  // Face portrait, above the HP bar
  const face = Assets.faceHappy;
  const faceSize = 34;
  const faceTop = 10;
  if (face) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(10 + faceSize / 2, faceTop + faceSize / 2, faceSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face, 10, faceTop, faceSize, faceSize);
    ctx.restore();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(10 + faceSize / 2, faceTop + faceSize / 2, faceSize / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HP bar, below the face portrait
  const hpTop = faceTop + faceSize + 6;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, hpTop, 140, 14);
  ctx.fillStyle = '#3fd67a';
  ctx.fillRect(12, hpTop + 2, 136 * (player.hp / player.maxHp), 10);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(10, hpTop, 140, 14);
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('HP', 14, hpTop + 11);

  // score / gold
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(`SCORE ${score}`, W - 10, 18);
  ctx.fillText(`GOLD ${gold}`, W - 10, 30);

  // Arena name
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '9px monospace';
  ctx.fillText('MECHANICS ARENA', W / 2, 16);

  for (const f of floatTexts) {
    ctx.globalAlpha = 1 - f.t / 90;
    ctx.fillStyle = '#ffd15c';
    ctx.font = '10px monospace';
    ctx.fillText(f.text, W / 2, H / 2 - f.t * 0.5);
    ctx.globalAlpha = 1;
  }
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
  drawBackground(ARENA_COLORS);

  const enemies = [...arena.activeEnemies()];
  enemies.sort((a, b) => a.y - b.y);
  for (const enemy of enemies) enemy.draw(ctx, cameraX);
  player.draw(ctx, cameraX);

  assists.draw(ctx, player, cameraX);

  for (const im of impacts) drawImpact(ctx, im.x - cameraX, im.y, im.t, im.color);
  for (const projectile of projectiles) {
    ctx.fillStyle = '#d7a447';
    ctx.beginPath();
    ctx.arc(projectile.x - cameraX, projectile.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHUD();
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
