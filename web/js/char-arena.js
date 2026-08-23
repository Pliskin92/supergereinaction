// Real gameplay test arena for /test/. Pick a character from the dropdown
// and play them directly — same Player class, same Input/keyMap, same
// controls as the actual game (js/game.js): WASD/arrows to move, Space to
// jump, J for the punch-combo, K to roll, L for the heavy attack. No
// animation pickers, no clip buttons — this is the real character in an
// empty arena, not a viewer.

const canvas = document.getElementById('arenaCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width;
const H = canvas.height;

const BOUNDS = { left: 24, right: W - 24, top: H * 0.5, bottom: H - 30 };

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

let player = new Player(W / 2, BOUNDS.bottom - 10, 'gere');

function selectCharacter(character) {
  player = new Player(W / 2, BOUNDS.bottom - 10, character);
}

function update() {
  player.update(Input, BOUNDS);
  clearPressed();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#2a2a3a';
  ctx.beginPath();
  ctx.moveTo(0, BOUNDS.top);
  ctx.lineTo(W, BOUNDS.top);
  ctx.stroke();
  player.draw(ctx, 0);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
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
  loadAssets();
  loop();
}

arenaSetUp();
