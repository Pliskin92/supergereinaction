// The story between the levels.
//
// The opening cutscene (js/intro.js) establishes the premise: Meeottee beats
// Roger in his office, calls Gere out by name, and Gere transforms and runs.
// That is one long, fully-staged scene, and it plays once.
//
// What the campaign needed after it was something lighter that plays SIX
// times: the rescue at the end of each street, and the hand-off to the next.
// A full IntroScene per level would be six times the staging code for beats
// that are mostly two people talking, so this is the smaller form -- a
// sequence of dialogue lines over a held shot, with the rescued family
// member present.
//
// It reuses intro.js's drawSpeechBubble and drawIntroCharacter rather than
// re-implementing either, so the two kinds of scene look like the same
// comic. That is also why this file loads after intro.js.
//
// ART: every character here falls back to the vector figure when its sprite
// pack is missing (drawIntroCharacter does that for free), so all six
// interludes play NOW with placeholder-looking family members and improve
// the moment real packs land. See ART-TODO.md.

// Who each level's rescue shows, and what the pack is called on disk. The
// key matches the campaign row's `rescue` field, so a level's story and its
// summary screen name the same person without a second table.
//
// A character with no pack yet simply has no entry, and its scene draws the
// vector fallback. `carla` is the only one with art today.
const INTERLUDE_CHARACTERS = {
  carla: 'carla',
  // The last scene is Roger back on his feet, and he already has a full
  // pack from the opening cutscene -- the same art that was beaten to the
  // floor in it. Using it here is what closes the loop visually, not just
  // in the dialogue.
  family: 'roger',
  // gastone, mattia, michele: packs not made yet. Adding one is a line
  // here plus the sprite folder; nothing else changes.
};

// The colours the vector fallback uses for each family member, so that even
// without sprite art the six scenes are not six identical grey figures.
const INTERLUDE_COLORS = {
  carla: { suit: '#7b4a86', accent: '#e8d5ee', skin: '#f0c9a8', hair: '#d8d8dc' },
  gastone: { suit: '#3c5a7a', accent: '#c8d8e8', skin: '#e8bd96', hair: '#c8c8cc' },
  mattia: { suit: '#6a5a3a', accent: '#d8c8a0', skin: '#e8bd96', hair: '#5a4630' },
  michele: { suit: '#3a6a4a', accent: '#c0dcc8', skin: '#e8bd96', hair: '#4a3a28' },
  family: { suit: '#8a4a4a', accent: '#f0d0d0', skin: '#f0c9a8', hair: '#5a4630' },
  hero: { suit: '#1a1a24', accent: '#ffd54d', skin: '#f0c9a8', hair: '#c8a05a' },
};

// One beat is one line of dialogue, held long enough to read.
//
// `who` is 'hero' or the rescued character's key; it decides which side of
// the shot the bubble points at. `key` is the i18n string.
const INTERLUDE_BEAT_FRAMES = 150;
// The scene fades up and away rather than cutting, matching the level card.
const INTERLUDE_FADE_FRAMES = 40;

// The script, keyed by the level's `rescue` value.
//
// Each is three lines: the rescued one speaks, Gere answers, and the last
// line points at where he goes next. That shape is deliberate -- it is the
// smallest thing that both closes a level and opens the following one, so
// the campaign reads as one journey rather than six errands.
const INTERLUDE_SCRIPTS = {
  carla: [
    { who: 'carla', key: 'ilCarla1' },
    { who: 'hero', key: 'ilCarla2' },
    { who: 'carla', key: 'ilCarla3' },
  ],
  gastone: [
    { who: 'gastone', key: 'ilGastone1' },
    { who: 'hero', key: 'ilGastone2' },
    { who: 'gastone', key: 'ilGastone3' },
  ],
  mattia: [
    { who: 'mattia', key: 'ilMattia1' },
    { who: 'hero', key: 'ilMattia2' },
    { who: 'mattia', key: 'ilMattia3' },
  ],
  michele: [
    { who: 'michele', key: 'ilMichele1' },
    { who: 'hero', key: 'ilMichele2' },
    { who: 'michele', key: 'ilMichele3' },
  ],
  // Level 5 rescues nobody -- it is the Boss Luigi fight, and what it ends
  // with is the road to Meeottee rather than a family member. Keyed on the
  // level id instead (see interludeFor).
  lv5: [
    { who: 'hero', key: 'ilLuigi1' },
    { who: 'hero', key: 'ilLuigi2' },
  ],
  // The end of the run: Roger, back on his feet, and the line that closes
  // the story the opening cutscene started.
  family: [
    { who: 'family', key: 'ilFinal1' },
    { who: 'hero', key: 'ilFinal2' },
    { who: 'family', key: 'ilFinal3' },
  ],
};

// The script for a level, or null when it has none. Keyed by `rescue` where
// there is one and by level id otherwise, so a level without a rescue can
// still have a scene.
function interludeFor(levelDef) {
  if (!levelDef) return null;
  const script = INTERLUDE_SCRIPTS[levelDef.rescue] || INTERLUDE_SCRIPTS[levelDef.id];
  return script || null;
}

class Interlude {
  constructor(W, H, levelDef) {
    this.W = W;
    this.H = H;
    this.level = levelDef;
    this.script = interludeFor(levelDef) || [];
    this.timer = 0;
    this.done = this.script.length === 0;
    this.total = this.script.length * INTERLUDE_BEAT_FRAMES;
  }

  skip() {
    this.done = true;
  }

  update() {
    if (this.done) return;
    this.timer++;
    if (this.timer >= this.total) this.done = true;
  }

  // Which line is on screen, and how far through it we are.
  currentBeat() {
    const i = Math.min(this.script.length - 1, Math.floor(this.timer / INTERLUDE_BEAT_FRAMES));
    const t = (this.timer - i * INTERLUDE_BEAT_FRAMES) / INTERLUDE_BEAT_FRAMES;
    return { beat: this.script[i], index: i, t };
  }

  // Fades up at the start and away at the end so the scene does not cut in
  // on top of the level's last frame.
  alpha() {
    if (this.timer < INTERLUDE_FADE_FRAMES) return this.timer / INTERLUDE_FADE_FRAMES;
    const left = this.total - this.timer;
    if (left < INTERLUDE_FADE_FRAMES) return Math.max(0, left / INTERLUDE_FADE_FRAMES);
    return 1;
  }

  draw(ctx) {
    if (this.done || this.script.length === 0) return;
    const { W, H } = this;
    // `progress`, not `t`: t() is the i18n lookup used for the line below,
    // and shadowing it here would break it.
    const { beat, t: progress } = this.currentBeat();

    ctx.save();
    ctx.globalAlpha = this.alpha();

    // A dark stage rather than a location: the interlude is a beat between
    // streets, and giving it a specific room would need art per level that
    // does not exist. The two figures and the dialogue carry it.
    ctx.fillStyle = '#0c0a16';
    ctx.fillRect(0, 0, W, H);
    // A pool of light they stand in, so the shot is composed rather than two
    // figures floating in black.
    const glow = ctx.createRadialGradient(W / 2, H * 0.72, 10, W / 2, H * 0.72, W * 0.55);
    glow.addColorStop(0, 'rgba(255, 213, 77, 0.16)');
    glow.addColorStop(1, 'rgba(255, 213, 77, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    const footY = H * 0.88;
    // Gere on the left, whoever he has just saved on the right, facing
    // each other.
    const heroX = W * 0.34;
    const otherX = W * 0.66;
    const other = beat.who === 'hero' ? null : beat.who;
    const otherKey = other || this.level.rescue || 'family';

    // Gere is drawn from his own gameplay pack, so he looks like himself.
    drawInterludeFigure(ctx, 'gere', heroX, footY, {
      action: 'idle', facing: 1, phase: (this.timer % 150) / 150,
    }, INTERLUDE_COLORS.hero);

    // A fixed frame, not a cycle: the clip standing in for an idle is a
    // walk, and animating it would have them striding on the spot.
    drawInterludeFigure(
      ctx, INTERLUDE_CHARACTERS[otherKey], otherX, footY,
      { action: 'idle', facing: -1, phase: 0.0 },
      INTERLUDE_COLORS[otherKey] || INTERLUDE_COLORS.family,
    );

    // The bubble sits above whoever is talking, with its tail pointing down
    // at them.
    // Centred, with only the TAIL moving to whoever is speaking. A bubble
    // this wide pinned over a figure would hang off the canvas edge.
    const speakingLeft = beat.who === 'hero';
    const bubbleX = W / 2;
    const tailX = (speakingLeft ? heroX : otherX) - bubbleX;
    // Wide enough for a full line: these are sentences, not the cutscene's
    // short shouts, and at 0.44 of the canvas the longest of them wrapped
    // past the bubble's edge and lost its last word.
    const bubbleW = Math.min(560, W * 0.72);
    drawSpeechBubble(
      ctx, bubbleX, H * 0.24, bubbleW, t(beat.key), progress,
      { fontSize: 14, tailDown: true, tailX },
    );

    ctx.restore();

    // The skip prompt, outside the fade so it stays readable throughout.
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t('introSkip'), W - 10, H - 8);
    ctx.restore();
  }
}

// Draws one interlude figure, preferring a sprite pack and falling back to
// the vector humanoid.
//
// This is deliberately not drawIntroCharacter: that one resolves its
// character through INTRO_SPRITE_CHARACTERS, which is the cutscene's own
// cast list and does not contain the family. It takes a character name
// directly instead, and a null name (a family member with no pack yet)
// goes straight to the fallback.
// Clips to try, in order, for a standing character.
//
// Not every pack has an idle: carla's has walk/victory/wave and no
// idle_right at all, so asking only for the canonical idle threw her to the
// vector fallback even though her art was sitting right there. A partial
// pack is the normal case while art is still being made, so this takes the
// best standing pose the character actually has.
// walk_right is preferred over victory for a standing pose: victory is an
// arms-up celebration, which reads oddly under a quiet line of dialogue,
// whereas a walk frame held still passes for standing.
const INTERLUDE_STANDING_CLIPS = ['idle_right', 'walk_right', 'wave', 'victory'];

// The height a figure should draw at, so everyone in the shot is the same
// size regardless of which path drew them. Measured off gere's idle, which
// is the one character guaranteed to be present.
const INTERLUDE_FIGURE_HEIGHT = 150;
// drawHumanoid is authored about this tall at scale 1.
const INTERLUDE_VECTOR_HEIGHT = 62;

function drawInterludeFigure(ctx, character, x, footY, pose, colors) {
  let frame = null;
  if (character) {
    for (const clip of INTERLUDE_STANDING_CLIPS) {
      frame = getSpriteFrame(character, clip, pose.phase || 0.5);
      if (frame) break;
    }
  }
  if (!frame) {
    // Scaled to the same height the sprites draw at, rather than to the
    // intro's constant: this canvas is shorter than the cutscene's, and a
    // fallback figure half the height of the one beside it reads as a
    // child rather than as missing art.
    drawIntroFigure(
      ctx, x, footY, pose, colors,
      INTERLUDE_FIGURE_HEIGHT / INTERLUDE_VECTOR_HEIGHT,
    );
    return;
  }
  // Normalise every pack to one height. Packs are authored at different
  // sizes, so drawing them all at INTRO_SPRITE_SCALE makes whoever was
  // drawn largest tower over the rest.
  const k = INTERLUDE_FIGURE_HEIGHT / frame.sh;
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(k, k);
  ctx.scale(pose.facing || 1, 1);
  drawSpriteFrame(ctx, frame, 1);
  ctx.restore();
}
