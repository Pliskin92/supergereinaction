// Standalone animation viewer for /test/. Pick a character from the
// dropdown; every loaded clip for that character becomes a button,
// arrows/WASD move the sprite around the stage, F flips facing, and number
// keys jump between clips.

const CHAR_TEST_LOOP_ACTIONS = ['idle', 'walk', 'run', 'wave', 'victory', 'dance'];

const CharTest = {
  character: null,
  canvas: null,
  ctx: null,
  actions: [],
  current: null,
  pos: 0,
  facing: 1,
  x: 0,
  y: 0,
  speed: 2,
  held: {},
  lastTime: 0,
  started: false,
};

function charTestSetUp() {
  CharTest.canvas = document.getElementById('testCanvas');
  if (!CharTest.canvas) return;
  CharTest.ctx = CharTest.canvas.getContext('2d');
  CharTest.ctx.imageSmoothingEnabled = false;
  CharTest.x = CharTest.canvas.width / 2;
  CharTest.y = Math.round(CharTest.canvas.height * 0.82);
  window.addEventListener('keydown', charTestKeyDown);
  window.addEventListener('keyup', charTestKeyUp);

  const select = document.getElementById('characterSelect');
  if (select) {
    select.addEventListener('change', () => charTestSelectCharacter(select.value));
  }

  loadAssets().then(() => {
    CharTest.started = true;
    if (select) charTestSelectCharacter(select.value);
    requestAnimationFrame(charTestFrame);
  });
}

function charTestSelectCharacter(character) {
  CharTest.character = character;
  const anims = SpriteAnims[character] || {};
  CharTest.actions = Object.keys(anims);
  CharTest.current = null;
  charTestBuildButtons();
  if (CharTest.actions.length > 0) {
    charTestSetAction(CharTest.actions.includes('idle') ? 'idle' : CharTest.actions[0]);
  }
}

function charTestBuildButtons() {
  const wrap = document.getElementById('controls');
  if (!wrap) return;
  wrap.innerHTML = '';
  CharTest.actions.forEach((action, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${i + 1}. ${action}`;
    btn.dataset.action = action;
    btn.addEventListener('click', () => charTestSetAction(action));
    wrap.appendChild(btn);
  });
}

function charTestSetAction(action) {
  const anims = SpriteAnims[CharTest.character];
  if (!anims || !anims[action]) return;
  CharTest.current = action;
  CharTest.pos = 0;
  document.querySelectorAll('#controls button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.action === action);
  });
}

function charTestKeyDown(e) {
  const k = e.key.toLowerCase();
  if (k.startsWith('arrow')) e.preventDefault();
  if (/^[1-9]$/.test(k)) {
    const idx = Number(k) - 1;
    if (idx < CharTest.actions.length) charTestSetAction(CharTest.actions[idx]);
  }
  if (k === 'f') CharTest.facing *= -1;
  CharTest.held[k] = true;
}

function charTestKeyUp(e) {
  delete CharTest.held[e.key.toLowerCase()];
}

function charTestUpdate(dt) {
  let dx = 0, dy = 0;
  if (CharTest.held.arrowleft || CharTest.held.a) dx--;
  if (CharTest.held.arrowright || CharTest.held.d) dx++;
  if (CharTest.held.arrowup || CharTest.held.w) dy--;
  if (CharTest.held.arrowdown || CharTest.held.s) dy++;
  const step = CharTest.speed * dt * 60;
  CharTest.x = clamp(CharTest.x + dx * step, 24, CharTest.canvas.width - 24);
  CharTest.y = clamp(CharTest.y + dy * step, 60, CharTest.canvas.height - 12);

  if (!CharTest.current) return;
  const anim = SpriteAnims[CharTest.character][CharTest.current];
  const n = anim.frames.length;
  const fps = Math.max(1, n / (anim.durationS || 1));
  CharTest.pos += fps * dt;
  if (CHAR_TEST_LOOP_ACTIONS.includes(CharTest.current)) {
    CharTest.pos %= n;
  } else if (CharTest.pos > n - 0.001) {
    CharTest.pos = n - 0.001;
  }
}

function charTestDraw() {
  const { ctx, canvas } = CharTest;
  ctx.fillStyle = '#10101c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#2a2a3a';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.82 + 4);
  ctx.lineTo(canvas.width, canvas.height * 0.82 + 4);
  ctx.stroke();

  if (!CharTest.current) {
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`No clips loaded for "${CharTest.character}"`, canvas.width / 2, canvas.height / 2);
    return;
  }

  const anim = SpriteAnims[CharTest.character][CharTest.current];
  const frame = getSpriteFrame(CharTest.character, CharTest.current, CharTest.pos / anim.frames.length);
  drawGroundShadow(ctx, CharTest.x, CharTest.y, frame.sw);
  ctx.save();
  ctx.translate(CharTest.x, CharTest.y);
  ctx.scale(CharTest.facing, 1);
  ctx.drawImage(
    frame.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    -frame.sw / 2, -frame.sh, frame.sw, frame.sh
  );
  ctx.restore();

  const idx = Math.min(anim.frames.length - 1, Math.floor(CharTest.pos));
  const loops = CHAR_TEST_LOOP_ACTIONS.includes(CharTest.current);
  ctx.fillStyle = '#ffd15c';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(
    `${CharTest.character} · ${CharTest.current} · frame ${idx + 1}/${anim.frames.length} · ${loops ? 'loop' : 'plays once'}`,
    10, 20
  );
  ctx.fillStyle = '#777';
  ctx.fillText('Move: arrows/WASD · Flip: F · Clips: click or 1-9', 10, 38);
}

function charTestFrame(t) {
  const dtMs = CharTest.lastTime ? t - CharTest.lastTime : 16.7;
  CharTest.lastTime = t;
  charTestUpdate(Math.min(dtMs, 50) / 1000);
  charTestDraw();
  requestAnimationFrame(charTestFrame);
}

charTestSetUp();
