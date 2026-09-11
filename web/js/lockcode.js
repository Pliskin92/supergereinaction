// The secret lock code: the last thing standing between Gere and his
// father, and the prize for finishing the run.
//
// Beating the final boss no longer ends the game on its own. Behind him is a
// locked door, and the code is PRINTED on the screen -- big, unmissable,
// held for as long as the player wants. Writing it down is the point: it is
// a real code for a real lock, not a puzzle to solve in-game.
//
// The code itself is a single constant below. It is meant to be replaced
// with the real one; until then it is 0000, which is also what the game
// ships with and what anyone who has not been told the real code will see.
//
// SECURITY, stated plainly: this is a static browser game, so the code is
// in the source and in the shipped bundle. Anyone who opens the devtools
// can read it without playing. It is a keepsake at the end of a story, not
// a secret that resists inspection -- do not use a code here that protects
// anything that matters.

// The code, hardcoded. Replace the digits; nothing else needs to change.
//
// Any length works and it is drawn as characters, not parsed as a number,
// so leading zeroes survive and letters would too.
const LOCK_CODE = '0000';

// How long the reveal takes before the code is on screen, in frames. The
// digits land one at a time, so this is per digit.
const LOCK_DIGIT_FRAMES = 42;
// A beat of quiet before the first digit, so the screen reads as arriving
// somewhere rather than cutting to a number.
const LOCK_LEAD_FRAMES = 70;

// Once every digit is up the screen holds indefinitely -- there is no timer
// on it. The player leaves when they have written it down.

class LockCodeScreen {
  constructor(W, H, code = LOCK_CODE) {
    this.W = W;
    this.H = H;
    this.code = String(code);
    this.timer = 0;
    // Set when the player dismisses it; the summary follows.
    this.done = false;
  }

  // How many digits have landed so far.
  revealed() {
    const t = this.timer - LOCK_LEAD_FRAMES;
    if (t <= 0) return 0;
    return Math.min(this.code.length, Math.floor(t / LOCK_DIGIT_FRAMES) + 1);
  }

  get complete() {
    return this.revealed() >= this.code.length;
  }

  // Dismissing only works once the whole code is up: a stray keypress
  // during the reveal must not skip past the thing the screen exists to
  // show. Before that, a press finishes the reveal instead.
  dismiss() {
    if (!this.complete) {
      this.timer = LOCK_LEAD_FRAMES + this.code.length * LOCK_DIGIT_FRAMES;
      return;
    }
    this.done = true;
  }

  update() {
    if (this.done) return;
    this.timer++;
  }

  draw(ctx) {
    const { W, H } = this;
    ctx.save();
    ctx.fillStyle = '#07060e';
    ctx.fillRect(0, 0, W, H);

    // A slow pulse behind the code, so the screen is alive while the player
    // copies the digits down.
    const pulse = 0.5 + Math.sin(this.timer / 26) * 0.5;
    const glow = ctx.createRadialGradient(W / 2, H * 0.52, 20, W / 2, H * 0.52, W * 0.5);
    glow.addColorStop(0, `rgba(0, 245, 212, ${0.10 + pulse * 0.07})`);
    glow.addColorStop(1, 'rgba(0, 245, 212, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    ctx.font = 'bold 17px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a1020';
    ctx.strokeText(t('lockTitle'), W / 2, H * 0.22);
    ctx.fillStyle = '#ffd54d';
    ctx.fillText(t('lockTitle'), W / 2, H * 0.22);

    // The code itself: the biggest thing the game ever draws, because it is
    // the one thing the player has to carry out of the game with them.
    const n = this.code.length;
    const shown = this.revealed();
    const size = Math.min(76, (W * 0.68) / Math.max(1, n));
    const gap = size * 0.92;
    const startX = W / 2 - ((n - 1) * gap) / 2;
    const y = H * 0.52;

    for (let i = 0; i < n; i++) {
      const x = startX + i * gap;
      // Each digit's slot is drawn from the start, so the length of the
      // code is visible before it is filled in.
      ctx.strokeStyle = 'rgba(0,245,212,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.34, y + size * 0.46);
      ctx.lineTo(x + size * 0.34, y + size * 0.46);
      ctx.stroke();

      if (i >= shown) continue;
      // The digit lands with a brief overshoot, so each one arrives.
      const age = this.timer - LOCK_LEAD_FRAMES - i * LOCK_DIGIT_FRAMES;
      const pop = Math.min(1, Math.max(0, age / 12));
      const scale = pop < 1 ? 1.9 - pop * 0.9 : 1;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.font = `bold ${Math.round(size)}px monospace`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#05221f';
      ctx.strokeText(this.code[i], 0, 0);
      ctx.fillStyle = '#00f5d4';
      ctx.fillText(this.code[i], 0, 0);
      ctx.restore();
    }

    // The instruction, only once the code is fully up -- before that the
    // screen is still revealing and there is nothing to write down yet.
    if (this.complete) {
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t('lockWriteItDown'), W / 2, H * 0.76);
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(t('lockContinue'), W / 2, H * 0.86);
    }
    ctx.restore();
  }
}
