// The card that announces a level before it is played.
//
// The opening cutscene ends on one of these (intro.js, drawCardShot), but
// that one is a beat inside a scene that only plays before level 1. Levels
// 2-6 arrive by navigation from the previous level's summary, so without
// this they cut straight from a summary screen to a street. The card is
// what makes arriving somewhere feel like arriving somewhere.
//
// It is deliberately its own small class rather than a beat in IntroScene:
// it has to run in front of EVERY level, including ones with no cutscene,
// and it has to hold the world still exactly the way the cutscene does.
//
// STORY ART: this is the natural home for a per-level splash -- a comic
// panel, a establishing shot of the garage/workshop/yard. `art` on the
// campaign row is drawn behind the caption when it is present, and the
// card falls back to the speed-line treatment when it is not, so the art
// can be dropped in one level at a time. See ART-TODO.md.

// How long the card is up, in frames. Long enough to read the title and
// the name of whoever is being rescued, short enough not to be a wall
// between the player and the game -- and skippable regardless.
const LEVEL_CARD_FRAMES = 150;
// The card fades the level in underneath it over its last stretch, so the
// hand-off is a dissolve rather than a cut.
const LEVEL_CARD_FADE_FRAMES = 45;

// Loaded splash art, keyed by level id. A level without art simply never
// gets an entry and the card draws its procedural treatment instead.
const LevelCardArt = {};

// Loads the splash art for one level, if its row declares any. Resolves
// either way: missing art is a fallback, not a failure, so the level's
// loading gate must not hang on it.
function loadLevelCardArt(levelDef) {
  if (!levelDef || !levelDef.art) return Promise.resolve();
  return loadImage(levelDef.art).then((img) => {
    if (img) LevelCardArt[levelDef.id] = img;
  });
}

class LevelCard {
  constructor(W, H, levelDef, levelNumber) {
    this.W = W;
    this.H = H;
    this.level = levelDef;
    this.number = levelNumber;
    this.timer = 0;
    this.done = false;
  }

  // Enter/Space cuts the card short, the same way Enter skips the cutscene.
  skip() {
    this.done = true;
  }

  update() {
    if (this.done) return;
    this.timer++;
    if (this.timer >= LEVEL_CARD_FRAMES) this.done = true;
  }

  // How opaque the card is over the level beneath it: solid until the fade
  // begins, then easing off to nothing.
  coverAlpha() {
    const left = LEVEL_CARD_FRAMES - this.timer;
    if (left >= LEVEL_CARD_FADE_FRAMES) return 1;
    return Math.max(0, left / LEVEL_CARD_FADE_FRAMES);
  }

  draw(ctx) {
    const { W, H } = this;
    const alpha = this.coverAlpha();
    if (alpha <= 0) return;
    // Named `progress`, not `t`: t() is the i18n lookup this method calls
    // several times below, and shadowing it here would break every one.
    const progress = this.timer / LEVEL_CARD_FRAMES;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Backdrop: the level's own splash art when it has some, a flat ground
    // when it does not.
    const art = LevelCardArt[this.level.id];
    if (art) {
      drawCoverImage(ctx, art, W, H);
      // A wash over the art so the type stays readable whatever it shows.
      ctx.fillStyle = 'rgba(10,8,18,0.55)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, W, H);
    }

    // The card slams in, then settles -- the same motion as the cutscene's
    // closing card, so the two read as the same device.
    const slam = Math.min(1, progress * 6);
    const scale = slam < 1 ? 2.0 - slam * 1.0 : 1;
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // Speed lines, only when there is no art to show behind the type.
    if (!art) {
      ctx.strokeStyle = 'rgba(255,213,77,0.20)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 90, Math.sin(a) * 90);
        ctx.lineTo(Math.cos(a) * 240, Math.sin(a) * 240);
        ctx.stroke();
      }
    }

    // "LEVEL 3 OF 6" -- where this street sits in the run, so the campaign
    // has a shape the player can feel rather than an unmarked sequence.
    ctx.font = 'bold 15px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a1020';
    const counter = `${t('level')} ${this.number} / ${CAMPAIGN_LENGTH}`;
    ctx.strokeText(counter, 0, -54);
    ctx.fillStyle = '#ff2a85';
    ctx.fillText(counter, 0, -54);

    // The level's own name.
    ctx.font = 'bold 30px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#1a1020';
    ctx.strokeText(t(this.level.titleKey), 0, -14);
    ctx.fillStyle = '#ffd54d';
    ctx.fillText(t(this.level.titleKey), 0, -14);

    // Who is waiting at the end of it -- the reason the street is fought.
    if (this.level.rescue) {
      ctx.font = 'bold 14px Impact, "Arial Black", sans-serif';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1a1020';
      const line = `${t('rescueGoal')}: ${t('rescue_' + this.level.rescue)}`;
      ctx.strokeText(line, 0, 24);
      ctx.fillStyle = '#00f5d4';
      ctx.fillText(line, 0, 24);
    }

    ctx.restore();

    // The skip prompt sits in the corner, outside the slam transform so it
    // does not fly in with the card.
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t('cardSkip'), W - 10, H - 8);
    ctx.restore();
  }
}
