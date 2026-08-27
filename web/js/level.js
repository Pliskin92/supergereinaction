// Level 1: a scrolling street you can walk along.
//
// This is the side-scrolling counterpart to the free-play arena. The arena
// is one fixed screen (it draws every actor at cameraX 0); here the world is
// wider than the canvas, so a camera follows the player and the backdrop
// repeats to fill however far they walk.
//
// Entities already speak world space -- Player.update() clamps against a
// world-space BOUNDS, and both Player.draw() and Enemy.draw() take a
// cameraX and subtract it -- so scrolling needs no changes to them at all.

const canvas = document.getElementById('levelCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = canvas.width;
const H = canvas.height;

// How many times the background strip repeats end to end. The art loops, so
// the level is simply the strip laid down this many times; walking off the
// last copy is what ends the level once there is somewhere to go.
// At 12 the street ran 22,260px -- over 23 screen-widths -- for a roster of
// 72 minions. However the packs were spread across that, most of the level
// was empty pavement. The strip is laid down enough times to give the fight
// somewhere to happen and no further; density is then set by the spacing
// below rather than by stretching a fixed roster over whatever length the
// loop count happened to produce.
const LEVEL_LOOPS = 6;

// Enemy layout. Minions arrive in locked encounters rather than trickling
// in: walk far enough and a group teleports in ON SCREEN, the street locks,
// and the lock only lifts once every one of them is down. That is the
// beat-em-up shape -- fight a room, move on -- instead of a running battle
// you can outrun.
//
// Spacing is expressed in SCREEN-WIDTHS, not as a fraction of the world.
// What "too much walking between packs" means is how long the street stays
// empty in front of you, and the screen is the unit the player actually
// perceives that in. Tying it to the world instead meant the gap silently
// changed whenever LEVEL_LOOPS did, and at 12 loops it worked out to 1,261px
// -- a solid nineteen seconds of walking between fights.
//
// Just under half a screen, measured from where the last fight ended.
//
// 0.78 was set when the gap was measured from where a fight STARTED, which
// hid how far the player actually had to walk: the true distance ran up to
// ~18 seconds depending on where in the locked screen they finished. Now
// that the gap is measured from the player at the moment the street opens,
// this is the real walk -- about two seconds at a run, four at a stroll --
// which is a breath between fights rather than a trek.
const LEVEL_ENCOUNTER_SPACING_SCREENS = 0.42;
// Randomised by up to this fraction of the spacing, so the level does not
// tick over like a metronome. Applied per encounter (see nextEncounterX).
const LEVEL_ENCOUNTER_JITTER = 0.25;
// How many arrive together in one encounter. Packs vary in size for the
// same reason the spacing does -- a fixed five every time is a rhythm the
// player stops reading after the third one.
// The upper bound is what one screen can hold at LEVEL_SPAWN_MIN_GAP_X
// without minions overlapping: at 7 the slots on the busier side get
// narrow enough that a pair reads as one clump in about an eighth of
// packs, so the pack tops out at 6 and the pressure comes from the boss
// and the pacing rather than from cramming bodies onto one screen.
// Share of each pack that arrives as bananana rather than the standard
// minion, rolled per spawn. Kept a minority on level 1: it is the tougher
// of the two, so it reads as the occasional harder body in a pack rather
// than the default one. Later levels can raise this.
const LEVEL_BANANANA_SHARE = 0.3;
// Both street minion types. Which one a slot gets is a roll against the
// share above; everything else about them is identical to the level (they
// share the pack, the lock, and the score latch).
const LEVEL_MINION_TYPES = { standard: 'minion', tough: 'bananana' };

const LEVEL_ENCOUNTER_SIZE_MIN = 4;
const LEVEL_ENCOUNTER_SIZE_MAX = 6;
// A cap rather than a quota. Encounters keep coming at the spacing above
// for as long as there is street left, and this only stops them running
// away with themselves -- it is set high enough that the spacing, not the
// roster, is what decides where the fights are. Budgeting the other way
// round (a fixed 72 spread over the level) is what produced the long empty
// stretches: the roster ran the pacing instead of the pacing running the
// roster.
// The level's roster, and the real budget rather than a ceiling that never
// binds. It used to sit at 200 while the encounter spacing decided the true
// count -- ~23 packs of 4-6, so 93-139 minions actually spawned and the cap
// was dead code. Level 1 is meant to be the gentle one, so the roster is
// the number now and the spacing is derived from it (see encounterSpacing)
// so the fights still spread across the whole street instead of all being
// crammed into the first third.
//
// Randomised per run within +/- LEVEL_MINION_JITTER so two playthroughs are
// not the identical sequence of packs. Later levels raise this.
const LEVEL_MINION_TARGET = 60;
const LEVEL_MINION_JITTER = 6;
// Rolled once at level setup; nextEncounterX() stops packs when it is spent.
let levelMinionTotal = LEVEL_MINION_TARGET;
// Where along the world the first encounter fires and the last one may.
// The tail is kept clear so the walk into the boss is a beat of quiet
// rather than a pack fought on his doorstep.
const LEVEL_ENCOUNTER_FROM = 0.04;
const LEVEL_ENCOUNTER_TO = 0.88;
// Where in the visible screen they may appear, as fractions of its width.
// Kept inside the edges so nobody materialises half off-screen, and clear
// of the very centre so they do not land on top of the player.
// Widened from 0.10/0.90: with the clear-of-player gap taken off each
// side, that inset left only ~274px per side on a 960px screen -- room for
// one minion at the minimum spacing, so a pack of six could not be split
// and bunched up on whichever side had space. The sprites are drawn from
// their centre and the level clamps these into view anyway, so the band
// can safely run nearer the edges.
const LEVEL_SPAWN_SCREEN_MIN = 0.04;
const LEVEL_SPAWN_SCREEN_MAX = 0.96;
// Far enough that a minion never lands on top of the player, but no
// further: every pixel here is taken off both spawn bands twice over.
const LEVEL_SPAWN_CLEAR_OF_PLAYER = 90;
// Minimum gap between two minions of the same pack, across the screen and
// through the lane's depth. Sprites are ~180px wide, so placing them by
// independent random rolls put two on top of each other in a third of all
// packs -- the group read as a clump rather than a line to fight through.
// Placement is now spread deliberately (see spreadSpawnXs) and these are
// the separations it holds to.
const LEVEL_SPAWN_MIN_GAP_X = 120;
const LEVEL_SPAWN_MIN_GAP_Y = 0.16;
// A pack arrives split around the player rather than all in front: some
// ahead, some cutting off the retreat behind. This is the share placed on
// the side the player is facing; the rest come from behind.
const LEVEL_SPAWN_AHEAD_SHARE = 0.6;
// The lock holds the player this far back from the right edge of the
// locked zone, so the barrier is felt rather than invisible.
const LEVEL_LOCK_MARGIN = 40;

const LEVEL_BOSS_AT = 0.95;

// A minion only thinks within this range of the player, so distant ones
// cost nothing. It has to comfortably exceed the spawn distance -- minions
// arrive just off either screen edge, which is already ~480px away from a
// centred player -- or a freshly teleported one would stand frozen where
// it landed instead of walking in.
const ENEMY_ACTIVATE_RANGE = 900;

// The street strip. Repeated LEVEL_LOOPS times to make the world.
const LEVEL_BACKGROUND = 'assets/release/backgrounds/lv1/lv1-background.png';

// Remembers that the opening cutscene has played, for this tab only.
const INTRO_SEEN_KEY = 'supergere.introSeen';

// The walkable band inside the background art, as fractions of the image
// height (see stages.js for the same convention).
//
// Measured off lv1-background.png (1855x387): the pavement runs from its
// kerb edge at y=283 to the front lip at y=351, past which is the basement
// wall. Only the pavement is walkable -- the road above the kerb is
// backdrop, not playfield.
const LEVEL_WALK_TOP = 0.731;
const LEVEL_WALK_BOTTOM = 0.907;
// Keep actors clear of both edges of that band, as the arena stages do.
const LEVEL_EDGE_MARGIN = 0.18;

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
  // The summary screen owns the keyboard outright while it is up: its name
  // field takes plain letters, which are also the combat keys, so this has
  // to run before -- and instead of -- the gameplay bindings rather than
  // alongside them.
  // The cutscene takes Enter to skip and Escape to leave, and swallows
  // everything else so combat keys do not leak into it.
  if (intro && !intro.done) {
    if (e.key === 'Enter') intro.skip();
    else if (e.key === 'Escape') window.location.href = '/index.html';
    e.preventDefault();
    return;
  }
  if (levelClear) {
    if (e.key === 'Escape') window.location.href = '/index.html';
    else if (e.key === 'Enter') {
      if (!scoreSaved) commitScore();
      else window.location.href = '/index.html';
    } else if (!scoreSaved) {
      if (e.key === 'Backspace') nameEntry = nameEntry.slice(0, -1);
      // One printable character per press; anything longer is a named key
      // (Shift, ArrowLeft, ...) and is ignored.
      else if (e.key.length === 1 && nameEntry.length < NAME_MAX) {
        nameEntry += e.key.toUpperCase();
      }
    }
    e.preventDefault();
    return;
  }
  if (keyMap[e.key]) Input.held[keyMap[e.key]] = true;
  if (!heldKeys.has(e.key)) {
    if (e.key === 'j' || e.key === 'J') Input.pressed.punch = true;
    if (e.key === 'k' || e.key === 'K') Input.pressed.slide = true;
    if (e.key === 'l' || e.key === 'L') Input.pressed.heavy = true;
    if (e.key === ' ') Input.pressed.jump = true;
    // No debug FURY key here: in the level the meter has to be earned by
    // landing and taking hits. Forcing it is an arena-only convenience.
    // Root-relative: this page sets <base href="/">.
    if (e.key === 'Escape') window.location.href = '/index.html';
    // Enter restarts the level once every life is spent.
    if (e.key === 'Enter' && player.gameOver) window.location.reload();
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

let background = null;
let worldWidth = W;       // total walkable width, set once the art loads
let cameraX = 0;
// Layout of the drawn backdrop, derived from the image once it is loaded.
let bgScale = 1;
let bgDrawW = W;
let bgDrawH = H;
let bgTop = 0;

let BOUNDS = { left: 24, right: W - 24, top: H * 0.6, bottom: H - 30 };
let player = new Player(120, BOUNDS.bottom, 'gere');
let enemies = [];
let potions = [];
let minionsSpawned = 0;
let encountersDone = 0;
// World x the next pack fires at. Walked forward one spacing at a time by
// advanceEncounterMark() rather than derived from encountersDone, so the
// gap between fights is a fixed distance instead of a slice of the world.
let nextEncounterAt = 0;
// Right-hand wall while an encounter is being fought; 0 when the street is
// open. The player cannot walk past it until the group is cleared.
let lockUntilX = 0;
const furyPopup = new FuryPopup();

// ---- End of run ----
// Frames the run has been going, which drives the clock in the HUD and the
// time bonus in the summary. Only ticks while the level is actually being
// played, so the summary screen does not eat into the bonus.
let runFrames = 0;
// False until every sprite sheet, face still and the background have
// arrived. The level does not run or draw its world before this: the whole
// point is that the player never sees a half-loaded frame -- a procedurally
// drawn stick-figure Gere, or an empty portrait box -- in place of the art.
let assetsReady = false;

// The opening cutscene. Runs once, after the loading gate opens and before
// gameplay starts; `introDone` is what hands control over. Skipped entirely
// on a replay within the same session (see levelSetUp) so retrying a run
// does not mean sitting through it again.
let intro = null;

// Set once spawnEnemies() has placed the boss. Guards checkLevelClear from
// firing during the frames before the level has been laid out.
let bossSpawned = false;
// Null while playing; set to the computed summary once the boss is down.
let levelClear = null;
// Name being typed into the highscore entry, and whether it has been
// committed. Entry only appears when the score actually makes the table.
let nameEntry = '';
let scoreSaved = false;
const NAME_MAX = 8;

// Floating "+250" numbers, one per kill. Purely cosmetic: they own no
// score state, they just render what addScore() already banked.
let scorePops = [];

// How long a score number stays up, and how far it drifts while it does.
const SCORE_POP_FRAMES = 55;
const SCORE_POP_RISE = 34;

class ScorePop {
  constructor(x, y, points, combo) {
    this.x = x;
    this.y = y;
    this.points = points;
    // A chain of 2+ is called out beside the number, so the multiplier is
    // visible where it is earned rather than only in the corner HUD.
    this.combo = combo > 1 ? combo : 0;
    this.timer = SCORE_POP_FRAMES;
  }

  get done() {
    return this.timer <= 0;
  }

  update() {
    if (this.timer > 0) this.timer--;
  }

  draw(ctx, cameraX) {
    if (this.timer <= 0) return;
    const p = 1 - this.timer / SCORE_POP_FRAMES; // 0 -> 1
    ctx.save();
    // Fades only over the last third, so the number is readable first.
    ctx.globalAlpha = p > 0.66 ? 1 - (p - 0.66) / 0.34 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = 'bold 16px Impact, "Arial Black", sans-serif';
    const x = this.x - cameraX;
    const y = this.y - p * SCORE_POP_RISE;
    const text = this.combo ? `+${this.points}  x${this.combo}` : `+${this.points}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1a1020';
    ctx.strokeText(text, x, y);
    // A chained kill reads gold; a lone one stays white.
    ctx.fillStyle = this.combo ? '#ffd54d' : '#ffffff';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

// Scales the strip to fill the canvas height, then works out the world's
// width and the walkable band from the art's own proportions.
function layoutLevel(img) {
  bgScale = H / img.height;
  bgDrawW = img.width * bgScale;
  bgDrawH = H;
  bgTop = 0;
  worldWidth = bgDrawW * LEVEL_LOOPS;

  const top = bgTop + LEVEL_WALK_TOP * bgDrawH;
  const bottom = bgTop + LEVEL_WALK_BOTTOM * bgDrawH;
  const margin = (bottom - top) * LEVEL_EDGE_MARGIN;
  BOUNDS = {
    left: 24,
    right: worldWidth - 24,
    top: top + margin,
    bottom: bottom - margin,
  };
  player.x = 120;
  player.y = BOUNDS.bottom;
  // Full health, empty FURY. Boosts and lives earned earlier carry over.
  player.startLevel();
  spawnEnemies();
}

// Places only the boss. Minions arrive in encounters as the level is
// walked; see triggerEncounter().
function spawnEnemies() {
  enemies = [];
  potions = [];
  scorePops = [];
  minionsSpawned = 0;
  encountersDone = 0;
  lockUntilX = 0;
  // Roll this run's roster: the target give or take the jitter.
  levelMinionTotal = LEVEL_MINION_TARGET
    + Math.floor(Math.random() * (LEVEL_MINION_JITTER * 2 + 1)) - LEVEL_MINION_JITTER;
  nextEncounterAt = worldWidth * LEVEL_ENCOUNTER_FROM;
  const lane = BOUNDS.bottom - BOUNDS.top;
  enemies.push(new Enemy('boss1', worldWidth * LEVEL_BOSS_AT, BOUNDS.top + lane * 0.5));
  bossSpawned = true;
  // The clock starts with the level, not with the page load, so time spent
  // waiting for the background does not come out of the time bonus.
  runFrames = 0;
}

// World x at which the next encounter fires.
//
// Walked forward one spacing at a time from the previous trigger rather
// than indexed off a fixed count, so the pacing is a constant distance
// between fights however many the roster turns out to hold. Returns
// Infinity once the roster is spent or the run-in to the boss is reached,
// which is what stops encounters firing.
function nextEncounterX() {
  if (minionsSpawned >= levelMinionTotal) return Infinity;
  if (nextEncounterAt > worldWidth * LEVEL_ENCOUNTER_TO) return Infinity;
  return nextEncounterAt;
}

// How far apart packs are placed, in world pixels.
//
// Derived from the roster rather than fixed: the street has to hold roughly
// levelMinionTotal minions in packs of average size, so the gap is the
// walkable span divided by how many packs that works out to. A fixed
// spacing would spend the whole roster in the first third of the level and
// leave the rest empty pavement.
//
// Floored at the old fixed spacing so packs never end up closer together
// than the pacing that was tuned by hand.
function encounterSpacing() {
  const avgPack = (LEVEL_ENCOUNTER_SIZE_MIN + LEVEL_ENCOUNTER_SIZE_MAX) / 2;
  const packs = Math.max(1, Math.round(levelMinionTotal / avgPack));
  const span = worldWidth * (LEVEL_ENCOUNTER_TO - LEVEL_ENCOUNTER_FROM);
  return Math.max(W * LEVEL_ENCOUNTER_SPACING_SCREENS, span / packs);
}

// Advances the trigger point by one spacing, jittered, so packs do not
// arrive on a perfectly regular beat.
function advanceEncounterMark() {
  const spacing = encounterSpacing();
  const jitter = spacing * LEVEL_ENCOUNTER_JITTER * (Math.random() * 2 - 1);
  nextEncounterAt += spacing + jitter;
}

// Screen-space x positions for one pack, spread rather than rolled
// independently.
//
// The old code rolled each minion's x uniformly and rejected only those
// landing on the player, which said nothing about where they landed
// relative to EACH OTHER: 92% of six-minion packs had two within 40px, and
// a third had a pair overlapping outright. A pack is meant to be a line
// you fight through, so the screen is divided into as many slots as there
// are minions and each takes one, jittered inside it. That guarantees the
// spacing instead of hoping for it.
//
// `count` positions are returned in world space, split either side of the
// player so the group closes in from both directions.
function spreadSpawnXs(count) {
  const ahead = Math.max(1, Math.round(count * LEVEL_SPAWN_AHEAD_SHARE));
  const behind = count - ahead;
  const facing = player.facing >= 0 ? 1 : -1;
  const xs = [];

  // How much room each side actually has, measured from a clear distance
  // beyond the player out to the edge of the screen.
  const bandFor = (dir) => {
    const edge = dir > 0
      ? cameraX + W * LEVEL_SPAWN_SCREEN_MAX
      : cameraX + W * LEVEL_SPAWN_SCREEN_MIN;
    const near = player.x + dir * LEVEL_SPAWN_CLEAR_OF_PLAYER;
    return { edge, near, span: edge - near };
  };

  // A side can hold only so many at the minimum spacing. When the player is
  // backed against an edge one side is nearly gone, so whatever will not
  // fit there is moved to the other side rather than stacked into the
  // corner -- which is what the old fallback did, putting a whole pack on
  // one spot in 96% of packs at the screen edge.
  const capacity = (dir) => Math.max(
    0, Math.floor(Math.abs(bandFor(dir).span) / LEVEL_SPAWN_MIN_GAP_X),
  );
  let nAhead = Math.min(ahead, capacity(facing));
  let nBehind = Math.min(behind, capacity(-facing));
  let spare = count - nAhead - nBehind;
  // Hand the leftovers to whichever side still has room.
  while (spare > 0) {
    const roomAhead = capacity(facing) - nAhead;
    const roomBehind = capacity(-facing) - nBehind;
    if (roomAhead <= 0 && roomBehind <= 0) break;
    if (roomAhead >= roomBehind) nAhead++; else nBehind++;
    spare--;
  }
  // Both sides full (a very large pack on a narrow screen): the remainder
  // goes to the roomier side and simply packs in tighter there.
  if (spare > 0) {
    if (capacity(facing) >= capacity(-facing)) nAhead += spare;
    else nBehind += spare;
  }

  const sides = [
    { n: nAhead, dir: facing },
    { n: nBehind, dir: -facing },
  ];
  for (const side of sides) {
    if (side.n <= 0) continue;
    const { edge, near, span } = bandFor(side.dir);
    // No usable room at all on this side: put them at the edge, spaced as
    // far as the sliver allows, rather than all on one pixel.
    if (Math.abs(span) < LEVEL_SPAWN_MIN_GAP_X) {
      for (let i = 0; i < side.n; i++) {
        xs.push(edge - side.dir * i * LEVEL_SPAWN_MIN_GAP_X);
      }
      continue;
    }
    // A slot each, with the jitter kept inside the slot so it can never
    // close the gap to a neighbour.
    // Each minion sits in the middle of its own slot. The jitter is capped
    // so it can never carry one far enough to reach a neighbour: at most
    // half the slack the slot has left once the minimum gap is reserved.
    // Pushing positions apart afterwards was tried and is worse -- the
    // corrections compound along the row and shunt the whole pack off the
    // screen edge and through the player.
    const slot = span / side.n;
    const slack = Math.max(0, Math.abs(slot) - LEVEL_SPAWN_MIN_GAP_X);
    for (let i = 0; i < side.n; i++) {
      const jitter = (Math.random() - 0.5) * slack;
      xs.push(near + slot * (i + 0.5) + jitter);
    }
  }
  return xs;
}

// Depth positions for one pack, spread through the lane.
//
// Enemies at the same depth line up flat and hide behind one another, so
// each takes its own band of the walkable strip. The bands are shuffled so
// the pack does not arrive as a neat diagonal.
//
// Depth is what separates two minions whose screen positions are close, so
// the shuffle is constrained: neighbours in the returned order never get
// neighbouring bands. Shuffling freely put two minions in adjacent x slots
// into adjacent depths a third of the time, which is an overlap on screen.
function spreadSpawnDepths(count) {
  const slot = (1 - LEVEL_SPAWN_MIN_GAP_Y) / count;
  const bands = [];
  for (let i = 0; i < count; i++) bands.push(i);
  // Deal alternate ends of the lane in turn: front, back, front, back.
  // Consecutive entries are then always far apart in depth, whatever their
  // screen positions turn out to be.
  const order = [];
  let lo = 0;
  let hi = count - 1;
  while (lo <= hi) {
    order.push(bands[lo++]);
    if (lo <= hi) order.push(bands[hi--]);
  }
  // Start from either end at random, so the pattern is not identical every
  // encounter.
  if (Math.random() < 0.5) order.reverse();
  return order.map((idx) => {
    const jitter = Math.random() * slot * 0.6;
    return clamp(
      LEVEL_SPAWN_MIN_GAP_Y * 0.5 + idx * slot + jitter, 0.06, 0.94,
    );
  });
}

// Teleports a group in around the player, ON SCREEN so the arrival is
// always seen, and locks the street until they are all down.
function triggerEncounter() {
  const lane = BOUNDS.bottom - BOUNDS.top;
  const remaining = levelMinionTotal - minionsSpawned;
  const size = LEVEL_ENCOUNTER_SIZE_MIN + Math.floor(
    Math.random() * (LEVEL_ENCOUNTER_SIZE_MAX - LEVEL_ENCOUNTER_SIZE_MIN + 1),
  );
  const count = Math.min(size, remaining);
  // Positions are worked out for the pack as a whole, so the group is
  // spread across the screen and through the lane instead of each minion
  // being rolled independently and landing wherever it happens to.
  const xs = spreadSpawnXs(count);
  const depths = spreadSpawnDepths(count);
  for (let i = 0; i < count; i++) {
    // Kept on screen: a slot can fall outside it when the player is near
    // an end of the street, and a minion teleporting in off-camera would
    // not be seen arriving.
    const x = clamp(
      xs[i],
      Math.max(40, cameraX + 30),
      Math.min(worldWidth - 40, cameraX + W - 30),
    );
    const y = BOUNDS.top + lane * depths[i];
    // Guarantee at least one of each type in a pack big enough to hold
    // both, so a mixed street is actually seen rather than left to a run of
    // unlucky rolls producing an all-minion level.
    let type;
    if (i === 0) type = LEVEL_MINION_TYPES.standard;
    else if (i === 1 && count >= LEVEL_ENCOUNTER_SIZE_MIN) type = LEVEL_MINION_TYPES.tough;
    else {
      type = Math.random() < LEVEL_BANANANA_SHARE
        ? LEVEL_MINION_TYPES.tough : LEVEL_MINION_TYPES.standard;
    }
    const minion = new Enemy(type, x, y);
    minion.spawnTimer = TELEPORT_FRAMES;
    enemies.push(minion);
    minionsSpawned++;
  }
  encountersDone++;
  // The next mark is not set here: it is set when this fight is won, from
  // wherever the player is standing then (see the unlock in update()).
  // Setting it now would measure from the start of a fight whose length in
  // ground covered is not known yet.
  // Hold the player inside the screen they are fighting on.
  lockUntilX = cameraX + W - LEVEL_LOCK_MARGIN;
}

// True while an encounter is unresolved: every minion currently in the
// world must be down before the street opens again.
function encounterActive() {
  return lockUntilX > 0
    && enemies.some((e) => !e.dead && !e.def.boss);
}

// Camera centres on the player but never scrolls past either end of the
// world, so the player walks toward the screen edges at the extremes rather
// than the backdrop pulling away from them.
function updateCamera() {
  const target = player.x - W / 2;
  let maxX = Math.max(0, worldWidth - W);
  // Freeze the camera on the locked screen, so the arena the fight happens
  // in stays put rather than sliding as the player moves within it.
  if (lockUntilX > 0) maxX = Math.min(maxX, lockUntilX + LEVEL_LOCK_MARGIN - W);
  cameraX = clamp(target, 0, maxX);
}

function update() {
  // Nothing ticks until the art is in: no spawning, no clock, no input.
  if (!assetsReady) {
    clearPressed();
    return;
  }
  // The cutscene holds the world still the same way the loading gate does:
  // no spawning, no clock, no input reaching the player.
  if (intro && !intro.done) {
    intro.update();
    clearPressed();
    return;
  }
  // Once the level is won (or lost) the world stops: the summary is a
  // screen, not something to keep fighting behind.
  if (levelClear || player.gameOver) {
    furyPopup.update();
    clearPressed();
    return;
  }
  runFrames++;
  // The transformation freezes the street exactly as it freezes the arena,
  // so the cut-in reads as a hard stop rather than playing out over a fight.
  furyPopup.follow(player, strings());
  if (furyPopup.freezing) {
    furyPopup.update();
    // The death sequence has to keep running through the freeze: it fires
    // the popups the freeze is displaying, so stalling it would leave the
    // "GERE'S BACK" card hanging with nothing behind it.
    if (player.dead) player.update(Input, BOUNDS);
    clearPressed();
    return;
  }
  // While an encounter is being fought the street is walled off at
  // lockUntilX: the player may move freely inside the zone but cannot walk
  // past it. Passing a tightened BOUNDS is enough -- Player.update already
  // clamps against it -- so nothing in the entity code needs to know.
  const bounds = lockUntilX > 0
    ? { ...BOUNDS, right: Math.min(BOUNDS.right, lockUntilX) }
    : BOUNDS;
  player.update(Input, bounds);
  // Only enemies near the player think or move. Distant ones stay put, so
  // a long street costs nothing and nobody sprints in from off-screen.
  for (const enemy of enemies) {
    // A dead enemy still ticks: its death blast has to play out and set
    // `gone` before it can be dropped. Skipping it froze the burst forever.
    if (!enemy.dead && Math.abs(enemy.x - player.x) > ENEMY_ACTIVATE_RANGE) continue;
    enemy.update(player, bounds);
  }
  // Fire the next encounter once the player reaches it, and lift the lock
  // when the group is cleared.
  if (!encounterActive()) {
    // The moment a fight is won, the next pack is placed one spacing ahead
    // of WHERE THE PLAYER ACTUALLY IS.
    //
    // It used to be measured from where the fight was triggered, but a
    // fight is fought across a whole locked screen and the player can end
    // it anywhere in that screen. That made the real walk anything from
    // ~5s to ~18s depending on where they happened to finish -- the same
    // nominal spacing producing wildly different gaps, and the long end is
    // the twenty-second trudge. Measuring from the player at the moment
    // the street opens makes the gap the one thing it should be: constant.
    if (lockUntilX > 0) {
      lockUntilX = 0;
      nextEncounterAt = player.x;
      advanceEncounterMark();
    }
    if (player.x >= nextEncounterX()) triggerEncounter();
  }
  resolvePlayerAttacks(player, enemies);
  // Drop loot on DEATH rather than when the body is retired.
  //
  // This used to hang off `gone`, which is only ever set by the death
  // blast -- and only the minion blasts. A boss simply collapses and lies
  // there, so its drop was rolled at the moment of death and then silently
  // thrown away: the guaranteed heart-or-boost for beating a boss could
  // never actually be picked up. Keying off `dead` covers both, and
  // dropSpawned latches it so a corpse that lingers only pays out once.
  for (const e of enemies) {
    if (e.dead && e.dropsPotion && !e.dropSpawned) {
      e.dropSpawned = true;
      potions.push(new Potion(e.x, e.y, e.dropsPotion));
    }
    // Points are latched the same way and for the same reason: a body that
    // lingers must pay out exactly once. The sack is skipped -- it is
    // indestructible scenery and never reaches `dead` anyway.
    if (e.dead && !e.scoreCounted) {
      e.scoreCounted = true;
      const points = player.addScore(e.def.scoreValue || 0);
      if (points > 0) {
        scorePops.push(new ScorePop(e.x, e.y - 60, points, player.combo));
      }
    }
  }
  for (const pop of scorePops) pop.update();
  if (scorePops.some((p) => p.done)) scorePops = scorePops.filter((p) => !p.done);
  checkLevelClear();
  if (enemies.some((e) => e.gone)) {
    enemies = enemies.filter((e) => !e.gone);
  }
  for (const potion of potions) potion.update(player);
  if (potions.some((p) => p.taken)) potions = potions.filter((p) => !p.taken);
  updateCamera();
  furyPopup.update();
  clearPressed();
}

// Ends the run once the boss is beaten, and works out the summary.
//
// The boss's death blast can take a moment to play out, so this waits for
// the body to settle rather than cutting to the summary on the frame the
// last hit lands -- the kill should be seen.
const LEVEL_CLEAR_DELAY = 90;

function checkLevelClear() {
  if (levelClear) return;
  // The level is not playable until layoutLevel() has run: the background
  // loads asynchronously and spawnEnemies() places the boss only once it
  // has. Until then `enemies` is legitimately empty, which must NOT read as
  // "the boss is gone, so it was beaten" -- that cleared the level on the
  // first frame, before the run had started.
  if (!bossSpawned) return;
  const boss = enemies.find((e) => e.def.boss);
  // The boss having left the array entirely means its body was retired
  // after death, which still counts as beaten.
  if (boss && !(boss.dead && boss.deathTimer > LEVEL_CLEAR_DELAY)) return;

  const seconds = Math.floor(runFrames / 60);
  // Time bonus tapers to nothing at par; there is no penalty for going over.
  const timeBonus = Math.max(0, SCORE_PAR_SECONDS - seconds) * SCORE_TIME_BONUS_PER_S;
  const livesBonus = player.lives * SCORE_LIFE_BONUS;
  const total = player.score + timeBonus + livesBonus;
  player.score = total;

  const scores = loadHighscores();
  // The table holds HIGHSCORE_MAX rows, so anything beating the last of a
  // full table -- or landing on a table with room left -- gets an entry.
  const isRecord = total > 0
    && (scores.length < HIGHSCORE_MAX || total > scores[scores.length - 1].score);

  levelClear = { seconds, timeBonus, livesBonus, total, isRecord };
  nameEntry = '';
  scoreSaved = false;
  // A run that does not make the table is simply not recorded; there is
  // nothing to type, so the summary goes straight to its continue prompt.
  if (!isRecord) scoreSaved = true;
}

// Commits the typed name to the local table. Latched so holding Enter
// cannot write the same run twice.
function commitScore() {
  if (scoreSaved || !levelClear) return;
  scoreSaved = true;
  saveHighscore(nameEntry || '???', levelClear.total);
}

// Repeats the strip across the visible span. Only the copies overlapping the
// camera are drawn, so a long level costs no more than a short one.
function drawBackground() {
  if (!background) {
    ctx.fillStyle = '#1b1b2b';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const first = Math.floor(cameraX / bgDrawW);
  const last = Math.floor((cameraX + W) / bgDrawW);
  for (let i = first; i <= last; i++) {
    ctx.drawImage(background, i * bgDrawW - cameraX, bgTop, bgDrawW, bgDrawH);
  }
}

// ---- HUD layout ----
// The corner readout was drawn at 10px type in a 120x7 bar, which is close
// to unreadable once the 960px canvas is scaled up to fill a 1100px-wide
// page. Everything here is expressed against HUD_SCALE so the panel can be
// resized as one piece rather than by nudging a dozen literals.
const HUD_SCALE = 1.6;
const HUD_PAD = 10;
const HUD_BAR_W = 120 * HUD_SCALE;
const HUD_BAR_H = 9 * HUD_SCALE;
const HUD_FACE = 46 * HUD_SCALE;
// Gap between the portrait and the stack of bars beside it.
const HUD_GUTTER = 8;

function drawHud() {
  ctx.save();

  // The panel: portrait on the left, then the title, hearts, health, FURY
  // and progress stacked to its right.
  const faceX = HUD_PAD;
  const faceY = HUD_PAD;
  const colX = faceX + HUD_FACE + HUD_GUTTER;

  // A backing plate behind the whole readout, so light patches of street do
  // not swallow it. Its height is derived from the stack it has to cover --
  // title, hearts, health, and (for Gere) the FURY bar plus the caption
  // drawFuryBar writes UNDER the bar -- rather than being the portrait's
  // height, which the taller stack overflowed.
  const titleSize = Math.round(9 * HUD_SCALE);
  const heartSize = 11 * HUD_SCALE;
  const furyCaption = player.canFury()
    ? HUD_BAR_H + 4 + Math.max(7, Math.round(HUD_BAR_H * 0.95)) + 4
    : 0;
  const stackH = titleSize + heartSize * 1.6 + HUD_BAR_H + furyCaption;
  const panelH = Math.max(HUD_FACE, stackH);
  ctx.fillStyle = 'rgba(8,6,14,0.42)';
  rr(ctx, faceX - 4, faceY - 4, HUD_FACE + HUD_GUTTER + HUD_BAR_W + 12, panelH + 8, 6);
  ctx.fill();

  drawFacePortrait(ctx, player, faceX, faceY, HUD_FACE);

  ctx.font = `bold ${titleSize}px monospace`;
  ctx.fillStyle = '#ffd54d';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t('level1Title'), colX, faceY + titleSize);

  // Lives, as hearts. One pip per life the run started with, so the count
  // reads against the chosen difficulty rather than a fixed five.
  const heartGap = heartSize * 1.25;
  const heartY = faceY + titleSize + heartSize * 0.75;
  for (let i = 0; i < player.maxLives; i++) {
    drawHeart(ctx, colX + heartSize / 2 + i * heartGap, heartY, heartSize, i < player.lives);
  }

  // Player health.
  const healthY = heartY + heartSize * 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, colX, healthY, HUD_BAR_W, HUD_BAR_H, 2);
  ctx.fill();
  ctx.fillStyle = player.hp / player.maxHp > 0.3 ? '#5ac85a' : '#e84c4c';
  rr(ctx, colX, healthY, HUD_BAR_W * clamp(player.hp / player.maxHp, 0, 1), HUD_BAR_H, 2);
  ctx.fill();

  // FURY belongs to the character who can transform; see Player.canFury().
  const furyY = healthY + HUD_BAR_H + 4;
  if (player.canFury()) {
    drawFuryBar(ctx, player, colX, furyY, HUD_BAR_W, HUD_BAR_H, strings());
  }

  // Score and combo, to the right of the panel. The score is the number
  // the player is playing for, so it gets the largest type in the HUD.
  const scoreSize = Math.round(13 * HUD_SCALE);
  ctx.textAlign = 'right';
  ctx.font = `bold ${scoreSize}px monospace`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1020';
  const scoreText = String(player.score);
  ctx.strokeText(scoreText, W - HUD_PAD, faceY + scoreSize);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(scoreText, W - HUD_PAD, faceY + scoreSize);
  const labelSize = Math.round(8 * HUD_SCALE);
  ctx.font = `bold ${labelSize}px monospace`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(t('score'), W - HUD_PAD, faceY + scoreSize + labelSize + 2);
  // The live chain, shown only while it is running.
  if (player.combo > 1) {
    ctx.font = `bold ${scoreSize}px Impact, "Arial Black", sans-serif`;
    ctx.fillStyle = '#ffd54d';
    ctx.fillText(
      `${t('combo')} x${player.combo}`,
      W - HUD_PAD, faceY + scoreSize + labelSize * 2 + 8,
    );
  }
  ctx.textAlign = 'left';

  // The boss gets a bar of its own once it is on screen and fighting.
  const boss = enemies.find((e) => e.def.boss && !e.dead);
  if (boss && Math.abs(boss.x - player.x) < ENEMY_ACTIVATE_RANGE) {
    const bw = Math.min(300, W * 0.4);
    const by = HUD_PAD + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect((W - bw) / 2, by, bw, 11);
    // The bar goes cold and the name reads SHIELDED while the boss is in
    // its untouchable window, so the player can see at a glance why their
    // blows are passing through rather than guessing at it.
    const phasing = boss.isPhasing();
    ctx.fillStyle = phasing ? '#7ad7ff' : '#e84c4c';
    ctx.fillRect((W - bw) / 2, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 11);
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = phasing ? '#7ad7ff' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(
      phasing ? t('bossShielded') : (boss.def.name || 'BOSS'), W / 2, by + 24,
    );
    ctx.textAlign = 'left';
  }

  // Progress along the level, under the panel.
  const pct = worldWidth > W ? clamp(player.x / worldWidth, 0, 1) : 0;
  const py = faceY + panelH + 8;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(faceX, py, HUD_FACE + HUD_GUTTER + HUD_BAR_W, 5);
  ctx.fillStyle = '#8a8ad0';
  ctx.fillRect(faceX, py, (HUD_FACE + HUD_GUTTER + HUD_BAR_W) * pct, 5);
  ctx.restore();
}

// Shown until assetsReady. Deliberately plain: it is on screen for well
// under a second on a warm cache, so it needs to be legible rather than
// elaborate, and it must not depend on any art that is itself still loading.
function drawLoading() {
  ctx.save();
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 22px Impact, "Arial Black", sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1a1020';
  ctx.strokeText(t('loading'), W / 2, H / 2 - 14);
  ctx.fillStyle = '#ffd54d';
  ctx.fillText(t('loading'), W / 2, H / 2 - 14);

  // A marquee rather than a percentage: loadAssets() resolves as a whole,
  // so there is no honest per-file progress to report and a fake bar would
  // be worse than none.
  const barW = 200;
  const barH = 6;
  const x = (W - barW) / 2;
  const y = H / 2 + 12;
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  rr(ctx, x, y, barW, barH, 3);
  ctx.fill();
  const sweep = (Date.now() / 6) % (barW + 60) - 60;
  ctx.fillStyle = '#00f5d4';
  rr(ctx, x + Math.max(0, sweep), y,
    Math.min(60, barW - Math.max(0, sweep), sweep + 60), barH, 3);
  ctx.fill();
  ctx.restore();
}

// The end-of-run summary: the score breakdown, and the name field when the
// run earned a place on the table.
function drawLevelClear() {
  const { seconds, timeBonus, livesBonus, total, isRecord } = levelClear;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,14,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';

  ctx.font = 'bold 34px Impact, "Arial Black", sans-serif';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#1a1020';
  ctx.strokeText(t('levelClear'), W / 2, 54);
  ctx.fillStyle = '#ffd54d';
  ctx.fillText(t('levelClear'), W / 2, 54);

  // The breakdown, laid out as label/value columns so the numbers line up.
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  const rows = [
    [t('timeBonus'), `${mins}:${secs}   +${timeBonus}`],
    [`${t('livesBonus')} (${player.lives}\u2665)`, `+${livesBonus}`],
    [`${t('combo')} MAX`, `x${player.bestCombo}`],
  ];
  ctx.font = 'bold 13px monospace';
  rows.forEach(([label, value], i) => {
    const y = 96 + i * 20;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cfc9e0';
    ctx.fillText(label, W / 2 - 12, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(value, W / 2 + 12, y);
  });

  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Impact, "Arial Black", sans-serif';
  ctx.fillStyle = '#00f5d4';
  ctx.fillText(`${t('finalScore')}  ${total}`, W / 2, 180);

  if (isRecord && !scoreSaved) {
    ctx.font = 'bold 14px Impact, "Arial Black", sans-serif';
    ctx.fillStyle = '#ff2a85';
    ctx.fillText(t('newRecord'), W / 2, 218);
    // The field itself: the typed name with a blinking caret after it.
    const caret = Math.floor(Date.now() / 400) % 2 === 0 ? '_' : ' ';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(nameEntry + caret, W / 2, 246);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(t('enterName'), W / 2, 268);
  } else {
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText(t('continueHint'), W / 2, 232);
  }
  ctx.restore();
}

// Drawn over everything once the last life is spent.
function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,14,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px Impact, "Arial Black", sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a1020';
  ctx.strokeText(t('gameOver'), W / 2, H / 2);
  ctx.fillStyle = '#e84c4c';
  ctx.fillText(t('gameOver'), W / 2, H / 2);
  // A lost run still scored: show the total so the attempt is not a blank.
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#ffd54d';
  ctx.fillText(`${t('score')}  ${player.score}`, W / 2, H / 2 + 30);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(t('gameOverHint'), W / 2, H / 2 + 54);
  ctx.restore();
}

function draw() {
  if (!assetsReady) {
    drawLoading();
    return;
  }
  if (intro && !intro.done) {
    intro.draw(ctx);
    return;
  }
  ctx.clearRect(0, 0, W, H);
  const quake = furyPopup.shake();
  ctx.save();
  ctx.translate(quake.x, quake.y);
  drawBackground();
  // Depth sort so whoever stands further down the lane draws in front.
  // Only what is on screen (plus a margin for part-visible sprites) draws.
  const visible = enemies.filter((e) => {
    const sx = e.x - cameraX;
    return sx > -200 && sx < W + 200 && (!e.dead || e.deathTimer < 90);
  });
  // The lock's barrier, so the wall reads as deliberate rather than the
  // player simply sticking at an invisible edge.
  if (lockUntilX > 0) {
    const bx = lockUntilX - cameraX;
    const grad = ctx.createLinearGradient(bx, 0, bx + 40, 0);
    grad.addColorStop(0, 'rgba(122,215,255,0.30)');
    grad.addColorStop(1, 'rgba(122,215,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(bx, BOUNDS.top - 90, 40, (BOUNDS.bottom - BOUNDS.top) + 120);
    ctx.strokeStyle = 'rgba(122,215,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, BOUNDS.top - 90);
    ctx.lineTo(bx, BOUNDS.bottom + 30);
    ctx.stroke();
  }

  // Pickups draw under the cast so a character standing on one still reads.
  for (const potion of potions) potion.draw(ctx, cameraX);
  const actors = [player, ...visible].sort((a, b) => a.y - b.y);
  for (const actor of actors) actor.draw(ctx, cameraX);
  // Score numbers sit above the cast: they must stay readable over the
  // body they were scored on.
  for (const pop of scorePops) pop.draw(ctx, cameraX);
  ctx.restore();
  drawHud();
  furyPopup.draw(ctx, W, H);
  if (levelClear) drawLevelClear();
  else if (player.gameOver) drawGameOver();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function levelSetUp() {
  // The loop starts immediately so the loading screen animates, but
  // update()/draw() stay gated on assetsReady until everything is in.
  loop();
  Promise.all([
    loadAssets(),
    loadFaces(),
    // The cutscene's still backdrop. Gated like everything else so the
    // intro never draws a frame with its background missing.
    loadIntroBackgrounds(),
    loadImage(LEVEL_BACKGROUND).then((img) => {
      if (!img) return;
      background = img;
      layoutLevel(img);
    }),
  ]).then(() => {
    // layoutLevel() has run by now, so the world is laid out and the boss
    // placed; runFrames was reset there, so the clock starts here.
    assetsReady = true;
    // The cutscene plays once per session. Retrying after a game over
    // reloads the page, so this is remembered outside it.
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch (e) { /* storage blocked */ }
    if (!seen) {
      intro = new IntroScene(W, H);
      try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch (e) { /* session-only */ }
    }
  });
}

levelSetUp();
