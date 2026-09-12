// Title-screen page (web/index.html).
//
// This page is only the menu. Both entries that start play navigate to
// their own page — Arena to web/arena/, New Game to web/game/ — each with
// its own loop and script set, so there is no gameplay state, no camera
// and no combat here.

const canvas = document.getElementById('titleCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
// The DESIGN size -- the coordinate space the game draws in -- read before
// fitCanvasToDisplay() resizes the backing store to the display's real
// pixels. Read after, these would be physical pixels and every layout
// number in the file would be wrong.
const W = canvas.width;
const H = canvas.height;
// Match the backing store to the displayed size so pixel art is not scaled
// by a fraction. The context is scaled so W/H above still mean what they
// meant; see js/canvas-fit.js.
fitCanvasToDisplay(canvas, ctx);

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
