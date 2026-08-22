// Main game loop, states, HUD, menu, shop.

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const BOUNDS = { left: 24, right: W - 24, top: H - 90, bottom: H - 30 };

const GameState = {
  MENU: 'menu',
  LEVEL: 'level',
  SHOP: 'shop',
  GAMEOVER: 'gameover',
  WIN: 'win',
  PAUSED: 'paused',
};

const Input = {
  held: { left: false, right: false, up: false, down: false },
  pressed: { punch: false, slide: false, jump: false, assistLeft: false, assistRight: false },
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
    if (e.key === 'l' || e.key === 'L') triggerAssist();
    if (e.key === 'p' || e.key === 'P') togglePause();
    if (e.key === 'Enter') handleConfirm();
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
}

// ---- Game context ----
let state = GameState.MENU;
let prevState = GameState.MENU;
let player = new Player(60, BOUNDS.bottom - 10);
let assists = new AssistSystem();
let levelIndex = 0;
let level = null;
let unlockedAssists = new Set();
let score = 0;
let gold = 0;
let frame = 0;
let impacts = [];
let shopSelection = 0;
let menuSelection = 0;
let floatTexts = [];

const shopItems = [
  { name: 'Max HP +20', cost: 30, apply: () => { player.maxHp += 20; player.hp = player.maxHp; } },
  { name: 'Full Heal', cost: 15, apply: () => { player.heal(player.maxHp); } },
  { name: 'Combo Power +2', cost: 40, apply: () => { player._comboBonus = (player._comboBonus || 0) + 2; } },
];

function resetRun() {
  player = new Player(60, BOUNDS.bottom - 10);
  assists = new AssistSystem();
  levelIndex = 0;
  level = new LevelRuntime(levelIndex);
  unlockedAssists = new Set();
  score = 0;
  gold = 0;
}

function startLevel(idx) {
  levelIndex = idx;
  level = new LevelRuntime(idx);
  player.x = 60;
  player.y = BOUNDS.bottom - 10;
  player.hitStun = 0;
  state = GameState.LEVEL;
}

function triggerAssist() {
  if (state !== GameState.LEVEL) return;
  if (!player.platinum) return;
  if (unlockedAssists.has('mattia') && assists.canActivate('mattia')) {
    assists.activate('mattia');
  } else if (unlockedAssists.has('michele') && assists.canActivate('michele')) {
    assists.activate('michele');
  }
}

function togglePause() {
  if (state === GameState.LEVEL) { prevState = state; state = GameState.PAUSED; }
  else if (state === GameState.PAUSED) { state = prevState; }
}

function handleConfirm() {
  if (state === GameState.MENU) {
    resetRun();
    startLevel(0);
  } else if (state === GameState.GAMEOVER || state === GameState.WIN) {
    state = GameState.MENU;
  } else if (state === GameState.SHOP) {
    const item = shopItems[shopSelection];
    if (gold >= item.cost) {
      gold -= item.cost;
      item.apply();
      floatTexts.push({ text: `Bought ${item.name}!`, t: 0 });
    }
  }
}

// Shop / menu navigation via left-right like the original scaffold's PADRleft/right cycling
window.addEventListener('keydown', (e) => {
  if (state === GameState.SHOP) {
    if (e.key === 'ArrowUp') shopSelection = (shopSelection + shopItems.length - 1) % shopItems.length;
    if (e.key === 'ArrowDown') shopSelection = (shopSelection + 1) % shopItems.length;
    if (e.key === 'Escape') { advanceFromShop(); }
  }
});

function advanceFromShop() {
  if (levelIndex + 1 < LevelDefs.length) {
    startLevel(levelIndex + 1);
  } else {
    state = GameState.WIN;
  }
}

function update() {
  frame++;
  if (state === GameState.LEVEL) {
    player.update(Input, BOUNDS);
    level.update(player, BOUNDS);
    assists.update(player, level.enemies);

    // player attack resolution
    const hb = player.getAttackHitbox();
    if (hb && !player.attackHit) {
      for (const e of level.activeEnemies()) {
        if (rectsOverlap(hb, e.getHitbox())) {
          e.takeDamage(hb.damage + (player._comboBonus || 0));
          impacts.push({ x: e.x, y: e.y - 20, t: 0, color: player.platinum ? '#8fe8ff' : '#ffe38a' });
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
      state = GameState.GAMEOVER;
    }

    if (level.complete) {
      const def = level.def;
      if (def.unlocksAssist) unlockedAssists.add(def.unlocksAssist);
      if (def.opensShop) {
        state = GameState.SHOP;
        shopSelection = 0;
      } else {
        advanceFromShop();
      }
    }
  }

  impacts = impacts.filter(im => { im.t += 0.06; return im.t < 1; });
  floatTexts = floatTexts.filter(f => { f.t += 1; return f.t < 90; });

  clearPressed();
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---- Rendering ----
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

  // floor
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

function drawHUD() {
  // Face portrait
  const face = player.platinum ? Assets.facePlatinumAngry : Assets.faceHappy;
  if (face) {
    const size = 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(10 + size / 2, 52 + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face, 10, 52, size, size);
    ctx.restore();
    ctx.strokeStyle = player.platinum ? '#8fe8ff' : '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(10 + size / 2, 52 + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // HP bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, 10, 140, 14);
  ctx.fillStyle = '#3fd67a';
  ctx.fillRect(12, 12, 136 * (player.hp / player.maxHp), 10);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(10, 10, 140, 14);
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('HP', 14, 21);

  // Fury / Platinum bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(10, 28, 140, 10);
  ctx.fillStyle = player.platinum ? '#8fe8ff' : '#ffd15c';
  ctx.fillRect(12, 30, 136 * (player.fury / 100), 6);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(10, 28, 140, 10);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.fillText(player.platinum ? 'PLATINUM STATE!' : 'FURY', 14, 36);

  // score / gold
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(`SCORE ${score}`, W - 10, 18);
  ctx.fillText(`GOLD ${gold}`, W - 10, 30);

  // level name
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '9px monospace';
  ctx.fillText(level ? level.def.name : '', W / 2, 16);

  // assist hint
  if (player.platinum) {
    ctx.fillStyle = '#8fe8ff';
    ctx.font = '9px monospace';
    ctx.fillText('Press L to call an Uncle!', W / 2, H - 8);
  }

  for (const f of floatTexts) {
    ctx.globalAlpha = 1 - f.t / 90;
    ctx.fillStyle = '#ffd15c';
    ctx.font = '10px monospace';
    ctx.fillText(f.text, W / 2, H / 2 - f.t * 0.5);
    ctx.globalAlpha = 1;
  }
}

function drawMenu() {
  drawBackground(['#100a1a', '#241a3a']);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd15c';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('SUPER GERE', W / 2, H / 2 - 60);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('Parise Rescue', W / 2, H / 2 - 42);

  const portrait = Assets.heroPortrait;
  if (portrait) {
    const drawH = 130;
    const drawW = portrait.width * (drawH / portrait.height);
    const bob = Math.sin(frame * 0.05) * 3;
    ctx.drawImage(portrait, W / 2 - drawW / 2, H / 2 - drawH / 2 + 20 + bob, drawW, drawH);
  } else {
    drawHumanoid(ctx, W / 2, H / 2 + 40, { walkPhase: frame * 0.1, action: 'walk', facing: 1 }, PlayerColors);
  }

  ctx.font = '10px monospace';
  ctx.fillStyle = frame % 60 < 30 ? '#fff' : '#888';
  ctx.fillText('Press ENTER to start', W / 2, H - 14);
}

function drawShop() {
  const shopImageKey = level ? level.def.shopImage : null;
  drawBackground(['#1a1a2a', '#2a2a40'], shopImageKey);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd15c';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('SHOP', W / 2, 40);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(`Gold: ${gold}`, W / 2, 56);

  shopItems.forEach((item, i) => {
    const y = 90 + i * 26;
    ctx.fillStyle = i === shopSelection ? '#ffd15c' : '#fff';
    ctx.font = '11px monospace';
    ctx.fillText(`${item.name} — ${item.cost}g`, W / 2, y);
  });

  ctx.fillStyle = '#888';
  ctx.font = '9px monospace';
  ctx.fillText('UP/DOWN select, ENTER buy, ESC continue', W / 2, H - 16);
}

function drawGameOver() {
  drawBackground(['#1a0a0a', '#3a1010']);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e84c4c';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 10);
  ctx.font = '9px monospace';
  ctx.fillStyle = frame % 60 < 30 ? '#fff' : '#888';
  ctx.fillText('Press ENTER to return to menu', W / 2, H / 2 + 34);
}

function drawWin() {
  drawBackground(['#0a1a10', '#103a20']);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8fe8ff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('THE FAMILY IS SAVED!', W / 2, H / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '11px monospace';
  ctx.fillText(`Final Score: ${score}`, W / 2, H / 2 + 4);
  ctx.font = '9px monospace';
  ctx.fillStyle = frame % 60 < 30 ? '#fff' : '#888';
  ctx.fillText('Press ENTER to return to menu', W / 2, H / 2 + 28);
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
  drawBackground(level.def.bg, level.def.bgImage);

  const entities = [...level.activeEnemies(), player].sort((a, b) => a.y - b.y);
  for (const ent of entities) ent.draw(ctx);

  assists.draw(ctx, player);

  for (const im of impacts) drawImpact(ctx, im.x, im.y, im.t, im.color);

  drawHUD();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  switch (state) {
    case GameState.MENU: drawMenu(); break;
    case GameState.LEVEL: drawLevel(); break;
    case GameState.SHOP: drawShop(); break;
    case GameState.GAMEOVER: drawGameOver(); break;
    case GameState.WIN: drawWin(); break;
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

loadAssets();
loop();
