// Title-screen page (web/index.html).
//
// This page is only the menu. Both entries that start play navigate to
// their own page — Arena to web/arena/, New Game to web/game/ — each with
// its own loop and script set, so there is no gameplay state, no camera
// and no combat here.

const canvas = document.getElementById('titleCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width;
const H = canvas.height;

const titleMenu = new TitleMenu(W, H);
const heldKeys = new Set();

window.addEventListener('keydown', (e) => {
  // Menu navigation only acts on the initial press, not on key repeat.
  if (!heldKeys.has(e.key)) titleMenu.handleKey(e.key);
  heldKeys.add(e.key);
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  heldKeys.delete(e.key);
});

function loop() {
  titleMenu.update();
  ctx.clearRect(0, 0, W, H);
  titleMenu.draw(ctx);
  requestAnimationFrame(loop);
}

loop();
