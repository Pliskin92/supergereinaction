// Makes the canvas draw at the resolution it is actually displayed at.
//
// The pages size the canvas with CSS (`width: min(96vw, 1100px)`) while its
// backing store stays at the authored 960x387. The browser then scales
// 960 -> 1104 physical pixels, a factor of 1.15, and on a HiDPI screen
// 960 -> 2208, a factor of 2.3. Neither is a whole number, so every sprite
// pixel lands across a fraction of a screen pixel: with
// `image-rendering: pixelated` that means some pixels are drawn one screen
// pixel wide and their neighbours two, which is the uneven, chewed look of
// upscaled pixel art. It is the single biggest thing wrong with how the
// game looks on a real display.
//
// The fix is to make the backing store match the displayed size, times the
// device pixel ratio, and to scale the drawing context so that all the
// game's existing coordinates still mean what they meant. Nothing in the
// game code changes: it keeps drawing in a 960x387 space, and the context
// maps that onto however many real pixels the screen has.
//
// Kept as its own file because all three pages want it and none of them
// should each grow their own copy.

// The space the game draws in. Every coordinate in the game -- HUD layout,
// world bounds, sprite sizes -- is expressed against these, so they are
// what the context is scaled to preserve.
//
// Read from the canvas's own width/height attributes rather than hardcoded,
// because the three pages differ (960x387 level, 960x480 arena, 480x270
// title).
function fitCanvasToDisplay(canvas, ctx) {
  const design = { w: canvas.width, h: canvas.height };

  const apply = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    // Cap the ratio: at DPR 3 a 960-wide canvas becomes a 2880-wide backing
    // store, which is four times the pixels of DPR 1.5 for no visible gain
    // on art authored at 960. Two is the point past which more resolution
    // stops showing on pixel art and starts costing frame time.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width === w && canvas.height === h) return;

    canvas.width = w;
    canvas.height = h;
    // Resizing a canvas resets its context, so everything the page set on
    // it has to be set again here.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(w / design.w, h / design.h);
    // Pixel art: never let the browser interpolate when it scales sprites.
    ctx.imageSmoothingEnabled = false;
  };

  apply();
  // The displayed size changes with the window, with a phone rotating, and
  // when a browser's zoom or a monitor's scaling changes (which moves
  // devicePixelRatio without firing a resize on some browsers).
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  return apply;
}
