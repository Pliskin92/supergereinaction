// FURY meter HUD and the Looney-Tunes style transformation popup.
//
// Kept separate from entities.js because it is pure presentation: Player
// owns the meter and fires this.furyEvent ('start' | 'end') for exactly one
// frame on each transition, and FuryPopup turns that edge into an animation.
// Nothing here feeds back into gameplay.

// ---- Popup ----
// The classic cartoon title-card move: the text spins in from nothing,
// overshoots its resting size, wobbles, holds, then spins back out. All of
// it is driven by one 0..1 progress value so the whole thing scales with
// POPUP_FRAMES rather than needing per-stage timers.
const POPUP_FRAMES = 150;
const POPUP_SPIN_IN = 0.30;   // fraction of the run spent spinning in
const POPUP_SPIN_OUT = 0.82;  // progress at which the spin-out begins

// The transformation stops the world for a beat: gameplay is suspended
// while the card slams in, so the moment lands instead of scrolling past
// under continued play. One second at 60fps.
const POPUP_FREEZE_FRAMES = 60;

// Screen-shake while frozen: an earthquake that decays over the freeze.
const POPUP_SHAKE_AMPLITUDE = 14;

// Word-art sizing. The card is meant to dominate the screen and cover the
// character, so this is deliberately large relative to the 480px canvas.
const POPUP_FONT_SIZE = 58;
const POPUP_MAX_CHARS_PER_LINE = 13;
// How far the outermost letters tilt (radians) and rise, which is what
// gives the line its banner curve.
const POPUP_LETTER_TILT = 0.22;
const POPUP_LETTER_ARC = -16;

// Splits a shout into lines of at most `maxChars`, breaking on spaces so
// words stay intact. Used so a long transformation string stacks rather
// than overflowing the canvas at word-art size.
function wrapPopupText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [String(text)];
}

// Overshoot easing: shoots past 1 then settles, so the card "pops".
function easeOutBack(t) {
  const c = 2.2;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

class FuryPopup {
  constructor() {
    this.timer = 0;
    this.text = '';
    this.tone = 'good';
  }

  show(text, tone) {
    this.timer = POPUP_FRAMES;
    this.text = text;
    this.tone = tone || 'good';
  }

  get active() {
    return this.timer > 0;
  }

  // True while the world should hold still. Callers skip their update()
  // for these frames so the transformation reads as a hard cut-in.
  get freezing() {
    return this.timer > POPUP_FRAMES - POPUP_FREEZE_FRAMES;
  }

  // Camera offset for the quake, in canvas pixels. Decays to nothing as
  // the freeze ends so the world settles rather than snapping still.
  shake() {
    if (!this.freezing) return { x: 0, y: 0 };
    const elapsed = POPUP_FRAMES - this.timer;          // 0 -> FREEZE
    const decay = 1 - elapsed / POPUP_FREEZE_FRAMES;    // 1 -> 0
    const amp = POPUP_SHAKE_AMPLITUDE * decay * decay;
    // Two different frequencies so it jitters rather than oscillating.
    return {
      x: Math.sin(elapsed * 1.7) * amp,
      y: Math.cos(elapsed * 2.3) * amp * 0.6,
    };
  }

  update() {
    if (this.timer > 0) this.timer--;
  }

  // Watches a player for transformation edges so callers only have to
  // forward the player once per frame.
  follow(player, strings) {
    if (!player) return;
    // Death beats take precedence: going down and coming back are bigger
    // moments than a transformation timing out.
    if (player.deathEvent) {
      if (player.deathEvent === 'exhausted') this.show(strings.exhausted, 'bad');
      else if (player.deathEvent === 'comeback') this.show(strings.comeback, 'good');
      else if (player.deathEvent === 'gameOver') this.show(strings.exhausted, 'bad');
      player.deathEvent = null;
      // Swallow any transformation edge fired on the same frame -- ending
      // FURY is part of dying, not a separate announcement.
      player.furyEvent = null;
      return;
    }
    if (!player.furyEvent) return;
    if (player.furyEvent === 'start') this.show(strings.furyOn, 'good');
    else if (player.furyEvent === 'end') this.show(strings.furyOff, 'bad');
    player.furyEvent = null;
  }

  draw(ctx, W, H) {
    if (this.timer <= 0) return;
    const p = 1 - this.timer / POPUP_FRAMES; // 0 -> 1 over the run

    // scale/spin: in, hold (with a wobble), out
    let scale, spin, alpha;
    if (p < POPUP_SPIN_IN) {
      const t = p / POPUP_SPIN_IN;
      scale = easeOutBack(t);
      spin = (1 - t) * Math.PI * 4; // four full turns on the way in
      alpha = Math.min(1, t * 2);
    } else if (p < POPUP_SPIN_OUT) {
      const t = (p - POPUP_SPIN_IN) / (POPUP_SPIN_OUT - POPUP_SPIN_IN);
      scale = 1 + Math.sin(t * Math.PI * 6) * 0.04; // slow wobble while held
      spin = Math.sin(t * Math.PI * 5) * 0.05;      // slight rock
      alpha = 1;
    } else {
      const t = (p - POPUP_SPIN_OUT) / (1 - POPUP_SPIN_OUT);
      scale = 1 - t;
      spin = t * Math.PI * 3;
      alpha = 1 - t;
    }
    if (scale <= 0) return;

    const good = this.tone === 'good';
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, H * 0.38);
    ctx.rotate(spin);
    ctx.scale(scale, scale);

    // Radiating cartoon "burst" behind the text.
    const rays = 12;
    ctx.fillStyle = good ? 'rgba(255,213,77,0.30)' : 'rgba(120,130,150,0.30)';
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + p * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.10) * 150, Math.sin(a - 0.10) * 150);
      ctx.lineTo(Math.cos(a + 0.10) * 150, Math.sin(a + 0.10) * 150);
      ctx.closePath();
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // Word-art: the text is laid out per letter across an arc, each glyph
    // rotated, so it reads as a cartoon title card rather than a caption.
    // Long strings are wrapped so a two-word shout stacks instead of
    // running off the canvas at this size.
    const lines = wrapPopupText(this.text, POPUP_MAX_CHARS_PER_LINE);
    const size = POPUP_FONT_SIZE;
    ctx.font = `bold ${size}px Impact, "Arial Black", sans-serif`;
    const lineH = size * 0.95;
    const startY = -((lines.length - 1) * lineH) / 2;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const widths = [...line].map((ch) => ctx.measureText(ch).width);
      const total = widths.reduce((a, c) => a + c, 0);
      let penX = -total / 2;
      const baseY = startY + li * lineH;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const w = widths[i];
        // Letters arc: ends tilt outward and ride higher, like a banner.
        const centred = line.length > 1 ? (i / (line.length - 1)) * 2 - 1 : 0;
        const tilt = centred * POPUP_LETTER_TILT;
        const arc = centred * centred * POPUP_LETTER_ARC;

        ctx.save();
        ctx.translate(penX + w / 2, baseY + arc);
        ctx.rotate(tilt);

        // Thick dark outline, then the fill, then a highlight along the
        // top edge — the standard cartoon title-card treatment.
        ctx.lineWidth = size * 0.20;
        ctx.strokeStyle = '#1a1020';
        ctx.strokeText(ch, 0, 0);
        ctx.fillStyle = good ? '#ffd54d' : '#9aa6bb';
        ctx.fillText(ch, 0, 0);
        ctx.fillStyle = good ? '#fff3c4' : '#d6dce8';
        ctx.fillText(ch, 0, -size * 0.06);
        ctx.restore();

        penX += w;
      }
    }

    ctx.restore();
  }
}

// ---- Portrait ----
// Gere's face in the corner of the HUD, which reacts to how the run is
// going: it sours as health drops and goes platinum during FURY. This is
// the same idea as Doom's status face -- state the player already has in
// two bars, restated as an expression they read without looking.
//
// The art is loaded here rather than through assets.js, which is strictly
// sprite-sheet clips (image + atlas). These are single stills with no
// atlas, so they load as plain images.
//
// These are copies of the originals in assets/private, which .dockerignore
// keeps out of the image -- a face loaded from there would 404 in the
// deployed build while working fine locally. Anything the HUD needs at
// runtime has to live under assets/release.
const FACE_DIR = 'assets/release/hud/faces';
const FACE_FILES = {
  bigsmile: 'face_bigsmile.png',   // healthy
  happy: 'face_happy.png',         // lightly hurt
  smirk: 'face_smirk.png',         // hurt
  angry: 'face_angry.png',         // badly hurt
  platinumAngry: 'face_platinum_angry.png', // FURY
  platinumShout: 'face_platinum_shout.png', // FURY, mid-transformation
};

const FaceImages = {};

// Resolves once every face has been attempted. The level waits on this
// before it starts, so the portrait is never drawn as an empty frame.
// A face that fails to load individually still stays absent rather than
// blocking the level forever -- loadImage resolves null on error.
function loadFaces() {
  return Promise.all(Object.entries(FACE_FILES).map(
    ([key, file]) => loadImage(`${FACE_DIR}/${file}`).then((img) => {
      if (img) FaceImages[key] = img;
    }),
  ));
}

// Health thresholds the expression changes at, as fractions of max HP.
const FACE_HURT_AT = 0.66;
const FACE_BAD_AT = 0.33;
// How long after transforming the shouting face holds before settling into
// the steady FURY glare.
const FACE_SHOUT_FRAMES = 90;

// Which face to show for the player's current state. FURY wins over health:
// while transformed the portrait is platinum whatever the health bar says.
function faceFor(player) {
  if (player.furyActive) {
    const elapsed = FURY_ACTIVE_FRAMES - player.furyTimer;
    return elapsed < FACE_SHOUT_FRAMES ? 'platinumShout' : 'platinumAngry';
  }
  const pct = player.maxHp > 0 ? player.hp / player.maxHp : 0;
  // A full meter is worth calling out even before it is spent: the player
  // is one hit from transforming, and the smirk reads as "ready".
  if (pct > FACE_HURT_AT) {
    return player.fury >= FURY_MAX ? 'smirk' : 'bigsmile';
  }
  if (pct > FACE_BAD_AT) return 'happy';
  return 'angry';
}

// Draws the portrait in a framed box. Returns nothing; the caller owns the
// layout and just says where and how big.
function drawFacePortrait(ctx, player, x, y, size) {
  ctx.save();
  // The frame is drawn whether or not the art loaded, so the HUD's shape
  // does not jump around while the images are still arriving.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, x, y, size, size, 4);
  ctx.fill();

  const img = FaceImages[faceFor(player)];
  if (img) {
    // The stills are portrait-ish; fit them inside the square box without
    // distorting, which keeps every expression the same scale.
    const scale = Math.min(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  }

  // The frame goes gold and pulses while transformed, so FURY is legible
  // even at a glance that misses the face itself.
  if (player.furyActive) {
    const pulse = 0.6 + Math.sin(Date.now() / 90) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffd54d';
    ctx.lineWidth = 2;
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
  }
  rr(ctx, x, y, size, size, 4);
  ctx.stroke();
  ctx.restore();
}

// ---- Meter ----
// Drawn as a labelled bar; it pulses gold while FURY is active and shows
// the remaining seconds so the 20-second window is readable at a glance.
function drawFuryBar(ctx, player, x, y, w, h, strings) {
  const pct = clamp(player.fury / FURY_MAX, 0, 1);
  const active = player.furyActive;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, x - 1, y - 1, w + 2, h + 2, 3);
  ctx.fill();

  if (active) {
    // Pulsing fill while transformed, draining with the timer.
    const remain = clamp(player.furyTimer / FURY_ACTIVE_FRAMES, 0, 1);
    const pulse = 0.75 + Math.sin(Date.now() / 90) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ff6a00';
    rr(ctx, x, y, w * remain, h, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = pct >= 1 ? '#ffd54d' : '#c2410c';
    rr(ctx, x, y, w * pct, h, 2);
    ctx.fill();
  }

  // The caption is sized off the bar rather than fixed, so a HUD drawn at
  // one scale doesn't end up with unreadable type at another.
  const labelSize = Math.max(7, Math.round(h * 0.95));
  ctx.font = `bold ${labelSize}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = active ? '#ffd54d' : '#e8e8f0';
  const label = active
    ? `${strings.fury} ${Math.ceil(player.furyTimer / 60)}s`
    : `${strings.fury} ${Math.floor(pct * 100)}%`;
  ctx.fillText(label, x, y + h + labelSize);
  ctx.restore();
}
