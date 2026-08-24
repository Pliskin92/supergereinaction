// Arena stages: the backdrops the free-play gym can be played in.
//
// A stage is a background image plus the two numbers the gameplay code
// actually needs from it: where the floor is, and how far up the wall the
// playable band starts. Everything else (parallax, props, decoration) is
// part of the artwork rather than something the engine draws, which is the
// point — new stages are added by dropping in art, not by writing another
// drawGym().
//
// Adding a stage:
//   1. put the image at assets/release/backgrounds/<id>/<file>
//   2. add an entry below
// A stage whose image fails to load falls back to the procedural gym, so a
// missing or half-finished asset never leaves the arena unplayable.

// Horizon/floor are expressed as fractions of the BACKGROUND IMAGE's height,
// not the canvas, so they stay correct however the image is scaled to fit.
// Measure them once off the source art and they hold at any canvas size.
//
// They mark the REAL edges of the walkable surface -- the back and front of
// the deck, the wall and the front of the floor. STAGE_EDGE_MARGIN then
// keeps actors off those edges, so nobody stands half in the sea or clipped
// into a back wall. Measuring the true surface and insetting separately
// keeps the two concerns apart: re-measuring art never re-tunes feel, and
// changing the margin never needs the art re-measured.

// Fraction of the walkable depth kept clear at each end.
const STAGE_EDGE_MARGIN = 0.20;
const Stages = {
  gym: {
    name: 'Palestra',
    // The original hand-drawn gym: no image, drawn procedurally by drawGym().
    procedural: true,
    horizon: 0.5,
    floor: 0.94,
    // The bag hangs from the gym's ceiling.
    sack: 'hanging',
  },
  'bonus-stage': {
    name: 'Bonus Stage',
    image: 'assets/release/backgrounds/bonus-stage/bonus-stage arena.jpeg',
    // Measured off the 1536x1024 source: the stone deck's back edge is at
    // y=626 and its front lip at y=796, past which is the sea wall and open
    // water. Only this band is standable -- the water above it is not.
    horizon: 0.611,
    floor: 0.777,
    // Outdoors there is no ceiling to bolt a chain to, so the training
    // target stands on its own base instead of hanging in mid-air.
    sack: 'standing',
    // The bonus stage's target is the car, not a training bag.
    prop: 'car',
  },
};

const DEFAULT_STAGE = 'gym';

// Loaded background images, keyed by stage id. A stage stays absent until
// its image resolves, and drawStage() falls back while it is missing.
const StageImages = {};

function loadStages() {
  return Promise.all(
    Object.entries(Stages)
      .filter(([, def]) => def.image)
      .map(([id, def]) => loadImage(def.image).then((img) => {
        if (img) StageImages[id] = img;
      })),
  );
}

// How a stage's image maps onto the canvas.
//
// The art is scaled to cover the full canvas width and pinned to the bottom,
// because the floor is the part the player stands on: letterboxing at the
// top (sky, ceiling) is harmless, but a gap under the floor line is not.
// Returns the scale plus the canvas-space y of the stage's floor, which is
// what BOUNDS is built from.
function stageLayout(def, img, W, H) {
  const scale = W / img.width;
  const drawH = img.height * scale;
  const top = H - drawH; // negative when the art is taller than the canvas
  return {
    scale,
    drawH,
    top,
    floorY: top + def.floor * drawH,
    horizonY: top + def.horizon * drawH,
  };
}

// World bounds for a stage: the band between the horizon and the floor is
// where actors may stand, matching how the original gym used BOUNDS.top /
// BOUNDS.bottom.
function stageBounds(stageId, W, H, fallback) {
  const def = Stages[stageId];
  const img = StageImages[stageId];
  if (!def || !img) return fallback;
  const layout = stageLayout(def, img, W, H);
  // Inset the band so actors keep clear of both edges of the surface.
  const margin = (layout.floorY - layout.horizonY) * STAGE_EDGE_MARGIN;
  return {
    left: 24,
    right: W - 24,
    top: layout.horizonY + margin,
    bottom: layout.floorY - margin,
  };
}

// Draws the stage backdrop. Returns true if it drew an image; false means
// the caller should draw its own procedural backdrop instead.
function drawStage(ctx, stageId, W, H) {
  const def = Stages[stageId];
  const img = StageImages[stageId];
  if (!def || !img) return false;
  const layout = stageLayout(def, img, W, H);
  // Pixel art: keep it crisp when scaled up rather than blurring it.
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, layout.top, W, layout.drawH);
  ctx.imageSmoothingEnabled = prevSmoothing;
  return true;
}
