// Procedural vector-style sprite drawing for Super Gere and cast.
// Everything is drawn with canvas primitives so no image assets are required.

const Palette = {
  skin: '#f2c49b',
  skinShade: '#d9a578',
  suitBlack: '#1b1b22',
  suitGold: '#e8b13d',
  capeGold: '#f0c34d',
  hair: '#6b4226',
  outline: '#0a0a0a',
};

// Draws a rounded rect helper
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Gym punching bag, hung from the ceiling on a chain like a real one.
// `sway` is a radian angle the bag hangs at, so a hit can set it swinging.
//
// Unlike characters (which are drawn feet-on-origin), the bag hangs: the
// origin passed in is still its ground line, but the geometry is built
// upward from there and the whole assembly pivots at the ceiling anchor,
// so a hit swings the bag through an arc the way a suspended bag actually
// moves. `ceilingY` is where the chain is bolted, in the same space as y.
//
// The shape is authored at a 64px base height, from the era when
// characters were drawn small. AutoSprite characters now render at their
// authored ~194px (see the trim data's reference_height), which left the
// bag looking like a toy next to them. SACK_SCALE brings it up to match.
const SACK_SCALE = 3.6;

// How far the bag's bottom rests above the floor. A hanging bag clears the
// ground; this keeps it at roughly hip height on a character.
const SACK_GROUND_CLEARANCE = 26;

// Length of the boxing-sack swing clip, in ticks. The art is 24 frames;
// played one per tick the swing is over in under half a second, so it is
// stretched to read as a real swing that damps out.
const SACK_SWING_FRAMES = 48;

// How much of the bag sprite's height is the bag itself rather than the
// chain and ceiling bracket above it. Only that lower portion is a
// hurtbox: punching the chain should not count as hitting the bag.
const SACK_BAG_FRACTION = 0.72;

// Colour of the cord run between the ceiling and the bag's own shackle.
const SACK_CHAIN_COLOR = '#0a0a0a';

// How far the hanging bag is raised off its ground anchor. The sprite is
// drawn feet-down from this.y like any other actor, so lifting it here
// shortens the drop without touching the stage's floor line.
const SACK_HANG_LIFT = 20;

// Draws the chain run between a ceiling anchor and the top of the bag
// sprite. The bag art includes its own shackle and a short length of
// chain, but not the full drop to the roof (the art can't know how high
// the ceiling is), so this bridges the remaining gap and caps it with a
// mount plate. Nothing is drawn when the sprite already reaches the
// anchor.
// Height of one chain link. Links are drawn end-to-end down the run, so
// this is also the repeat distance of the pattern.
const SACK_LINK_H = 9;

function drawSackChain(ctx, x, topY, ceilingY) {
  if (topY <= ceilingY) return;
  ctx.save();

  // Eye bolt: a plate bolted to the ceiling with a ring hanging off it,
  // which is what the top link actually threads through.
  ctx.fillStyle = '#2a2a32';
  rr(ctx, x - 11, ceilingY, 22, 5, 2);
  ctx.fill();
  ctx.strokeStyle = SACK_CHAIN_COLOR;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, ceilingY + 8, 4, 0, Math.PI * 2);
  ctx.stroke();

  // The chain proper: oval links, each rotated 90 degrees from the one
  // above it, which is what makes a real chain read as a chain rather
  // than a rope. Alternating links are drawn narrow to fake that
  // edge-on foreshortening.
  const top = ceilingY + 11;
  const runH = topY - top;
  const links = Math.max(1, Math.round(runH / SACK_LINK_H));
  const linkH = runH / links;
  for (let i = 0; i < links; i++) {
    const cy = top + (i + 0.5) * linkH;
    const edgeOn = i % 2 === 1;
    const rx = edgeOn ? 1.6 : 3.6;
    ctx.lineWidth = edgeOn ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.ellipse(x, cy, rx, linkH * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// The car's damage states, in sheet-frame order: pristine through to a
// flattened wreck. Extracted from the SF2-style source sheet (kept beside
// the pack as spritesheet_source.png), one tile per state.
const CAR_FRAME_HEALTHY = 0;
const CAR_FRAME_WRECK = 8;
const CAR_FRAME_COUNT = 9;

// Each state takes this much damage to move past, so the car's total HP is
// simply this times the number of steps.
const CAR_HP_PER_PIECE = 50;
const CAR_DAMAGE_STEPS = CAR_FRAME_COUNT - 1;

// The car is drawn side-on, so its zones run along its length. A hit picks
// the zone it landed in, which is where the impact debris is thrown from.
const CAR_ZONES = ['front', 'cabin', 'rear'];

// Impact debris pulled from the source sheet's bottom bands, grouped by
// what each sprite reads as. Indices are into the 'fx' clip.
const CAR_FX = {
  glass: [0, 1, 2, 3, 4, 5],
  debris: [6, 7, 8, 9, 10, 11, 12],
  chips: [13, 14, 15],
  spark: [16, 17, 18, 19, 20],
};
const CAR_FX_COUNT = 21;

// Minions teleport in rather than standing pre-placed on the street. The
// arrival is a small blue light that expands into a square, holds, then
// fades as the minion materialises inside it.
const TELEPORT_FRAMES = 34;
// Fraction of the effect spent on the flash before the minion starts
// fading in, and the point by which it is fully solid.
const TELEPORT_FLASH_END = 0.35;
const TELEPORT_SOLID_AT = 0.85;

// Draws the arrival effect at a character's feet. `t` is 0..1 progress.
// Returns the alpha the minion itself should be drawn at, so the sprite
// fades up inside the light rather than popping in at the end.
function drawTeleport(ctx, x, y, t, height, colors = TELEPORT_COLOR) {
  const p = clamp(t, 0, 1);
  ctx.save();
  ctx.translate(x, y);

  // The square: a thin blue outline that snaps open, then dissolves.
  const grow = p < TELEPORT_FLASH_END ? p / TELEPORT_FLASH_END : 1;
  const fade = p < TELEPORT_FLASH_END ? 1 : 1 - (p - TELEPORT_FLASH_END) / (1 - TELEPORT_FLASH_END);
  const h = height * grow;
  const w = height * 0.42 * grow;

  ctx.globalAlpha = fade * 0.9;
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = 2;
  ctx.strokeRect(-w / 2, -h, w, h);

  // Inner glow, brightest at the start.
  ctx.globalAlpha = fade * 0.28;
  ctx.fillStyle = colors.glow;
  ctx.fillRect(-w / 2, -h, w, h);

  // A bright horizontal scan line that sweeps up as the body forms.
  ctx.globalAlpha = fade * 0.95;
  ctx.strokeStyle = colors.scan;
  ctx.lineWidth = 3;
  const scanY = -h * clamp(p / TELEPORT_SOLID_AT, 0, 1);
  ctx.beginPath();
  ctx.moveTo(-w / 2, scanY);
  ctx.lineTo(w / 2, scanY);
  ctx.stroke();

  ctx.restore();

  // Sprite alpha: nothing during the flash, then fades up to solid.
  if (p < TELEPORT_FLASH_END) return 0;
  return clamp((p - TELEPORT_FLASH_END) / (TELEPORT_SOLID_AT - TELEPORT_FLASH_END), 0, 1);
}

// The player's respawn arrival: the same teleport shape as a minion's, but
// red, so a death read differently from an enemy turning up.
const RESPAWN_TELEPORT_COLOR = {
  edge: '#ff6a6a',
  glow: '#c81f2e',
  scan: '#ffdede',
};
const TELEPORT_COLOR = {
  edge: '#7ad7ff',
  glow: '#4fb8ff',
  scan: '#dff4ff',
};

// A life pip in the HUD. Filled while the life is in hand, hollow once
// spent, so the count reads at a glance.
function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 12, size / 12);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.bezierCurveTo(-7, -3, -4, -8, 0, -4);
  ctx.bezierCurveTo(4, -8, 7, -3, 0, 4);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = '#e84c4c';
    ctx.fill();
  }
  ctx.strokeStyle = filled ? '#ffb3b3' : 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

// Loot dropped by defeated enemies.
//
// One table, ordered rarest-last, rolled once over a single 0..1 range so
// each chance is exactly what it says rather than being conditioned on the
// previous entry having failed. The old code rolled fury first and health
// second for precisely this reason; with five outcomes a table is clearer
// than a chain of else-ifs, and it keeps the odds, the effect and the
// bottle colour in one place.
//
// Total drop rate is 33%: 15+10+5+2+1. The remaining 67% of kills leave
// nothing.
const LOOT_TABLE = [
  // kind, chance, and what picking it up does. `heal` is a fraction of max
  // health; the other two effects are handled by kind in Potion.update().
  { kind: 'health_small', chance: 0.15, heal: 0.10 },
  { kind: 'health_medium', chance: 0.10, heal: 0.50 },
  { kind: 'health_large', chance: 0.05, heal: 1.00 },
  { kind: 'fury', chance: 0.02 },
  { kind: 'heart', chance: 0.01 },
];

// Looked up by kind when a potion is picked up.
const LOOT_BY_KIND = {};
for (const entry of LOOT_TABLE) LOOT_BY_KIND[entry.kind] = entry;

// Rolls the table once. Returns a kind, or null for no drop.
function rollLoot() {
  let roll = Math.random();
  for (const entry of LOOT_TABLE) {
    if (roll < entry.chance) return entry.kind;
    roll -= entry.chance;
  }
  return null;
}

// A boss's own table. Beating one is a milestone, so unlike the minion
// table this one always pays out -- the chances here divide up a certain
// drop rather than sharing the street with a 67% chance of nothing.
//
// The two boosts are permanent upgrades to the run, which is what makes a
// boss worth beating beyond simply getting past it.
const BOSS_LOOT_TABLE = [
  { kind: 'heart', chance: 0.34 },
  { kind: 'boost_hp', chance: 0.33 },
  { kind: 'boost_atk', chance: 0.33 },
];

function rollBossLoot() {
  let roll = Math.random();
  for (const entry of BOSS_LOOT_TABLE) {
    if (roll < entry.chance) return entry.kind;
    roll -= entry.chance;
  }
  // Rounding slack: never leave a boss's drop to a floating-point edge.
  return BOSS_LOOT_TABLE[BOSS_LOOT_TABLE.length - 1].kind;
}

// How much each boss boost gives. Both are permanent for the rest of the
// run: max health raised (and topped up by the same amount, so it is felt
// immediately rather than only after the next heal), and every attack
// hitting harder.
const BOSS_HP_BOOST = 20;
const BOSS_ATK_BOOST = 1.15;

const POTION_PICKUP_RANGE = 46;
const POTION_BOB_SPEED = 0.09;

// Drawn procedurally: a small flask with a glow, so it reads as a pickup
// against a busy street without needing art of its own.
//
// Colour is how the player tells the tiers apart at a glance, so each is
// distinct and the rarer ones read as richer: white, blue, green, red, and
// the heart in gold.
const POTION_COLORS = {
  health_small: { dark: '#8d939c', light: '#f2f5f8', glow: '#dfe6ee' },
  health_medium: { dark: '#1d4b8f', light: '#4d9be8', glow: '#5ab0ff' },
  health_large: { dark: '#2f6b34', light: '#5ac85a', glow: '#5ac85a' },
  fury: { dark: '#7a1f2a', light: '#e8453f', glow: '#ff6a3d' },
  heart: { dark: '#8a5a12', light: '#ffd54d', glow: '#ffc93d' },
  // Boss boosts: violet for vitality, orange for power.
  boost_hp: { dark: '#4a1f6b', light: '#a86ae0', glow: '#c08cff' },
  boost_atk: { dark: '#7a3a0d', light: '#f0913a', glow: '#ffab4d' },
  // Deliberately garish: shown only when a kind has no colour defined.
  __missing: { dark: '#ff00ff', light: '#ff66ff', glow: '#ff00ff' },
};

// One-time report of which potion colours this build actually has, logged
// to the browser console the first time a bottle is drawn. If the page is
// running a stale cached sprites.js this prints the OLD, short list, which
// is what distinguishes a caching problem from a logic one.
let potionPaletteLogged = false;
function logPotionPalette() {
  if (potionPaletteLogged) return;
  potionPaletteLogged = true;
  const kinds = Object.keys(POTION_COLORS).filter((k) => k !== '__missing');
  console.log('[potions] build has ' + kinds.length + ' colours: ' + kinds.join(', '));
}

function drawPotion(ctx, x, y, phase, kind = 'health_small') {
  logPotionPalette();
  if (!POTION_COLORS[kind]) {
    console.warn('[potions] no colour for kind "' + kind
      + '" -- drawing it magenta. This build is out of date.');
  }
  // No silent fallback to another tier's colour. A kind with no entry here
  // is a bug (a stale cached script, a typo in a table), and quietly
  // painting it green made exactly that failure look like working code --
  // white and blue bottles rendering as green rather than as something
  // obviously wrong. Magenta is not in any tier's palette, so it reads as
  // "this is broken" at a glance.
  const c = POTION_COLORS[kind] || POTION_COLORS.__missing;
  const bob = Math.sin(phase) * 4;
  ctx.save();
  ctx.translate(x, y + bob);

  // glow
  ctx.globalAlpha = 0.30 + Math.sin(phase * 1.6) * 0.10;
  ctx.fillStyle = c.glow;
  ctx.beginPath();
  ctx.arc(0, -10, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // The extra life is not a potion at all, so it is not drawn as one: it
  // is the same heart the HUD uses for the life count, which is what makes
  // it read as a life rather than as another bottle to drink.
  if (kind === 'heart') {
    ctx.save();
    ctx.translate(0, -12);
    ctx.scale(1.9, 1.9);
    drawHeart(ctx, 0, 0, 12, true);
    ctx.restore();
    ctx.restore();
    return;
  }

  // flask body
  ctx.fillStyle = c.dark;
  rr(ctx, -8, -18, 16, 18, 5);
  ctx.fill();
  ctx.fillStyle = c.light;
  rr(ctx, -6, -12, 12, 11, 4);
  ctx.fill();
  // neck + cork
  ctx.fillStyle = c.dark;
  ctx.fillRect(-3, -24, 6, 7);
  ctx.fillStyle = '#c9963f';
  ctx.fillRect(-4, -27, 8, 4);
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-4, -15, 2, 6);

  ctx.strokeStyle = Palette.outline;
  ctx.lineWidth = 1;
  rr(ctx, -8, -18, 16, 18, 5);
  ctx.stroke();
  ctx.restore();
}

// A killed enemy pops in a short blast and is gone. Kept brief -- this is
// punctuation on a kill, not a set piece.
const ENEMY_BLAST_FRAMES = 26;
const ENEMY_BLAST_RINGS = 3;

// How long one debris particle lives, in ticks, and how many are thrown per
// hit. Kept short so the burst reads as an impact rather than litter.
const CAR_FX_LIFE = 34;
const CAR_FX_PER_HIT = 7;
const CAR_FX_GRAVITY = 0.42;

// Extra slack added around the bag's hurtbox on every side. The bag is an
// inert training target, so a forgiving box is the point: the player should
// connect when they look like they should, not only on an exact overlap.
const SACK_HIT_PADDING = 18;

// The bag is drawn only from its sprite pack. There is no procedural
// stand-in any more: assets are awaited before the game loop starts, so
// a missing frame means the art failed to load rather than being still
// in flight, and drawing an older placeholder only ever looked like a bug.

// Expanding flash rings marking a defeated enemy. Purely cosmetic and
// drawn with primitives, so it needs no sprite art of its own.
function drawEnemyBlast(ctx, x, y, t) {
  if (t >= 1) return;
  ctx.save();
  ctx.translate(x, y);

  // Core first, so the rings expand OUT of it rather than being painted
  // over by it. It also fades fast, which is what makes the pop read as a
  // flash rather than a lingering blob.
  const core = clamp(1 - t * 3.2, 0, 1);
  if (core > 0) {
    ctx.globalAlpha = core * 0.9;
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.arc(0, 0, 4 + core * 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rings start at staggered times so the burst reads as a pop rather than
  // a single expanding circle.
  for (let i = 0; i < ENEMY_BLAST_RINGS; i++) {
    const rt = clamp((t - i * 0.14) / 0.72, 0, 1);
    if (rt <= 0) continue;
    const r = 10 + rt * (62 - i * 12);
    ctx.globalAlpha = (1 - rt) * 0.95;
    ctx.strokeStyle = i === 0 ? '#fff3c4' : (i === 1 ? '#ffd54d' : '#ff8a3d');
    ctx.lineWidth = 6 - i * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // A few sparks flung outward, so it is not purely concentric.
  ctx.globalAlpha = clamp(1 - t * 1.3, 0, 1);
  ctx.strokeStyle = '#ffd54d';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    const r0 = 14 + t * 34;
    const r1 = r0 + 14;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.7);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.7);
    ctx.stroke();
  }

  ctx.restore();
}

// Generic humanoid draw used for player + family cast, parameterized by palette/pose.
// pose: { walkPhase, action, facing, hitFlash }
function drawHumanoid(ctx, x, y, pose, colors) {
  const facing = pose.facing || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  const bob = pose.action === 'walk' ? Math.sin(pose.walkPhase) * 2 : 0;
  const legSwing = pose.action === 'walk' ? Math.sin(pose.walkPhase) * 8 : 0;
  const armSwing = pose.action === 'walk' ? Math.sin(pose.walkPhase) * 10 : 0;

  let armL = { x: -6, y: -20 + bob };
  let armR = { x: 6, y: -20 + bob };
  let legAngleL = legSwing;
  let legAngleR = -legSwing;
  let torsoLean = 0;
  let torsoY = bob;

  if (pose.action === 'punch1' || pose.action === 'punch2' || pose.action === 'punch3') {
    armR = { x: 16, y: -22 };
    torsoLean = 6;
  } else if (pose.action === 'slide') {
    torsoY = 10;
    legAngleL = 30;
    legAngleR = -10;
    torsoLean = -8;
  } else if (pose.action === 'hurt') {
    torsoLean = -10;
    torsoY = -2;
  } else if (pose.action === 'ko') {
    torsoLean = 90;
    torsoY = 18;
  }

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(0, torsoY);
  ctx.rotate((torsoLean * Math.PI) / 180);

  // cape (if present)
  if (colors.cape) {
    ctx.fillStyle = colors.cape;
    ctx.strokeStyle = Palette.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const capeSway = Math.sin((pose.walkPhase || pose.time || 0) * 0.5) * 4;
    ctx.moveTo(-6, -30);
    ctx.quadraticCurveTo(-16 + capeSway, -18, -14 + capeSway, 2);
    ctx.quadraticCurveTo(-10, -6, -4, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // back arm
  drawLimb(ctx, armL.x * -1 + armSwing * 0.2, armL.y, 5, 14, colors.suit, -legSwing * 0.5);

  // legs
  drawLimb(ctx, -4, -6, 6, 16, colors.suit, legAngleL, true);
  drawLimb(ctx, 4, -6, 6, 16, colors.suit, legAngleR, true);

  // torso
  ctx.fillStyle = colors.suit;
  ctx.strokeStyle = Palette.outline;
  ctx.lineWidth = 1.2;
  rr(ctx, -9, -32, 18, 22, 4);
  ctx.fill();
  ctx.stroke();

  // belt
  ctx.fillStyle = colors.accent;
  ctx.fillRect(-9, -12, 18, 3);

  // chest emblem
  if (colors.emblem) {
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(colors.emblem, 0, -20);
  }

  // front arm
  const frontArmY = pose.action && pose.action.startsWith('punch') ? armR.y : armR.y + bob;
  if (pose.action === 'punch1' || pose.action === 'punch2' || pose.action === 'punch3') {
    ctx.fillStyle = colors.suit;
    drawFist(ctx, armR.x, frontArmY, colors.skin || Palette.skin);
  } else {
    drawLimb(ctx, armR.x - armSwing * 0.2, -20 + bob, 5, 14, colors.suit, legSwing * 0.5);
  }

  // head
  const headY = -38;
  ctx.fillStyle = colors.skin || Palette.skin;
  ctx.strokeStyle = Palette.outline;
  ctx.beginPath();
  ctx.arc(0, headY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // hair
  ctx.fillStyle = colors.hair || Palette.hair;
  ctx.beginPath();
  ctx.arc(0, headY - 2, 8.5, Math.PI, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = Palette.outline;
  if (pose.action === 'ko') {
    ctx.beginPath();
    ctx.moveTo(-3, headY - 1); ctx.lineTo(-1, headY + 1);
    ctx.moveTo(-1, headY - 1); ctx.lineTo(-3, headY + 1);
    ctx.moveTo(1, headY - 1); ctx.lineTo(3, headY + 1);
    ctx.moveTo(3, headY - 1); ctx.lineTo(1, headY + 1);
    ctx.strokeStyle = Palette.outline;
    ctx.stroke();
  } else {
    ctx.fillStyle = Palette.outline;
    ctx.fillRect(1.5, headY - 1, 2, 2);
    ctx.fillRect(-3.5, headY - 1, 2, 2);
  }

  ctx.restore(); // torso rotate/translate

  ctx.restore(); // facing scale
}

function drawLimb(ctx, x, y, w, h, color, angleDeg, isLeg) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.strokeStyle = Palette.outline;
  ctx.lineWidth = 1;
  rr(ctx, -w / 2, 0, w, h, 2);
  ctx.fill();
  ctx.stroke();
  if (isLeg) {
    ctx.fillStyle = Palette.suitBlack;
    ctx.fillRect(-w / 2 - 1, h - 2, w + 2, 4);
  }
  ctx.restore();
}

function drawFist(ctx, x, y, skin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = skin;
  ctx.strokeStyle = Palette.outline;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Draws an impact star burst for hit effects
function drawImpact(ctx, x, y, t, color) {
  const r = 6 + t * 14;
  const alpha = Math.max(0, 1 - t);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color || '#fff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}
