// Assists: the uncles Gere unlocks, called into a fight for a spell.
//
// Rescuing Mattia (level 3) and Michele (level 4) unlocks them as assists.
// From then on they can be called into any fight: the summoned uncle walks
// in, picks his own targets and hits them for ASSIST_DURATION frames, then
// leaves. He cannot be hurt and does not block -- he is a temporary second
// attacker, not a second player to babysit.
//
// Why this shape:
//   * ON A COOLDOWN, not a resource. There is nothing to run out of and
//     nothing to buy, so the button is always meaningful and the only
//     decision is WHEN -- which is the interesting one in a beat-em-up.
//   * HE PICKS HIS OWN TARGETS. Steering him would need a second control
//     scheme on a pad that is already full on a phone.
//   * HE CANNOT DIE. An assist that can be killed turns a reward into a
//     thing to protect, which is the opposite of what it is for.
//
// Unlocks live on the run (js/campaign.js), so they persist across the page
// load between levels and are lost when the run is.
//
// ART: an assist uses its character's own sprite pack and falls back to the
// vector figure when there is none, exactly as the story scenes do. Mattia
// and Michele have no packs yet, so today they appear as coloured figures
// that punch. See ART-TODO.md.

// How long a summoned assist stays in the fight, and how long before
// another can be called.
//
// 20 seconds active against 45 of cooldown means an assist is present for
// roughly a third of a sustained fight: long enough to turn an encounter,
// short enough that clearing a street is still the player's own work.
const ASSIST_DURATION = 20 * 60;
const ASSIST_COOLDOWN = 45 * 60;

// The assists, keyed by the campaign `rescue` id that unlocks them.
//
// Each is a sprite character plus the numbers that make him fight
// differently from the other, so calling Mattia is not the same as calling
// Michele: Mattia is the fast one who hits often for less, Michele the slow
// one who hits hard.
const Assists = {
  mattia: {
    id: 'mattia',
    nameKey: 'rescue_mattia',
    spriteCharacter: 'mattia',
    colors: { suit: '#6a5a3a', accent: '#d8c8a0', skin: '#e8bd96', hair: '#5a4630' },
    speed: 2.5,
    damage: 7,
    // Frames between swings.
    attackEvery: 34,
    reach: 96,
  },
  michele: {
    id: 'michele',
    nameKey: 'rescue_michele',
    spriteCharacter: 'michele',
    colors: { suit: '#3a6a4a', accent: '#c0dcc8', skin: '#e8bd96', hair: '#4a3a28' },
    speed: 1.7,
    damage: 15,
    attackEvery: 58,
    reach: 112,
  },
};

// Which assists a run has unlocked, in the order they were rescued.
//
// Reads the run's `rescued` list rather than keeping a second one: the
// rescue IS the unlock, so deriving it means the two can never disagree.
function unlockedAssists(runState) {
  if (!runState || !Array.isArray(runState.rescued)) return [];
  return runState.rescued.filter((id) => Assists[id]).map((id) => Assists[id]);
}

// How far from the player a summoned assist arrives, and how close he tries
// to get to whoever he is hitting.
const ASSIST_ARRIVE_OFFSET = 150;
const ASSIST_PREFERRED_GAP = 70;
// He gives up on a target further away than this and picks another, so he
// never walks the length of the street after one straggler.
const ASSIST_SEEK_RANGE = 620;
// How long the arrival flash lasts.
const ASSIST_ENTER_FRAMES = 18;

// Assists draw at the player's rough height, for the same reason the story
// scenes normalise: packs are authored at different sizes.
const ASSIST_DRAW_HEIGHT = 150;
const ASSIST_VECTOR_HEIGHT = 62;


class Assist {
  constructor(def, x, y) {
    this.def = def;
    this.x = x;
    this.y = y;
    this.facing = 1;
    this.timer = ASSIST_DURATION;
    this.enterTimer = ASSIST_ENTER_FRAMES;
    this.attackCooldown = 20;
    this.action = 'idle';
    this.animTimer = 0;
    this.walkPhase = 0;
    // Set for one frame when a blow lands, so the level can react (a hit
    // spark, a sound) without polling.
    this.struck = null;
  }

  get done() {
    return this.timer <= 0;
  }

  // Nearest living enemy within range, or null. The boss counts: an assist
  // that downed minions but stood watching a boss fight would read as
  // broken.
  findTarget(enemies) {
    let best = null;
    let bestDist = ASSIST_SEEK_RANGE;
    for (const e of enemies) {
      if (e.dead || e.def.inert) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  update(enemies, bounds) {
    if (this.timer <= 0) return;
    this.timer--;
    if (this.enterTimer > 0) this.enterTimer--;
    if (this.attackCooldown > 0) this.attackCooldown--;
    this.animTimer++;
    this.struck = null;

    const target = this.findTarget(enemies);
    if (!target) {
      this.action = 'idle';
      return;
    }

    this.facing = target.x >= this.x ? 1 : -1;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const gap = Math.abs(dx);

    // Close to striking distance, then swing on the cooldown.
    if (gap > ASSIST_PREFERRED_GAP) {
      this.action = 'walk';
      this.x += Math.sign(dx) * this.def.speed;
      this.walkPhase += this.def.speed;
    } else {
      this.action = 'idle';
    }
    // Line up in depth as well, so a blow is not thrown at someone standing
    // a lane away.
    if (Math.abs(dy) > 6) this.y += Math.sign(dy) * Math.min(this.def.speed, Math.abs(dy));
    if (bounds) {
      this.x = clamp(this.x, bounds.left, bounds.right);
      this.y = clamp(this.y, bounds.top, bounds.bottom);
    }

    if (gap <= this.def.reach && Math.abs(dy) < 34 && this.attackCooldown <= 0) {
      this.action = 'attack';
      this.animTimer = 0;
      this.attackCooldown = this.def.attackEvery;
      target.takeDamage(this.def.damage, this.x);
      this.struck = { x: target.x, y: target.y };
    }
  }

  // Sprite clip for the current action, falling back through what the pack
  // actually has -- the same partial-pack tolerance the story scenes use.
  clipFor() {
    if (this.action === 'attack') return ['punch', 'kick', 'heavy', 'idle_right'];
    if (this.action === 'walk') return ['walk_right', 'run_right', 'idle_right'];
    return ['idle_right', 'walk_right'];
  }

  draw(ctx, cameraX = 0) {
    if (this.timer <= 0) return;
    const sx = this.x - cameraX;

    // A ring on the ground marks him as summoned rather than another body
    // in the fight, and fades with his remaining time so the player can see
    // the clock without reading the HUD.
    const left = this.timer / ASSIST_DURATION;
    ctx.save();
    ctx.globalAlpha = 0.25 + left * 0.4;
    ctx.strokeStyle = '#00f5d4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(sx, this.y, 34, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    let frame = null;
    const phase = this.action === 'walk'
      ? (this.walkPhase % 40) / 40
      : Math.min(0.99, this.animTimer / 22);
    for (const clip of this.clipFor()) {
      frame = getSpriteFrame(this.def.spriteCharacter, clip, phase);
      if (frame) break;
    }

    ctx.save();
    if (frame) {
      // Normalised to a common height, as the story scenes are, so a pack
      // authored at any size stands correctly beside the player.
      const k = ASSIST_DRAW_HEIGHT / frame.sh;
      ctx.translate(sx, this.y);
      ctx.scale(k, k);
      ctx.scale(this.facing, 1);
      drawSpriteFrame(ctx, frame, 1);
    } else {
      // No pack yet: the vector figure, scaled to the same height.
      ctx.translate(sx, this.y);
      const k = ASSIST_DRAW_HEIGHT / ASSIST_VECTOR_HEIGHT;
      ctx.scale(k, k);
      drawHumanoid(ctx, 0, 0, {
        action: this.action === 'attack' ? 'punch1' : this.action,
        facing: this.facing,
        phase,
      }, this.def.colors);
    }
    ctx.restore();

    // The arrival flash, drawn over him so he reads as appearing rather
    // than as having been there all along.
    if (this.enterTimer > 0) {
      const t = this.enterTimer / ASSIST_ENTER_FRAMES;
      ctx.save();
      ctx.globalAlpha = t * 0.8;
      ctx.fillStyle = '#00f5d4';
      ctx.beginPath();
      ctx.ellipse(sx, this.y - 60, 46 * t + 14, 78 * t + 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// Owns the summoning: which assist is next, the cooldown, and the one that
// is currently out. One at a time -- two on screen at once is a crowd, and
// the point of the rotation is choosing which uncle the moment needs.
class AssistCorps {
  constructor(runState) {
    this.roster = unlockedAssists(runState);
    this.cooldown = 0;
    this.active = null;
    // Which of the unlocked assists the next call summons. The player
    // cycles this rather than it being random, so calling one is a
    // decision.
    this.index = 0;
  }

  get available() {
    return this.roster.length > 0;
  }

  get ready() {
    return this.available && this.cooldown <= 0 && !this.active;
  }

  // The assist the next call would summon.
  get next() {
    return this.roster.length ? this.roster[this.index % this.roster.length] : null;
  }

  cycle() {
    if (this.roster.length > 1) this.index = (this.index + 1) % this.roster.length;
  }

  summon(player, bounds) {
    if (!this.ready) return null;
    const def = this.next;
    // He arrives BEHIND the player, so he walks into the fight past them
    // rather than materialising on top of whoever they are hitting.
    const x = player.x - player.facing * ASSIST_ARRIVE_OFFSET;
    const assist = new Assist(def, x, player.y);
    if (bounds) {
      assist.x = clamp(assist.x, bounds.left, bounds.right);
    }
    this.active = assist;
    this.cooldown = ASSIST_COOLDOWN;
    return assist;
  }

  update(enemies, bounds) {
    if (this.cooldown > 0) this.cooldown--;
    if (this.active) {
      this.active.update(enemies, bounds);
      if (this.active.done) this.active = null;
    }
  }

  draw(ctx, cameraX) {
    if (this.active) this.active.draw(ctx, cameraX);
  }
}
