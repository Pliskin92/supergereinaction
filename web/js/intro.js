// Opening cutscene: Meeottee beats Roger, gloats over him, and Gere hears
// it from across town.
//
// Drawn on the same canvas the level uses, with the game's own
// drawHumanoid() for the figures, so the intro matches the art style rather
// than needing a separate set of shipped stills. That also means it is
// covered by the level's loading gate for free: it draws no image the gate
// does not already wait on.
//
// The scene is one linear timeline of beats. Each beat declares how long it
// runs; `currentBeat()` turns the frame counter into a name plus a 0..1
// progress, and everything staged reads off that. Beats are grouped into
// two SHOTS -- the fight, then the cut to Gere -- because the camera changes
// location, which a single staging could not express.

// The characters are deliberately archetypes rather than portraits: a
// dark-haired man in a suit, and a red-haired bearded man in a blue jacket.
const INTRO_ROGER_COLORS = {
  suit: '#2a2f3a',
  accent: '#e8e8ee',
  skin: '#f2c49b',
  hair: '#241c18',
};
const INTRO_VILLAIN_COLORS = {
  suit: '#1e3566',
  accent: '#2c4a86',
  skin: '#f0c9a4',
  hair: '#b5541f',
};

// drawHumanoid() is authored for ~60px characters (it is the fallback for
// the ~180px sprite sheets), so the cutscene scales it up to fill the
// staging rather than leaving the figures as dolls.
const INTRO_FIGURE_SCALE = 2.3;

// Draws a humanoid at cutscene scale, anchored at its feet.
function drawIntroFigure(ctx, x, footY, pose, colors, scale) {
  ctx.save();
  ctx.translate(x, footY);
  const k = scale || INTRO_FIGURE_SCALE;
  ctx.scale(k, k);
  drawHumanoid(ctx, 0, 0, pose, colors);
  ctx.restore();
}

// Which sprite clip stands in for each cutscene pose, per character. A
// character with a sprite pack uses it; anything absent falls through to
// the drawn figure above, so a half-finished pack still stages correctly.
const INTRO_SPRITE_CLIPS = {
  idle: 'idle_right',
  walk: 'walk_right',
  punch1: 'punch',
  hurt: 'hurt',
  ko: 'fall',
  // Standing over a beaten opponent. Falls back to idle for a pack without
  // a victory clip, via the same missing-clip path as everything else.
  gloat: 'victory',
  // The transformation pose: arms out, mid-shout. 'heavy' is the biggest
  // committed stance in every pack, which is what the moment needs.
  power: 'heavy',
  // Lounging, oblivious, before the call reaches him.
  relaxed: 'relaxed',
  // Sprinting off to help his father.
  run: 'run_right',
};

// Cutscene characters backed by a real sprite pack. Keyed by the role the
// scene uses, so swapping art in is a one-line change here rather than a
// hunt through the staging code.
const INTRO_SPRITE_CHARACTERS = {
  roger: 'roger',
  villain: 'meeottee',
  // Gere hears his father and transforms, so the shot uses BOTH of his
  // packs: the ordinary one before the change, the FURY skin after. They
  // are the same packs gameplay uses (see PLAYER_FURY_CHARACTER), not
  // cutscene-only art.
  gere: 'gere',
  supergere: 'supergere',
};

// Sprite packs are authored ~180-230px tall, against drawHumanoid's ~60px,
// so a sprite figure is drawn near 1:1 rather than at INTRO_FIGURE_SCALE.
const INTRO_SPRITE_SCALE = 0.92;

// Both packs are authored facing RIGHT, which is the same convention the
// staging's `facing: 1` means, so neither needs a correction. Kept as a
// table rather than dropped entirely because a future pack authored the
// other way round only needs an entry here, not a change to the staging.
const INTRO_SPRITE_FLIP = {};

// Poses whose art is already lying on the ground. drawSpriteFrame's `lift`
// would raise these off the floor, so it is zeroed for them.
const INTRO_GROUNDED_POSES = new Set(['relaxed', 'ko']);

// Draws a cutscene character, preferring its sprite pack and falling back
// to the vector figure. `phase` 0..1 picks the frame within the clip.
//
// Returns nothing. The fallback matters: the intro must stage correctly
// whether or not a given character's art has been dropped in yet.
// `scale` sizes the VECTOR fallback (which is authored tiny); `pose.grow`
// scales a sprite figure relative to INTRO_SPRITE_SCALE. They are separate
// because the two paths start from completely different authored sizes, so
// one number could not serve both.
function drawIntroCharacter(ctx, role, x, footY, pose, colors, scale) {
  const character = INTRO_SPRITE_CHARACTERS[role];
  const clip = INTRO_SPRITE_CLIPS[pose.action];
  const frame = character && clip
    ? getSpriteFrame(character, clip, pose.phase === undefined ? 0.5 : pose.phase)
    : null;
  if (!frame) {
    drawIntroFigure(ctx, x, footY, pose, colors, scale);
    return;
  }
  const k = INTRO_SPRITE_SCALE * (pose.grow || 1);
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(k, k);
  ctx.scale((pose.facing || 1) * (INTRO_SPRITE_FLIP[character] || 1), 1);
  // `lift` encodes real vertical motion for airborne frames, which is right
  // for a jump but wrong for a lying-down clip: on 'relaxed' it just floats
  // him above the ground. Poses that are already ON the floor suppress it.
  drawSpriteFrame(ctx, frame, INTRO_GROUNDED_POSES.has(pose.action) ? 0 : 1);
  ctx.restore();
}

// Beat lengths in frames at 60fps. Roughly 21 seconds end to end; Enter
// skips, and the scene only plays once per session.
//
// The order is the story: they trade blows, Roger goes down, Meeottee
// gloats and calls Gere out, Roger manages one last plea, we cut to Gere
// hearing it and getting angry, then the level card.
// The dialogue is interleaved with the fight rather than stacked after it:
// they talk, then fight, then talk. Standing still through four speeches
// and then fighting is what made the first pass read as a slideshow.
const INTRO_BEATS = [
  { name: 'fadeIn', frames: 50, shot: 'fight' },
  // Meeottee taunts; Roger answers him. They are still squared up here.
  { name: 'taunt', frames: 150, shot: 'fight' },
  { name: 'defy', frames: 140, shot: 'fight' },
  // Which sets him off -- he mocks the answer and goes in swinging.
  { name: 'mock', frames: 130, shot: 'fight' },
  { name: 'exchange', frames: 160, shot: 'fight' },
  { name: 'finalBlow', frames: 55, shot: 'fight' },
  { name: 'rogerFalls', frames: 75, shot: 'fight' },
  { name: 'villainGloat', frames: 150, shot: 'fight' },
  { name: 'villainCall', frames: 165, shot: 'fight' },
  { name: 'rogerPlea', frames: 155, shot: 'fight' },
  // Gere's half: lounging, hears his father, transforms straight out of
  // lying down, swears at a villain who cannot hear him, and runs.
  { name: 'cutToGere', frames: 60, shot: 'gere' },
  { name: 'gereHears', frames: 105, shot: 'gere' },
  // He answers FIRST, as ordinary Gere -- the line is what triggers the
  // change, so it has to land before the flash, not after it.
  { name: 'gereVow', frames: 175, shot: 'gere' },
  { name: 'gereTransform', frames: 95, shot: 'gere' },
  { name: 'gereAngry', frames: 120, shot: 'gere' },
  { name: 'gereRuns', frames: 150, shot: 'gere' },
  { name: 'levelCard', frames: 120, shot: 'card' },
];
const INTRO_TOTAL_FRAMES = INTRO_BEATS.reduce((a, b) => a + b.frames, 0);
const INTRO_BEAT_ORDER = INTRO_BEATS.map((b) => b.name);

// Meeottee's gang, lined up behind him: seven minions and two bananana.
// They stand and watch -- the point is that Roger is outnumbered and alone,
// so they never join in. Positions are fixed (not random) so the tableau is
// composed rather than different every run.
//
// x is a fraction of the canvas width, depth scales them so the back row
// reads as further away.
// Two rows so nine bodies at full size fit without overlapping into mush:
// a front rank at the same scale as the principals, and a back rank set
// slightly smaller and higher up the floor to read as further away.
const INTRO_GANG = [
  // Front rank.
  { char: 'minion', x: 0.640, depth: 1.00 },
  { char: 'bananana', x: 0.740, depth: 1.00 },
  { char: 'minion', x: 0.840, depth: 1.00 },
  { char: 'bananana', x: 0.940, depth: 1.00 },
  { char: 'minion', x: 1.030, depth: 1.00 },
  // Back rank, further up the floor.
  { char: 'minion', x: 0.690, depth: 0.88 },
  { char: 'minion', x: 0.790, depth: 0.88 },
  { char: 'minion', x: 0.890, depth: 0.88 },
  { char: 'minion', x: 0.985, depth: 0.88 },
];

// Clip pacing, in ticks for one full 25-frame clip. These mirror the
// game's own constants (GERE_WALK_CYCLE_FRAMES 140, ENEMY_WALK_CYCLE_FRAMES
// 110) rather than being picked by eye: the cutscene was cycling idles in
// 30-40 ticks, which is 3-4x too fast and read as a twitchy shuffle.
const INTRO_IDLE_CYCLE = 150;
const INTRO_GANG_IDLE_CYCLE = 130;
// The run clip cycles faster than a walk, and SuperGere's legs move faster
// still because he is covering twice the distance.
const INTRO_RUN_CYCLE = 45;
// The lounging clip is 64 frames rather than 25 and is meant to be barely
// moving, so it gets a much longer cycle again.
const INTRO_RELAXED_CYCLE = 300;

// How many blows are traded during the exchange, and the fraction of the
// beat each one occupies.
const INTRO_EXCHANGE_BLOWS = 4;

// Draws one comic speech bubble with a tail, its text typed in over time.
// `progress` 0..1 drives both the pop and the typing.
function drawSpeechBubble(ctx, x, y, w, text, progress, opts = {}) {
  const pop = Math.min(1, progress * 6);
  if (pop <= 0) return;
  const tailDown = opts.tailDown !== false;
  const size = opts.fontSize || 15;
  const shout = !!opts.shout;

  ctx.save();
  ctx.translate(x, y);
  // Overshoot slightly then settle, so the bubble pops rather than fades.
  const scale = pop < 1 ? 0.7 + pop * 0.35 : 1;
  ctx.scale(scale, scale);

  ctx.font = `bold ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Wrap to the bubble's width so a long line stacks instead of spilling.
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > w - 28 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const lineH = size * 1.15;
  const h = lines.length * lineH + 20;

  // A shout gets a spiky burst outline; ordinary speech gets a round one.
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12101a';
  ctx.lineWidth = 3;
  ctx.fillStyle = opts.fill || '#fdfaf2';
  if (shout) {
    const points = 18;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const spike = i % 2 === 0 ? 1 : 0.84;
      const px = Math.cos(a) * (w / 2) * spike;
      const py = Math.sin(a) * (h / 2) * spike;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.beginPath();
    rr(ctx, -w / 2, -h / 2, w, h, 12);
  }
  ctx.fill();
  ctx.stroke();

  // The tail, pointing at whoever is speaking.
  const tailX = opts.tailX || 0;
  const ty = tailDown ? h / 2 - 2 : -h / 2 + 2;
  const dir = tailDown ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(tailX - 10, ty);
  ctx.lineTo(tailX + 10, ty);
  ctx.lineTo(tailX + (dir > 0 ? 2 : -2), ty + dir * 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Typed-on text: how many characters are visible so far.
  const full = lines.join('');
  const shown = Math.floor(progress * full.length * 1.8);
  let used = 0;
  ctx.fillStyle = opts.textFill || '#15121c';
  const startY = -((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    const remaining = Math.max(0, shown - used);
    const visible = lines[i].slice(0, remaining);
    used += lines[i].length;
    if (visible) ctx.fillText(visible, 0, startY + i * lineH);
  }
  ctx.restore();
}

// A comic-book action word (POW!) that punches in and fades.
function drawActionWord(ctx, x, y, text, t) {
  if (t <= 0 || t >= 1) return;
  const pop = t < 0.25 ? t / 0.25 : 1;
  const fade = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.scale(0.6 + pop * 0.5, 0.6 + pop * 0.5);
  ctx.globalAlpha = fade;
  ctx.font = 'bold 40px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#1a1020';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#ffd54d';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Gere's backdrop, a still rather than a sprite pack. Loaded here and
// awaited by levelSetUp() alongside everything else, so the loading gate
// covers it and the shot never draws a half-loaded frame.
const INTRO_PARK_SRC = 'assets/release/backgrounds/park.jpg';
const INTRO_OFFICE_SRC = 'assets/release/backgrounds/office.jpeg';
let introPark = null;
let introOffice = null;

function loadIntroBackgrounds() {
  return Promise.all([
    // A backdrop that fails to load just leaves a painted fill behind it.
    loadImage(INTRO_PARK_SRC).then((img) => { if (img) introPark = img; }),
    loadImage(INTRO_OFFICE_SRC).then((img) => { if (img) introOffice = img; }),
  ]);
}

// Cover-fit a backdrop: fills the canvas, cropping the overflow. Right for
// a photo whose edges carry nothing (the park), wrong for one that is a
// composed room -- see drawContainImage.
function drawCoverImage(ctx, img, W, H) {
  const scale = Math.max(W / img.width, H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Contain-fit: shows the WHOLE image, letterboxed if its aspect does not
// match the canvas. Used where the art is a composed scene and cropping it
// would throw away the ceiling and floor that make it read as a room.
//
// Returns the drawn rect so callers can place characters against the
// image's own geometry rather than against the raw canvas.
function drawContainImage(ctx, img, W, H) {
  const scale = Math.min(W / img.width, H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;

  // Fill the letterbox by bleeding the image's own edge columns outward,
  // so the gap reads as more room rather than as black bars. A 1px slice
  // stretched across the margin is enough at this dimness.
  if (dx > 0.5) {
    ctx.drawImage(img, 0, 0, 1, img.height, 0, dy, dx + 1, dh);
    ctx.drawImage(
      img, img.width - 1, 0, 1, img.height, dx + dw - 1, dy, dx + 1, dh,
    );
  }
  if (dy > 0.5) {
    ctx.drawImage(img, 0, 0, img.width, 1, dx, 0, dw, dy + 1);
    ctx.drawImage(
      img, 0, img.height - 1, img.width, 1, dx, dy + dh - 1, dw, dy + 1,
    );
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  return { x: dx, y: dy, w: dw, h: dh };
}

// The cast stands on the bottom edge of the canvas, not on a floor line
// measured inside the backdrop. Keeping them right at the bottom means
// they are unambiguously ON the ground whatever the backdrop's own
// proportions are, rather than hovering at some fraction of it.
const INTRO_FLOOR_INSET = 6;

class IntroScene {
  constructor(W, H) {
    this.W = W;
    this.H = H;
    this.frame = 0;
    this.done = false;
  }

  // Ends the scene immediately. Used by the skip key and once the timeline
  // runs out, so both paths land in the same place.
  skip() {
    this.done = true;
  }

  update() {
    if (this.done) return;
    this.frame++;
    if (this.frame >= INTRO_TOTAL_FRAMES) this.done = true;
  }

  // Which beat is playing, how far through it (0..1), and which shot it
  // belongs to.
  currentBeat() {
    let acc = 0;
    for (const beat of INTRO_BEATS) {
      if (this.frame < acc + beat.frames) {
        return {
          name: beat.name,
          shot: beat.shot,
          t: (this.frame - acc) / beat.frames,
        };
      }
      acc += beat.frames;
    }
    const last = INTRO_BEATS[INTRO_BEATS.length - 1];
    return { name: last.name, shot: last.shot, t: 1 };
  }

  // True once a beat has been reached, so staging set up by an earlier beat
  // persists through the ones that follow.
  reached(name) {
    return INTRO_BEAT_ORDER.indexOf(this.currentBeat().name)
      >= INTRO_BEAT_ORDER.indexOf(name);
  }

  // Screen shake, used on the knockdown so the fall has weight.
  shake(beat) {
    if (beat.name !== 'finalBlow' || beat.t > 0.5) return { x: 0, y: 0 };
    const decay = 1 - beat.t / 0.5;
    const amp = 9 * decay;
    return {
      x: Math.sin(this.frame * 1.9) * amp,
      y: Math.cos(this.frame * 2.4) * amp * 0.5,
    };
  }

  // ---- Shot 1: the cellar where the fight happens ----
  drawFightShot(ctx, beat) {
    const { W, H } = this;

    // Meeottee's office: this is his turf, which is why Roger is the one
    // outnumbered in it.
    //
    // Shown WHOLE rather than cover-cropped. The canvas is far wider than
    // the art (2.48 vs 1.78), so filling it cropped 28% off the top and
    // bottom -- the ceiling and the floor, which is most of what makes the
    // image read as a room. The letterbox is filled with the image's own
    // dark tone so the bars are not obvious.
    const floorY = H - INTRO_FLOOR_INSET;
    if (introOffice) {
      ctx.fillStyle = '#0b0a09';
      ctx.fillRect(0, 0, W, H);
      drawContainImage(ctx, introOffice, W, H);
      ctx.fillStyle = 'rgba(6,4,12,0.28)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#12100f';
      ctx.fillRect(0, 0, W, H);
    }

    // --- The gang, behind Meeottee ---
    // Drawn before the principals so they sit behind them, and darkened so
    // they read as a threatening backdrop rather than competing for
    // attention with the fight.
    ctx.save();
    for (let i = 0; i < INTRO_GANG.length; i++) {
      const member = INTRO_GANG[i];
      const gx = W * member.x;
      // The back rank stands a little further up, which sells the depth
      // alongside the smaller scale. Kept small now that the floor is the
      // canvas bottom -- a big offset would lift them off it.
      const gy = floorY - (1 - member.depth) * 110;
      // Each member is offset in the cycle so the rank does not move as
      // one block, which reads as a chorus line rather than a crowd.
      const offset = i * 23;
      const frame = getSpriteFrame(
        member.char, 'idle_right',
        ((this.frame + offset) % INTRO_GANG_IDLE_CYCLE) / INTRO_GANG_IDLE_CYCLE,
      );
      if (!frame) continue;
      ctx.save();
      ctx.translate(gx, gy);
      // Full sprite scale: the gang are the same enemies the player fights,
      // so they read at the same size they do in the level.
      const k = INTRO_SPRITE_SCALE * member.depth;
      ctx.scale(k, k);
      ctx.scale(-1, 1); // face left, toward Roger
      drawSpriteFrame(ctx, frame);
      ctx.restore();
    }
    ctx.restore();

    // --- Figure positions ---
    // Everyone is already in place: no walking in, and no idle drift. They
    // hold their ground and talk, then fight.
    //
    // The gap is set from the ART, not by eye: a punch clip is ~192px wide,
    // so at INTRO_SPRITE_SCALE the fist reaches ~88px from centre. Standing
    // 230px apart (the old 0.16/0.40) left the blow 50px short of landing.
    // They talk at conversational distance and close to striking range for
    // the fight itself.
    let rogerX = W * 0.20;
    let villainX = W * 0.375;
    let rogerAction = 'idle';
    let villainAction = 'idle';
    let rogerFlat = false;

    if (beat.name === 'exchange') {
      // Trade blows: each takes turns swinging while the other reels. They
      // stand closer here than while talking -- this is striking range.
      rogerX = W * 0.225;
      villainX = W * 0.345;
      const blow = Math.floor(beat.t * INTRO_EXCHANGE_BLOWS);
      const rogerSwings = blow % 2 === 0;
      rogerAction = rogerSwings ? 'punch1' : 'hurt';
      villainAction = rogerSwings ? 'hurt' : 'punch1';
      // The swinger leans in, the one taking it rocks back.
      const lunge = Math.sin(beat.t * INTRO_EXCHANGE_BLOWS * Math.PI) * 12;
      rogerX += rogerSwings ? lunge : -lunge * 0.5;
      villainX -= rogerSwings ? -lunge * 0.5 : lunge;
    } else if (beat.name === 'finalBlow') {
      rogerAction = 'hurt';
      villainAction = 'punch1';
      rogerX = W * 0.225;
      villainX = W * 0.335;
    } else if (this.reached('rogerFalls')) {
      rogerFlat = true;
      villainAction = 'idle';
      villainX = W * 0.38;
    }

    // Roger. Once down he is drawn flat on the floor and stays there.
    if (rogerFlat) {
      const fall = beat.name === 'rogerFalls' ? Math.min(1, beat.t * 2.2) : 1;
      drawIntroCharacter(
        ctx, 'roger', rogerX - 30 * fall, floorY,
        { facing: 1, action: 'ko', walkPhase: 0, phase: fall * 0.999 },
        INTRO_ROGER_COLORS,
      );
    } else {
      drawIntroCharacter(
        ctx, 'roger', rogerX, floorY,
        {
          facing: 1,
          action: rogerAction,
          walkPhase: this.frame * 0.25,
          phase: (this.frame % INTRO_IDLE_CYCLE) / INTRO_IDLE_CYCLE,
        },
        INTRO_ROGER_COLORS,
      );
    }

    // Meeottee. Gloats with the pack's victory clip once Roger is down.
    const gloating = this.reached('villainGloat') && villainAction === 'idle';
    drawIntroCharacter(
      ctx, 'villain', villainX, floorY,
      {
        facing: -1,
        action: gloating ? 'gloat' : villainAction,
        walkPhase: this.frame * 0.25,
        phase: (this.frame % INTRO_IDLE_CYCLE) / INTRO_IDLE_CYCLE,
      },
      INTRO_VILLAIN_COLORS,
    );

    // Impact flashes on each traded blow, and a big one on the finisher.
    if (beat.name === 'exchange') {
      const per = 1 / INTRO_EXCHANGE_BLOWS;
      const within = (beat.t % per) / per;
      const blow = Math.floor(beat.t * INTRO_EXCHANGE_BLOWS);
      const towardVillain = blow % 2 === 0;
      if (within < 0.5) {
        drawImpact(
          ctx,
          towardVillain ? villainX - 34 : rogerX + 34,
          floorY - 150, within * 2, '#fff2c4',
        );
      }
    }
    if (beat.name === 'finalBlow') {
      drawImpact(ctx, rogerX + 40, floorY - 150, Math.min(1, beat.t * 2), '#ffd54d');
      drawActionWord(ctx, W * 0.24, floorY - 170, 'POW!', beat.t);
    }

    // Name plates, once the fight has settled.
    if (this.reached('rogerFalls')) {
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(200,215,255,0.65)';
      ctx.fillText(t('introRoger'), rogerX - 30, floorY + 20);
      ctx.fillStyle = 'rgba(255,190,150,0.8)';
      ctx.fillText(t('introVillain'), villainX, floorY + 20);
    }

    // --- Dialogue ---
    // Each line is anchored over its speaker and tailed toward them, and
    // they alternate sides, so it reads as an exchange.
    if (beat.name === 'taunt') {
      drawSpeechBubble(
        ctx, W * 0.50, floorY - 268, 270, t('introTaunt'), beat.t,
        { tailX: -50, fontSize: 15 },
      );
    }
    if (beat.name === 'defy') {
      drawSpeechBubble(
        ctx, W * 0.16, floorY - 268, 240, t('introDefy'), beat.t,
        { shout: true, tailX: 30, fontSize: 15 },
      );
    }
    if (beat.name === 'mock') {
      drawSpeechBubble(
        ctx, W * 0.50, floorY - 268, 250, t('introMock'), beat.t,
        { tailX: -50, fontSize: 15 },
      );
    }
    if (beat.name === 'villainGloat') {
      drawSpeechBubble(
        ctx, W * 0.52, floorY - 268, 260, t('introDefeat'), beat.t,
        { tailX: -50, fontSize: 15 },
      );
    }
    if (beat.name === 'villainCall') {
      drawSpeechBubble(
        ctx, W * 0.52, floorY - 268, 250, t('introCall'), beat.t,
        { shout: true, tailX: -50, fontSize: 15 },
      );
    }
    if (beat.name === 'rogerPlea') {
      drawSpeechBubble(
        ctx, W * 0.16, floorY - 100, 190, t('introSave'), beat.t,
        { tailX: 40, fontSize: 14 },
      );
    }
  }

  // ---- Shot 2: Gere, elsewhere, hearing it ----
  //
  // The arc is: lounging in the park with no idea -> the call reaches him
  // -> he transforms straight out of lying down -> swears at a villain who
  // cannot hear him -> runs for his father.
  drawGereShot(ctx, beat) {
    const { W, H } = this;
    const floorY = H - INTRO_FLOOR_INSET;
    // He stays put until he runs, then leaves frame to the right.
    const runT = beat.name === 'gereRuns' ? beat.t : 0;
    // SuperGere covers twice the ground Gere would (see FURY_RUN_MULTIPLIER
    // in entities.js -- the same rule applies in gameplay), so he crosses
    // and clears the frame rather than jogging off it.
    const gereX = W * 0.30 + runT * runT * W * 1.7;
    const transformed = this.reached('gereTransform');
    const heated = this.reached('gereHears');

    // A sunny park -- deliberately the opposite of the cellar, so the cut
    // lands as "somewhere else entirely" and Gere reads as oblivious.
    if (introPark) {
      drawCoverImage(ctx, introPark, W, H);
    } else {
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#7fc4e8');
      sky.addColorStop(1, '#cfe89a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
    }
    // The park sours as the news lands and goes gold once he changes, so
    // the mood turns with him rather than staying cheerful through it.
    if (heated) {
      const heat = beat.name === 'gereHears' ? Math.min(1, beat.t * 1.4) : 1;
      ctx.fillStyle = transformed
        ? 'rgba(60,30,0,0.46)'
        : `rgba(40,10,10,${0.30 * heat})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Gold aura and rising motes once transformed.
    if (transformed) {
      const glow = ctx.createRadialGradient(
        gereX, floorY - 120, 10, gereX, floorY - 120, 300,
      );
      glow.addColorStop(0, 'rgba(255,200,60,0.42)');
      glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gereX - 320, floorY - 420, 640, 460);

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,235,0.95)';
      for (let i = 0; i < 14; i++) {
        const seed = i * 37;
        const cycle = (this.frame * 2.4 + seed) % 190;
        const py = floorY - cycle;
        const px = gereX + Math.sin((cycle + seed) * 0.05) * (40 + (i % 5) * 18);
        ctx.globalAlpha = Math.max(0, 1 - cycle / 190);
        ctx.beginPath();
        ctx.arc(px, py, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Gere himself ---
    // The ordinary pack before the change, the FURY skin after. Both are
    // the same art gameplay uses.
    const role = transformed ? 'supergere' : 'gere';
    let action = 'relaxed';
    let phase = (this.frame % INTRO_RELAXED_CYCLE) / INTRO_RELAXED_CYCLE;
    if (beat.name === 'gereHears') {
      // Still lying there as the call arrives.
      action = 'relaxed';
    } else if (beat.name === 'gereVow') {
      // On his feet and shouting back -- still ORDINARY Gere. The line is
      // what triggers the change, so it has to be said before it.
      action = 'idle';
      phase = (this.frame % INTRO_IDLE_CYCLE) / INTRO_IDLE_CYCLE;
    } else if (beat.name === 'gereTransform') {
      action = 'power';
      phase = Math.min(0.999, beat.t);
    } else if (beat.name === 'gereAngry') {
      // Transformed and furious, holding the stance before he goes.
      action = 'power';
      phase = 0.999;
    } else if (beat.name === 'gereRuns') {
      action = 'run';
      phase = (this.frame % INTRO_RUN_CYCLE) / INTRO_RUN_CYCLE;
    }

    // A shudder while transforming, settling as the flash clears.
    const shudder = beat.name === 'gereTransform'
      ? Math.sin(this.frame * 0.9) * 4 * (1 - beat.t) : 0;

    ctx.save();
    ctx.translate(shudder, 0);
    drawIntroCharacter(
      ctx, role, gereX, floorY,
      {
        facing: 1,
        action,
        walkPhase: this.frame * 0.25,
        phase,
        grow: transformed ? 1.15 : 1,
      },
      PlayerColors,
      2.6,
    );
    ctx.restore();

    // Name plate. Hidden once he is running -- it would trail after him.
    if (beat.name !== 'gereRuns') {
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,235,170,0.9)';
      ctx.fillText(transformed ? 'SUPER GERE' : t('introGere'), gereX, floorY + 20);
    }

    // Roger's plea reaching him, faint and far off.
    if (beat.name === 'cutToGere' || beat.name === 'gereHears') {
      const p = beat.name === 'gereHears' ? Math.min(1, beat.t * 1.6) : 0.25;
      ctx.save();
      ctx.globalAlpha = 0.75;
      drawSpeechBubble(
        ctx, W * 0.24, H * 0.22, 190, t('introSave'), p,
        { tailDown: false, tailX: 30, fontSize: 13 },
      );
      ctx.restore();
    }

    // The transformation flash: peaks mid-beat and clears, which is what
    // hides the swap from one pack to the other.
    if (beat.name === 'gereTransform') {
      const flash = beat.t < 0.55
        ? beat.t / 0.55
        : Math.max(0, 1 - (beat.t - 0.55) / 0.45);
      ctx.fillStyle = `rgba(255,248,220,${flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    // The vow, thrown at a villain who cannot hear it. Said as ordinary
    // Gere -- it is what sets the transformation off.
    if (beat.name === 'gereVow') {
      drawSpeechBubble(
        ctx, W / 2, H * 0.20, 400, t('introVow'), Math.min(1, beat.t * 1.6),
        { shout: true, tailX: -40, fontSize: 16, fill: '#fff6d8' },
      );
    }
    // And the line he leaves on, riding along with him as he goes.
    if (beat.name === 'gereRuns' && runT < 0.55) {
      drawSpeechBubble(
        ctx, Math.min(W * 0.70, gereX + 30), H * 0.24, 250,
        t('introComing'), Math.min(1, beat.t * 5),
        { shout: true, tailX: -40, fontSize: 16, fill: '#fff6d8' },
      );
    }
  }

  // ---- Shot 3: the level card ----
  drawCardShot(ctx, beat) {
    const { W, H } = this;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    // Slams in, holds, then the level takes over.
    const slam = Math.min(1, beat.t * 5);
    const scale = slam < 1 ? 2.2 - slam * 1.2 : 1;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, beat.t * 6);

    // Speed lines radiating behind the card.
    ctx.strokeStyle = 'rgba(255,213,77,0.22)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 90, Math.sin(a) * 90);
      ctx.lineTo(Math.cos(a) * 220, Math.sin(a) * 220);
      ctx.stroke();
    }

    ctx.font = 'bold 44px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1a1020';
    ctx.strokeText(t('levelStart'), 0, 0);
    ctx.fillStyle = '#ffd54d';
    ctx.fillText(t('levelStart'), 0, 0);
    ctx.restore();
  }

  draw(ctx) {
    const { W, H } = this;
    const beat = this.currentBeat();

    ctx.save();
    const quake = this.shake(beat);
    ctx.translate(quake.x, quake.y);

    if (beat.shot === 'fight') this.drawFightShot(ctx, beat);
    else if (beat.shot === 'gere') this.drawGereShot(ctx, beat);
    else this.drawCardShot(ctx, beat);

    ctx.restore();

    // Fades. The opening fade-in, and a quick dip to black on each cut so
    // the change of location reads as an edit rather than a jump.
    if (beat.name === 'fadeIn') {
      ctx.fillStyle = `rgba(0,0,0,${1 - beat.t})`;
      ctx.fillRect(0, 0, W, H);
    } else if (beat.name === 'cutToGere') {
      ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - beat.t * 2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Skip prompt, always available so a replaying player is never stuck.
    // Sits on its own dark plate: it used to be drawn straight over the
    // scene and vanished against a crowd of sprites at the bottom right.
    ctx.save();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    const label = t('introSkip');
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, W - tw - 20, H - 24, tw + 14, 16, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(label, W - 13, H - 12);
    ctx.restore();
  }
}
