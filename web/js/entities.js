// Entity logic: player, enemies, assists. Ported/expanded from the PSn00bSDK C scaffold.

// Distance covered per tick while walking/running. Previously 0.3/0.65 —
// too slow to match the walk animation's stride cadence, so the character
// looked like it was shuffling/sliding in place rather than covering ground.
//
// These are tuned against the clips' stride length, not in isolation: what
// reads as "small steps" is a foot cycling faster than the ground it
// covers. One walk cycle is GERE_WALK_CYCLE_FRAMES ticks for ~2 strides,
// so walking advances ~77px per stride (~40% of Gere's 194px height).
// Run's clip cycles nearly twice as fast, so run speed has to rise by more
// than the cadence does or each stride actually shortens — at the old 2.2
// a run stride covered only 88px, barely 14% further than a walk stride
// while the legs moved twice as quickly. 3.4 puts a run stride at ~136px,
// about 1.8x the walk stride, which is roughly the real ratio.
const PLAYER_MOVE_SPEED = 1.1;
const PLAYER_RUN_SPEED = 3.4;
// Dodging (up/down within the fight lane) needs to be quick regardless of
// Shift/run — always moves at this fixed speed rather than PLAYER_MOVE_SPEED.
const PLAYER_DODGE_SPEED = 2.6;
// Drawn under every character's feet (real sprite-sheet frames don't carry
// their own ground shadow the way drawHumanoid's vector fallback does) so
// they visually plant on the street instead of floating over it.
function drawGroundShadow(ctx, sx, y, spriteWidth) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(sx, y + 3, spriteWidth * 0.22, spriteWidth * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
// Draws one sprite frame at its authored size with its feet on the origin.
//
// AutoSprite's atlas gives every clip an identical 256x256 tile, and the
// character sits at a different height inside it per clip, so blitting raw
// tiles makes some clips hover above the ground. The trim data (see
// scripts/build-sprite-trim.py) tightens sx/sy/sw/sh to the character's
// real pixels, so the drawn box's bottom edge is the feet — anchoring it
// at y=0 puts every clip's resting pose on one baseline.
//
// `lift` is then added back: it's how far a frame's feet rise above that
// clip's own ground line, which is where an airborne pose's height lives
// (gere's jump rises 72px this way). Without it a jumping character stays
// glued to the floor. `offsetX` preserves the pose's horizontal lean
// relative to the tile centre, so trimming doesn't snap a pose sideways.
//
// `liftScale` multiplies that rise, letting a move exaggerate its height
// beyond what the artwork encodes (see PLAYER_JUMP_LIFT_SCALE). It is
// applied per-caller rather than baked into the trim data because `lift`
// also carries small incidental motion — run's stride bounce, for one —
// that should stay at its authored size.
//
// No scaling is applied to the sprite itself: it renders at its drawn size.
//
// The caller is expected to have already translated to the character's
// feet and applied any facing flip.
function drawSpriteFrame(ctx, frame, liftScale = 1) {
  const dx = frame.offsetX || 0;
  const lift = (frame.lift || 0) * liftScale;
  ctx.drawImage(
    frame.image,
    frame.sx, frame.sy, frame.sw, frame.sh,
    dx - frame.sw / 2, -frame.sh - lift, frame.sw, frame.sh
  );
}

const PLAYER_SLIDE_SPEED = 4.2;

// Every AutoSprite clip is 25 frames, and getSpriteDraw() spreads a clip
// across its action's hold window. So an action given fewer than 25 ticks
// physically cannot show every frame -- it drops some, which reads as a
// jerky, stuttering animation. These were previously 22 (punch/kick, ~3
// frames dropped) and 14 (hurt, nearly half the clip dropped); each is now
// at least 25 so the whole clip actually plays.
const SPRITE_CLIP_FRAMES = 25;
const PLAYER_COMBO_WINDOW = 28;
// How far into a punch's clip the strike actually connects. The clip's
// first ~60% is wind-up; the contact pose lands after that. A new press
// arriving before this point must NOT restart the clip, or a masher
// pressing faster than the strike point keeps resetting to frame 0 and
// the punch never visibly lands. Expressed in ticks of the stretched
// playback window (see getSpriteDraw) so it tracks the real clip length
// rather than PLAYER_COMBO_WINDOW alone.
const PUNCH_CLIP_TICKS = Math.max(PLAYER_COMBO_WINDOW, SPRITE_CLIP_FRAMES);
const PUNCH_STRIKE_TICK = Math.round(PUNCH_CLIP_TICKS * 0.6);
// A press during the wind-up is remembered rather than dropped, and fires
// the moment the current punch reaches its strike. Mashing therefore
// chains punch -> punch -> kick at the clip's own pace, with every hit
// actually reaching its contact frame.
const PUNCH_BUFFER_FRAMES = PUNCH_CLIP_TICKS;
const PLAYER_SLIDE_DURATION = 28;

// ---- FURY meter / Super Gere transformation ----
// Fills 1% per hit, landed or received, regardless of the attack's weight
// (a light punch and a heavy each give exactly 1). At 100% the player
// transforms immediately: the sprite character swaps to the supergere
// pack for FURY_ACTIVE_FRAMES, then reverts.
const FURY_MAX = 100;
const FURY_GAIN_PER_HIT = 1;
const FURY_ACTIVE_FRAMES = 20 * 60; // 20 seconds at 60fps
// Transformed, every attack hits three times as hard. Applied centrally in
// Player.attackBox so no individual move can miss out on it.
const FURY_DAMAGE_MULTIPLIER = 3;
const PLAYER_FURY_CHARACTER = 'supergere';
// Only this character transforms. Everyone else has no FURY mechanic.
const FURY_CHARACTER = 'gere';
const PLAYER_HEAVY_DURATION = 30;
// The heavy lands twice in one swing. Damage is per strike, so the move's
// total is PLAYER_HEAVY_DAMAGE * PLAYER_HEAVY_HITS -- split from the old
// single 22 so two hits stay in the same weight class rather than
// doubling the move's output outright.
const PLAYER_HEAVY_HITS = 2;
const PLAYER_HEAVY_DAMAGE = 14;
// Ticks between the two strikes, so they read as a swing and a follow
// through rather than both landing on one frame.
const PLAYER_HEAVY_HIT_GAP = 9;
const HIT_STUN_FRAMES = 26;
const GERE_WALK_CYCLE_FRAMES = 140;

// jump_right's frames are uncropped 256x256 tiles with the character's
// rise/fall/land baked into where they sit inside each tile — there's no
// per-frame trim data to drive a separate screen-space arc from, so the
// clip plays like any other move (punch/roll/heavy): it trusts the
// sprite's own authored motion instead of layering invented physics on
// top of it. Unlike punch/roll/heavy, though, movement isn't locked while
// it plays — held direction keys keep moving the player at normal
// walk/run speed so a jump can go forward/back/sideways, not just up.
//
// Reference: SuperGere-jump.mp4 (in gere_sprites/jump_right/) plays the
// full authored motion — quick crouch+launch, a long hang near the peak,
// quick landing, then recovery to standing — over its native 2.333s.
// 108 ticks (~1.8s) keeps that unmistakably-a-jump pacing (long hang, not
// a fast symmetric hop) while trimming a bit off the tail so a jump
// doesn't lock input for the full clip length in fast-paced combat.
const PLAYER_JUMP_DURATION = 108;

// The artwork only lifts the character ~72px off the ground, which reads
// as a hop rather than a jump at this sprite size. Multiplying the trim
// data's `lift` exaggerates the arc without touching the sprite sheets or
// the animation's timing — the same frames, just carried higher.
const PLAYER_JUMP_LIFT_SCALE = 2;

const PlayerColors = {
  suit: Palette.suitBlack,
  accent: Palette.suitGold,
  cape: Palette.capeGold,
  emblem: 'G',
  skin: Palette.skin,
  hair: Palette.hair,
};

// Every character shares the same sprite-folder names (see
// CharacterSpriteSheets in assets.js) and therefore the same action -> clip
// mapping — no per-character table. A character missing a given clip (e.g.
// carla has no combat sprites, boss1 has no jump) just doesn't have that
// sheet loaded into SpriteAnims; Player.hasAction() checks that directly,
// so the move is simply unavailable rather than needing to be listed here.
const PLAYER_ANIM_MAP = {
  idle: { key: 'idle_right', loop: true, cycleFrames: GERE_WALK_CYCLE_FRAMES },
  walk: { key: 'walk_right', loop: true, cycleFrames: GERE_WALK_CYCLE_FRAMES },
  run: { key: 'run_right', loop: true, cycleFrames: 80 },
  jump: { key: 'jump_right', loop: false, holdFrames: PLAYER_JUMP_DURATION },
  punch1: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
  punch2: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
  punch3: { key: 'kick', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
  slide: { key: 'roll', loop: false, holdFrames: PLAYER_SLIDE_DURATION },
  heavy: { key: 'heavy', loop: false, holdFrames: PLAYER_HEAVY_DURATION },
  hurt: { key: 'hurt', loop: false, holdFrames: HIT_STUN_FRAMES },
};

class Player {
  constructor(x, y, spriteCharacter = 'gere') {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.facing = 1;
    this.spriteCharacter = spriteCharacter;
    this.animationMap = PLAYER_ANIM_MAP;
    this.hp = 100;
    this.maxHp = 100;
    this.comboStep = 0;
    this.comboDamage = 0;
    this.moveTimer = 0;
    this.action = 'idle';
    this.walkPhase = 0;
    this.hitStun = 0;
    this.invuln = 0;
    this.attackHit = false; // whether current attack already landed
    // How many times the current swing has connected, and the animTimer
    // tick of the last one. A multi-hit box (the heavy) compares against
    // these to space its strikes; single-hit moves latch after the first.
    this.attackHitCount = 0;
    this.lastHitTick = -999;
    this.animTimer = 0; // frames elapsed in the current action, for sprite-sheet playback
    this.prevAction = 'idle';
    // Punch press remembered while the current punch is still winding up;
    // counts down so a press long past the swing doesn't fire spuriously.
    this.punchBuffer = 0;
    // FURY meter. baseSpriteCharacter remembers who to revert to, since
    // spriteCharacter itself is swapped to supergere while transformed.
    this.baseSpriteCharacter = spriteCharacter;
    this.fury = 0;
    this.furyTimer = 0;
    this.furyActive = false;
    // Set for one frame when the transformation starts/ends, so the HUD can
    // launch its popup without polling for edges itself.
    this.furyEvent = null;
  }

  // Whether this character actually has a loaded sprite sheet for the given
  // combat action (jump/slide/heavy/punch1-3) — the action -> clip mapping
  // is the same for every character (PLAYER_ANIM_MAP), but not every
  // character has every clip on disk (e.g. carla has no combat sprites,
  // boss1 has no jump_right), so this checks SpriteAnims directly rather
  // than just the map, and a missing clip means the move is simply
  // unavailable for that character rather than falling back silently.
  hasAction(action) {
    const entry = this.animationMap && this.animationMap[action];
    if (!entry) return false;
    const anims = SpriteAnims[this.spriteCharacter];
    return !!(anims && anims[entry.key]);
  }

  startJump() {
    if (this.hitStun > 0 || this.moveTimer > 0) return;
    if (!this.hasAction('jump')) return;
    this.action = 'jump';
    this.animTimer = 0;
    this.moveTimer = PLAYER_JUMP_DURATION;
  }

  startHeavy() {
    if (this.hitStun > 0 || this.moveTimer > 0) return;
    if (!this.hasAction('heavy')) return;
    this.action = 'heavy';
    this.animTimer = 0;
    this.moveTimer = PLAYER_HEAVY_DURATION;
    // Clear the once-per-swing latch, exactly as startPunch/startKneeSlide
    // do. Without this the first heavy sets attackHit and nothing ever
    // clears it, so resolvePlayerAttacks() early-returns on every
    // subsequent heavy and the move silently stops connecting.
    this.attackHit = false;
    this.attackHitCount = 0;
    this.lastHitTick = -999;
  }

  // True once the in-progress punch has played far enough to have actually
  // connected — the point past which starting the next punch is safe.
  punchHasStruck() {
    return this.animTimer >= PUNCH_STRIKE_TICK;
  }

  isPunching() {
    return this.action === 'punch1' || this.action === 'punch2' || this.action === 'punch3';
  }

  // Called on a punch press. A press mid-wind-up is buffered instead of
  // restarting the clip: restarting is what made spamming useless, since a
  // masher pressing faster than PUNCH_STRIKE_TICK reset animTimer to 0
  // every time and the swing never reached its contact frame.
  startPunchCombo() {
    if (this.hitStun > 0) return;
    if (!this.hasAction('punch1')) return;
    if (this.moveTimer > 0 && this.action === 'slide') return;
    if (this.isPunching() && !this.punchHasStruck()) {
      this.punchBuffer = PUNCH_BUFFER_FRAMES;
      return;
    }
    this.advancePunchCombo();
  }

  // Commits the next combo step. Only reached once the previous punch has
  // struck (or none was in progress), so every swing plays through contact.
  advancePunchCombo() {
    if (this.moveTimer === 0 && !this.isPunching()) this.comboStep = 0;
    // Wrap back to the first hit after the finisher instead of clamping at
    // 3 — clamping left a masher stuck replaying punch3, since comboStep
    // only reset once moveTimer drained, i.e. only after waiting for idle.
    this.comboStep = (this.comboStep % 3) + 1;
    this.action = ['punch1', 'punch2', 'punch3'][this.comboStep - 1];
    // Re-triggering the same step (punch1 -> punch1 on a fast wrap) keeps
    // this.action unchanged, so update()'s action !== prevAction check
    // never fires; reset animTimer here or the clip freezes mid-swing.
    this.animTimer = 0;
    this.prevAction = this.action;
    this.moveTimer = PLAYER_COMBO_WINDOW;
    this.comboDamage = 8 + this.comboStep * 4;
    this.attackHit = false;
    this.attackHitCount = 0;
    this.lastHitTick = -999;
    this.punchBuffer = 0;
  }

  startKneeSlide() {
    if (this.hitStun > 0) return;
    if (!this.hasAction('slide')) return;
    if (this.moveTimer > 0 && this.action !== 'slide') return;
    // Re-triggering while already sliding keeps the same action string, so
    // update()'s action !== prevAction check never fires — reset animTimer
    // explicitly or the sprite frame stays pinned wherever it was.
    this.action = 'slide';
    this.animTimer = 0;
    this.moveTimer = PLAYER_SLIDE_DURATION;
    this.vx = this.facing * PLAYER_SLIDE_SPEED;
    this.attackHit = false;
    this.attackHitCount = 0;
    this.lastHitTick = -999;
  }

  // Called for every hit this player lands or receives. Weight is
  // deliberately ignored — the meter counts hits, not damage — so a jab
  // and a heavy are worth the same 1%.
  addFury() {
    // Characters without a transformation don't build a meter at all, so
    // no FURY HUD, no popup and no swap ever happens for them.
    if (!this.canFury()) return;
    // While transformed the meter is spent; hits during FURY don't bank
    // toward the next one, otherwise a long transformation would refill
    // itself and chain indefinitely.
    if (this.furyActive) return;
    this.fury = clamp(this.fury + FURY_GAIN_PER_HIT, 0, FURY_MAX);
    if (this.fury >= FURY_MAX) this.startFury();
  }

  canFury() {
    // FURY is Gere's transformation specifically -- he is the one who turns
    // into SuperGere. Any other playable character has no transformation, so
    // the whole mechanic (meter, popup, transform) is simply absent for
    // them rather than borrowing Gere's supergere pack.
    if (this.baseSpriteCharacter !== FURY_CHARACTER) return false;
    const anims = SpriteAnims[PLAYER_FURY_CHARACTER];
    return !!(anims && anims.idle_right);
  }

  startFury() {
    // No supergere art loaded (still fetching, or missing) — keep the meter
    // full and try again on the next hit rather than swapping to a
    // character with no sprites and rendering nothing.
    if (this.furyActive || !this.canFury()) return;
    this.furyActive = true;
    this.furyTimer = FURY_ACTIVE_FRAMES;
    this.fury = FURY_MAX;
    this.spriteCharacter = PLAYER_FURY_CHARACTER;
    // The new pack's clips are different lengths; restart playback so the
    // swap doesn't resume mid-clip at a frame the new sheet doesn't have.
    this.animTimer = 0;
    this.furyEvent = 'start';
  }

  endFury() {
    if (!this.furyActive) return;
    this.furyActive = false;
    this.furyTimer = 0;
    this.fury = 0;
    this.spriteCharacter = this.baseSpriteCharacter;
    this.animTimer = 0;
    this.furyEvent = 'end';
  }

  takeDamage(amount, fromX) {
    if (this.invuln > 0) return;
    this.addFury();
    this.hp = clamp(this.hp - amount, 0, this.maxHp);
    this.hitStun = HIT_STUN_FRAMES;
    this.invuln = 30;
    this.action = 'hurt';

    // Taking a hit DENIES the attack outright. It is not enough to switch
    // the sprite to 'hurt': the swing's own timer and its hit latch have to
    // be torn down too, or an already-started attack keeps its hitbox live
    // and still connects while the character is visibly reeling.
    //
    // Clearing moveTimer ends the move, animTimer restarts playback from
    // frame 0 so the next attack begins from scratch rather than resuming
    // mid-swing, and the combo is dropped so the interrupted chain does not
    // continue from where it left off. This is the core exchange: get hit,
    // lose your turn.
    this.moveTimer = 0;
    this.animTimer = 0;
    this.comboStep = 0;
    this.comboDamage = 0;
    this.attackHit = false;
    this.attackHitCount = 0;
    this.lastHitTick = -999;
    // A press buffered during the swing must not fire a punch out of the
    // hurt animation either.
    this.punchBuffer = 0;
    this.vx = (this.x < fromX ? -1 : 1) * 1.5;
  }

  // bounds: { left, right, top, bottom } — left/right clamp world-space x
  // (either the full level worldWidth or a wave's soft-lock zone), top/bottom
  // clamp y exactly as before. All movement/collision math here stays in
  // world space; only draw() converts to screen space via cameraX.
  update(input, bounds) {
    let dx = 0, dy = 0;

    // Counts down regardless of hitstun/action: the 20 seconds are wall
    // time, not active-play time, so being staggered doesn't extend FURY.
    if (this.furyActive) {
      this.furyTimer--;
      if (this.furyTimer <= 0) this.endFury();
    }

    if (this.hitStun > 0) {
      this.hitStun--;
      this.x += this.vx;
      this.vx *= 0.85;
    } else {
      if (input.pressed.jump) this.startJump();
      if (input.pressed.punch) this.startPunchCombo();
      if (input.pressed.slide) this.startKneeSlide();
      if (input.pressed.heavy) this.startHeavy();

      // Release a buffered press as soon as the current punch has struck,
      // so a mashed input chains into the next hit at the clip's own pace
      // instead of being dropped or restarting the swing early.
      if (this.punchBuffer > 0) {
        if (!this.isPunching()) {
          this.punchBuffer = 0;
        } else if (this.punchHasStruck()) {
          this.advancePunchCombo();
        } else {
          this.punchBuffer--;
        }
      }

      if (this.moveTimer > 0) this.moveTimer--;

      const jumping = this.action === 'jump' && this.moveTimer > 0;
      // A punch in progress owns the sprite until its clip finishes. Without
      // this, holding a direction while attacking overwrote action with
      // walk/run every tick, cancelling the swing before it ever reached
      // its contact frame — so punching on the move never landed at all.
      const punching = this.isPunching() && this.moveTimer > 0;

      if (this.action === 'slide' && this.moveTimer > 0) {
        this.x += this.vx;
      } else {
        if (input.held.left) { dx--; this.facing = -1; }
        if (input.held.right) { dx++; this.facing = 1; }
        if (input.held.up) dy--;
        if (input.held.down) dy++;

        const speed = input.held.run ? PLAYER_RUN_SPEED : PLAYER_MOVE_SPEED;
        this.x += dx * speed;
        // Dodging (up/down within the fight lane) is always fast, independent
        // of Shift/run — a beat-em-up player needs to sidestep attacks reliably.
        this.y += dy * PLAYER_DODGE_SPEED;

        if (jumping || punching) {
          // Keep the jump/punch clip and animTimer running regardless of
          // movement — either can go forward/back/sideways, but it still
          // plays out on its own timer rather than being cut short or
          // extended by input.
        } else if (dx !== 0 || dy !== 0) {
          this.action = input.held.run ? 'run' : 'walk';
          this.walkPhase += 0.35;
        } else if (this.moveTimer === 0) {
          this.action = 'idle';
          this.comboStep = 0;
          this.comboDamage = 0;
        }
      }
    }

    this.x = clamp(this.x, bounds.left, bounds.right);
    this.y = clamp(this.y, bounds.top, bounds.bottom);

    if (this.moveTimer === 0 && this.action === 'slide') {
      this.action = 'idle';
      this.vx = 0;
    }

    if (this.invuln > 0) this.invuln--;

    if (this.action !== this.prevAction) {
      this.animTimer = 0;
      this.prevAction = this.action;
    } else {
      this.animTimer++;
    }
  }

  // Attack boxes are returned in the same top-left {x,y,w,h} form as
  // Enemy.getHitbox() so the two can be compared directly. `reach` is the
  // distance from the player's centre to the far edge of the swing; facing
  // left mirrors the box across the centre rather than just negating x,
  // which would otherwise place the left edge on the wrong side.
  attackBox(reach, w, top, h, damage) {
    const far = this.x + this.facing * reach;
    // FURY multiplies the damage of everything: every attack goes through
    // here, so applying it once covers punch, slide and heavy rather than
    // each move remembering to scale itself.
    const scaled = Math.round(damage * this.attackMultiplier());
    return {
      x: Math.min(far, far - this.facing * w),
      y: this.y + top,
      w,
      h,
      damage: scaled,
    };
  }

  // Damage scaling currently in force. Transformed Gere hits far harder;
  // everyone else is always at 1x.
  attackMultiplier() {
    return this.furyActive ? FURY_DAMAGE_MULTIPLIER : 1;
  }

  getAttackHitbox() {
    if (this.isPunching() && this.moveTimer > 0) {
      return this.attackBox(32, 16, -20, 20, this.comboDamage);
    }
    if (this.action === 'slide' && this.moveTimer > 0) {
      return this.attackBox(26, 20, -6, 12, 10);
    }
    if (this.action === 'heavy' && this.moveTimer > 0) {
      // The heavy is a two-hit move: the swing connects, then follows
      // through for a second strike. `hits` lets resolvePlayerAttacks let
      // the latch open that many times (see PLAYER_HEAVY_HITS).
      const box = this.attackBox(44, 24, -22, 26, PLAYER_HEAVY_DAMAGE);
      box.hits = PLAYER_HEAVY_HITS;
      return box;
    }
    return null;
  }

  getSpriteDraw() {
    const anim = this.animationMap[this.action];
    if (!anim) return null;
    // A non-looping clip spread over fewer ticks than it has frames can't
    // show them all, so it visibly stutters. Stretch the playback window to
    // at least one tick per frame; the action's own timer still governs how
    // long it locks input, this only affects which frame is drawn.
    const holdFrames = anim.loop
      ? anim.cycleFrames
      : Math.max(anim.holdFrames, SPRITE_CLIP_FRAMES);
    const t = anim.loop
      ? (this.animTimer % holdFrames) / holdFrames
      : clamp(this.animTimer / holdFrames, 0, 0.999);
    return getSpriteFrame(this.spriteCharacter, anim.key, t);
  }

  // cameraX: world-space camera offset; screen-space x = this.x - cameraX.
  // Defaults to 0 so callers that don't scroll (none left, but safe) still work.
  draw(ctx, cameraX = 0) {
    const sx = this.x - cameraX;
    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln / 3) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    const spriteFrame = this.getSpriteDraw();
    if (spriteFrame) {
      ctx.save();
      ctx.translate(sx, this.y);
      ctx.scale(this.facing, 1);
      drawSpriteFrame(
        ctx,
        spriteFrame,
        this.action === 'jump' ? PLAYER_JUMP_LIFT_SCALE : 1
      );
      ctx.restore();
    } else {
      drawHumanoid(ctx, sx, this.y, {
        walkPhase: this.walkPhase,
        action: this.action,
        facing: this.facing,
      }, PlayerColors);
    }
    ctx.restore();
  }
}

// Enemy archetypes matching the family cast from the scaffold's level design
const EnemyTypes = {
  // Gym training dummy: a punching sack on a stand. Never moves, never
  // attacks (speed/damage 0, and inert=true skips the whole chase/attack
  // branch), and revives a moment after being knocked down so the arena
  // always has something to hit. Drawn procedurally — no sprite pack — so
  // it needs no art. Used by the free-play arena (js/char-arena.js).
  // ceilingY: where the bag's chain is bolted, in world space. A real gym
  // bag hangs from the roof, so the prop is suspended rather than standing
  // on a base; the whole assembly swings about this anchor.
  sack: {
    ceilingY: 96,
    // The bag is a real sprite pack now: one 'swing' clip that starts at
    // rest, swings when struck and damps back to rest. It is driven by
    // swingTimer rather than the generic action animation, because a hit
    // must RESTART the swing mid-clip (see takeDamage) the way a real
    // boxing sack does, instead of waiting for the current pass to finish.
    spriteCharacter: 'boxingsack',
    spriteAnimMap: {
      idle: { key: 'swing', loop: false, holdFrames: 1 },
    },
    hp: 60, speed: 0, damage: 0, contactRange: 0,
    color: { suit: '#6b4a2a', accent: '#c9963f', skin: '#8a6a3a', hair: '#4a3220' },
    scoreValue: 10,
    inert: true,
    // A gym bag is scenery you practise against, not an enemy: it never
    // runs out of HP, never drops, and never needs reviving. This is
    // preferred over simply giving it a huge HP pool, which would still
    // drain (just slowly) and still eventually die.
    indestructible: true,
    name: 'Training Sack',
  },
  // Bonus-stage car. Unlike the sack this one DOES take damage: it loses a
  // piece per stage until it is a burnt-out wreck, matching the classic
  // bonus round. Which piece goes is decided by WHERE it was hit -- see
  // CAR_ZONES and Enemy.takeDamage -- so smashing the left wing removes the
  // left wing, not simply "the next" piece.
  car: {
    spriteCharacter: 'car',
    spriteAnimMap: {
      idle: { key: 'damage', loop: false, holdFrames: 1 },
    },
    // 50 HP per damage step, so the car works through its whole sequence.
    hp: CAR_HP_PER_PIECE * CAR_DAMAGE_STEPS,
    speed: 0, damage: 0, contactRange: 0,
    color: { suit: '#4a8a5c', accent: '#c4c8ce', skin: '#8a6a3a', hair: '#4a3220' },
    scoreValue: 500,
    inert: true,
    destructible: true,
    name: 'Bonus Car',
  },
  minion: {
    hp: 25, speed: 0.7, damage: 6, contactRange: 14, color: { suit: '#38424f', accent: '#7d92a8', skin: Palette.skin, hair: '#333' },
    scoreValue: 100,
    spriteCharacter: 'minion',
    // No sheet has an explicit hurt clip — hurt is conveyed purely via the
    // existing flashTimer brightness flash rather than a dedicated clip.
    spriteAnimMap: {
      idle: { key: 'idle_right', loop: false, holdFrames: 1 },
      walk: { key: 'walk_right', loop: true, cycleFrames: 24 },
      hurt: { key: 'idle_right', loop: false, holdFrames: 1 },
    },
  },
  boss1: {
    hp: 250, speed: 0.55, damage: 16, contactRange: 20, color: { suit: '#0f5f2e', accent: '#ffffff', skin: Palette.skin, hair: '#1a1a1a' },
    scoreValue: 2000, boss: true, name: 'The Hooded Villain',
    spriteCharacter: 'boss1',
    spriteAnimMap: {
      idle: { key: 'idle_right', loop: false, holdFrames: 1 },
      walk: { key: 'walk_right', loop: true, cycleFrames: 24 },
      hurt: { key: 'idle_right', loop: false, holdFrames: 1 },
      // 'ko' (this.dead) plays the fall/collapse clip once and holds the
      // last frame, matching how deathTimer already gates the KO duration.
      ko: { key: 'fall', loop: false, holdFrames: 60 },
    },
  },
};

class Enemy {
  constructor(typeKey, x, y) {
    const t = EnemyTypes[typeKey];
    this.type = typeKey;
    this.def = t;
    this.x = x;
    this.y = y;
    this.facing = -1;
    this.hp = t.hp;
    this.maxHp = t.hp;
    this.action = 'idle';
    this.walkPhase = Math.random() * 10;
    this.hitStun = 0;
    this.attackCooldown = 60 + Math.random() * 60;
    this.dead = false;
    this.deathTimer = 0;
    this.flashTimer = 0;
    this.animTimer = 0; // frames elapsed in the current action, for sprite-sheet playback
    this.prevAction = 'idle';
    // Punching-sack swing, in radians, with its angular velocity. Only the
    // inert sack prop uses these; a hit kicks sway and it damps back down.
    this.sway = 0;
    this.swayVel = 0;
    // How an inert prop is mounted ('hanging' | 'standing'). Set by the
    // arena from the active stage; indoors it hangs, outdoors it stands.
    this.mount = 'hanging';
    // Swing-clip playback for the sprite-backed bag. -1 means "at rest":
    // the clip's first frame is held and nothing animates until a hit.
    this.swingTimer = -1;
    // Destructible props (the bonus car) track which pieces have been shorn
    // off. Order matters: the sheet draws a strict progression, so the frame
    // shown is derived from how many are gone (see carFrame()).
    // Where the most recent blow landed, for impact placement.
    this.lastHitZone = null;
    // Live debris bursts. Cosmetic only; retired once their frames expire.
    this.bursts = [];
  }

  // bounds: same world-space {left, right, top, bottom} contract as Player.update.
  update(player, bounds) {
    // Pendulum: spring back toward upright, with damping so it settles.
    if (this.bursts.length) {
      for (const burst of this.bursts) burst.update();
      this.bursts = this.bursts.filter((burst) => burst.active);
    }
    if (this.def.inert) {
      // Sprite-backed bag: play the swing clip out once per hit, then rest.
      if (this.swingTimer >= 0) {
        this.swingTimer++;
        if (this.swingTimer >= SACK_SWING_FRAMES) this.swingTimer = -1;
      }
      // The procedural fallback (no sprite pack loaded) keeps the spring.
      this.swayVel += -this.sway * 0.02;
      this.swayVel *= 0.94;
      this.sway += this.swayVel;
    }

    if (this.dead) {
      this.deathTimer++;
      // Training dummies get back up so the arena always has a target.
      if (this.def.respawnFrames && this.deathTimer >= this.def.respawnFrames) {
        this.revive();
        return;
      }
      if (this.action !== this.prevAction) {
        this.animTimer = 0;
        this.prevAction = this.action;
      } else {
        this.animTimer++;
      }
      return;
    }

    if (this.flashTimer > 0) this.flashTimer--;

    if (this.hitStun > 0) {
      this.hitStun--;
      this.action = 'hurt';
      this.tickAnimTimer();
      return;
    }

    // Inert props (the training sack) never chase or attack — they just
    // stand there and absorb hits.
    if (this.def.inert) {
      this.action = 'idle';
      this.facing = player.x < this.x ? -1 : 1;
      this.tickAnimTimer();
      return;
    }


    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    this.facing = dx < 0 ? -1 : 1;

    if (dist > this.def.contactRange) {
      const speed = this.def.speed;
      this.x += (dx / dist) * speed;
      this.y += (dy / dist) * speed;
      this.action = 'walk';
      this.walkPhase += 0.28;
    } else {
      this.action = 'idle';
      this.attackCooldown--;
      if (this.attackCooldown <= 0) {
        this.attackCooldown = 70 + Math.random() * 50;
        if (dist <= this.def.contactRange + 4) {
          player.takeDamage(this.def.damage, this.x);
        }
      }
    }

    this.x = clamp(this.x, bounds.left, bounds.right);
    this.y = clamp(this.y, bounds.top, bounds.bottom);
    this.tickAnimTimer();
  }

  tickAnimTimer() {
    if (this.action !== this.prevAction) {
      this.animTimer = 0;
      this.prevAction = this.action;
    } else {
      this.animTimer++;
    }
  }

  // Mirrors Player.getSpriteDraw()'s pattern, but per-enemy-type since each
  // EnemyTypes entry owns its own spriteCharacter/spriteAnimMap (only some
  // types have sheets — others return null and the caller falls back to
  // drawHumanoid).
  getSpriteDraw() {
    if (!this.def.spriteCharacter || !this.def.spriteAnimMap) return null;
    const anim = this.def.spriteAnimMap[this.action];
    if (!anim) return null;
    const holdFrames = anim.loop ? anim.cycleFrames : anim.holdFrames;
    const t = anim.loop
      ? (this.animTimer % holdFrames) / holdFrames
      : clamp(this.animTimer / holdFrames, 0, 0.999);
    return getSpriteFrame(this.def.spriteCharacter, anim.key, t);
  }

  takeDamage(amount, fromX = null) {
    if (this.dead) return;
    this.hp -= amount;
    // The sack absorbs hits without flinching into a hurt clip; it swings
    // away from the blow instead, scaled by how hard the hit was.
    if (this.def.inert) {
      const dir = fromX === null ? 1 : (fromX <= this.x ? 1 : -1);
      this.swayVel += dir * Math.min(0.22, 0.03 + amount * 0.006);
      // Restart the swing from the top, even mid-swing: spamming punches
      // keeps kicking the bag rather than waiting for it to settle.
      this.swingTimer = 0;
      this.flashTimer = 6;
      // An indestructible prop takes the hit's reaction but keeps its HP,
      // so it can be worked on indefinitely.
      if (this.def.indestructible) {
        this.hp = this.maxHp;
        return;
      }
      // A destructible prop (the bonus car) works through its damage
      // sequence as its HP drains; carFrame() derives the sprite from that,
      // so nothing needs tracking here beyond where the blow landed.
      if (this.def.destructible) {
        this.lastHitZone = this.zoneForHit(fromX);
        // Throw debris from the point of contact. Glass and chips on an
        // ordinary hit; the killing blow adds sparks and heavier debris.
        const box = this.getHitbox();
        const hx = fromX === null ? this.x : clamp(fromX, box.x, box.x + box.w);
        const hy = box.y + box.h * 0.45;
        const kinds = this.hp - amount <= 0
          ? ['glass', 'debris', 'chips', 'spark']
          : ['glass', 'chips'];
        this.bursts.push(new DebrisBurst(hx, hy, kinds));
        if (this.hp <= 0) {
          this.hp = 0;
          this.dead = true;
          this.deathTimer = 0;
        }
        return;
      }
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        this.action = 'ko';
        this.deathTimer = 0;
      }
      return;
    }
    this.hitStun = 12;
    this.flashTimer = 6;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.action = 'ko';
      this.deathTimer = 0;
    }
  }

  revive() {
    this.dead = false;
    this.deathTimer = 0;
    this.hp = this.maxHp;
    this.hitStun = 0;
    this.flashTimer = 0;
    this.action = 'idle';
    this.animTimer = 0;
    this.prevAction = 'idle';
  }

  // Which sheet frame the car should show, from how much damage it has
  // taken. The art is one progressive sequence (pristine -> wreck), so the
  // frame is simply how far through its HP it is rather than a set of
  // independently removable pieces.
  carFrame() {
    if (this.dead) return CAR_FRAME_WRECK;
    const lost = 1 - clamp(this.hp / this.maxHp, 0, 1);
    const step = Math.floor(lost * CAR_DAMAGE_STEPS);
    return clamp(step, CAR_FRAME_HEALTHY, CAR_DAMAGE_STEPS - 1);
  }

  // Which zone along the car a blow landed in. Used to place impact debris
  // at the point of contact; the bodywork itself degrades in sequence.
  zoneForHit(fromX) {
    const box = this.getHitbox();
    const t = fromX === null ? 0.5 : clamp((fromX - box.x) / box.w, 0, 0.999);
    return CAR_ZONES[Math.floor(t * CAR_ZONES.length)];
  }

  getHitbox() {
    if (this.def.destructible) {
      // Box the frame currently on screen, not frame 0. The car loses a lot
      // of height as it crumples -- the wreck is roughly half the pristine
      // car -- so a fixed box would float well above the flattened bodywork
      // and let punches connect with empty air.
      const idx = this.carFrame();
      const frame = getSpriteFrame(
        this.def.spriteCharacter, 'damage', idx / CAR_FRAME_COUNT,
      );
      if (frame) {
        return {
          x: this.x - frame.sw / 2,
          y: this.y - frame.sh,
          w: frame.sw,
          h: frame.sh,
        };
      }
    }
    // The hanging bag's hurtbox has to track where it is actually drawn:
    // suspended, clearing the floor by SACK_GROUND_CLEARANCE. It is also
    // padded outward, because a training bag you have to stand pixel-exact
    // to connect with makes the gym annoying rather than useful.
    if (this.def.inert) {
      // Sprite-backed bag: box the drawn frame. The art hangs feet-down
      // from its own mount, so the frame's own height is the bag+hardware;
      // only the lower part is the bag you can actually punch.
      const frame = getSpriteFrame('boxingsack', 'swing', 0);
      if (frame) {
        const bagH = frame.sh * SACK_BAG_FRACTION;
        // Must track the same lift the sprite is drawn with, or the box
        // sits 20px below the bag you can see.
        const lift = this.mount === 'standing' ? 0 : SACK_HANG_LIFT;
        return {
          x: this.x - frame.sw / 2 - SACK_HIT_PADDING,
          y: this.y - lift - bagH - SACK_HIT_PADDING,
          w: frame.sw + SACK_HIT_PADDING * 2,
          h: bagH + SACK_HIT_PADDING * 2,
        };
      }
      const s = SACK_SCALE;
      const bagH = 30 * s;
      const bottom = this.y - SACK_GROUND_CLEARANCE;
      const halfW = 9 * s + SACK_HIT_PADDING;
      return {
        x: this.x - halfW,
        y: bottom - bagH - SACK_HIT_PADDING,
        w: halfW * 2,
        h: bagH + SACK_HIT_PADDING * 2,
      };
    }
    return { x: this.x - 8, y: this.y - 30, w: 16, h: 30 };
  }

  draw(ctx, cameraX = 0) {
    // Death visuals (e.g. boss1's fall clip) hold for up to koAnim.holdFrames;
    // types without a 'ko' clip keep the previous fixed 60-frame window.
    const koAnim = this.def.spriteAnimMap && this.def.spriteAnimMap.ko;
    const deathHoldFrames = koAnim ? koAnim.holdFrames : 60;
    // A reviving prop stays visible for its whole down time — otherwise the
    // sack would blink out at 60 frames and pop back in at respawnFrames.
    if (!this.def.respawnFrames && !this.def.indestructible
        && this.dead && this.deathTimer > deathHoldFrames) return;
    const sx = this.x - cameraX;
    ctx.save();
    if (this.flashTimer > 0) {
      ctx.filter = 'brightness(2)';
    }
    if (this.def.inert) {
      // A knocked-down prop sags toward the ground until it pops back up.
      // Only a floor-standing one can: a bag on a chain is suspended, and
      // sagging it would also slide the sprite away from the chain drawn
      // above it, visibly detaching the two.
      const canSag = this.mount === 'standing';
      const sag = canSag && this.dead ? Math.min(1, this.deathTimer / 20) : 0;
      ctx.translate(0, sag * 6);
      // Destructible prop: the frame is its damage state, not a clip time.
      if (this.def.destructible) {
        const idx = this.carFrame();
        const frame = getSpriteFrame(
          this.def.spriteCharacter, 'damage', idx / CAR_FRAME_COUNT,
        );
        if (frame) {
          ctx.save();
          ctx.translate(sx, this.y);
          drawSpriteFrame(ctx, frame);
          ctx.restore();
          // Debris draws over the car, in world space, so it is unaffected
          // by the brightness flash applied to the body.
          ctx.filter = 'none';
          for (const burst of this.bursts) burst.draw(ctx, cameraX);
          ctx.restore();
          return;
        }
      }
      // Sprite-backed bag: hold frame 0 at rest, otherwise play the swing.
      // The art already includes its own mount hardware, so no chain or
      // base is drawn under it.
      const t = this.swingTimer < 0 ? 0 : this.swingTimer / SACK_SWING_FRAMES;
      const frame = getSpriteFrame('boxingsack', 'swing', t);
      if (frame) {
        // The art carries its own shackle but not the full drop to the
        // roof, so the chain is extended from the sprite's top edge up to
        // the stage's ceiling anchor.
        // A hanging bag is raised clear of the floor; a standing one keeps
        // its base planted on it.
        const lift = this.mount === 'standing' ? 0 : SACK_HANG_LIFT;
        if (this.mount !== 'standing') {
          drawSackChain(ctx, sx, this.y - lift - frame.sh, this.def.ceilingY || 0);
        }
        ctx.translate(sx, this.y - lift);
        drawSpriteFrame(ctx, frame);
        ctx.restore();
        return;
      }
      // No procedural stand-in: assets are awaited before the loop starts
      // (see the loading screen in char-arena.js), so a missing frame here
      // means the art genuinely failed to load rather than being in flight.
      // Drawing an older placeholder in its place only ever looked like a
      // bug, so nothing is drawn at all.
      ctx.restore();
      return;
    }
    const spriteFrame = this.getSpriteDraw();
    if (spriteFrame) {
      drawGroundShadow(ctx, sx, this.y, spriteFrame.sw);
      ctx.save();
      ctx.translate(sx, this.y);
      ctx.scale(this.facing, 1);
      drawSpriteFrame(ctx, spriteFrame);
      ctx.restore();
    } else {
      drawHumanoid(ctx, sx, this.y, {
        walkPhase: this.walkPhase,
        action: this.action,
        facing: this.facing,
      }, this.def.color);
    }
    ctx.restore();

    if (!this.dead) {
      // small hp bar for bosses
      if (this.def.boss) {
        const w = 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx - w / 2, this.y - 52, w, 4);
        ctx.fillStyle = '#e84c4c';
        ctx.fillRect(sx - w / 2, this.y - 52, w * (this.hp / this.maxHp), 4);
      }
    }
  }
}

// Axis-aligned overlap between an attack box and an enemy's hurtbox.
function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Resolves the player's active attack against a list of enemies, once per
// swing: `attackHit` latches so a single punch can't tick damage on every
// frame it overlaps. Returns the number of enemies struck.
//
// This is also where the player's FURY meter is fed for hits *landed*
// (hits received are handled in Player.takeDamage), so both halves of
// "1% per hit, landed or received" go through the same 1-per-event path
// regardless of the attack's damage.
function resolvePlayerAttacks(player, enemies) {
  const box = player.getAttackHitbox();
  if (!box) return 0;
  // How many times this swing may land. Most attacks are single-hit and
  // latch after the first; a box can opt into more (the heavy's swing +
  // follow-through) via `hits`.
  const maxHits = box.hits || 1;
  if (player.attackHitCount >= maxHits) return 0;
  // Multi-hit moves space their strikes out, so the second reads as a
  // follow-through instead of landing on the same frame as the first.
  if (player.attackHitCount > 0
      && player.animTimer - player.lastHitTick < PLAYER_HEAVY_HIT_GAP) {
    return 0;
  }
  // Punches only count once they've actually reached their contact frame,
  // so the hitbox matches what's on screen instead of connecting during
  // the wind-up.
  if (player.isPunching() && !player.punchHasStruck()) return 0;

  let hits = 0;
  for (const enemy of enemies) {
    if (enemy.dead) continue;
    if (!boxesOverlap(box, enemy.getHitbox())) continue;
    enemy.takeDamage(box.damage, player.x);
    hits++;
  }
  if (hits > 0) {
    player.attackHitCount++;
    player.lastHitTick = player.animTimer;
    // Kept in sync so anything still reading the old boolean (and the
    // reset in startPunch/startKneeSlide/startHeavy) keeps working.
    player.attackHit = player.attackHitCount >= maxHits;
    player.addFury();
  }
  return hits;
}

// Impact debris thrown off the car when it is struck. Purely cosmetic: it
// never affects collision, and a burst that outlives its frames simply
// stops being drawn.
class DebrisBurst {
  constructor(x, y, kinds) {
    this.parts = [];
    for (let i = 0; i < CAR_FX_PER_HIT; i++) {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const pool = CAR_FX[kind];
      this.parts.push({
        x,
        y,
        // Thrown up and outward from the point of contact.
        vx: (Math.random() - 0.5) * 6.4,
        vy: -2.2 - Math.random() * 4.4,
        spin: (Math.random() - 0.5) * 0.5,
        rot: Math.random() * Math.PI * 2,
        frame: pool[Math.floor(Math.random() * pool.length)],
        life: CAR_FX_LIFE * (0.6 + Math.random() * 0.5),
        age: 0,
      });
    }
  }

  get active() {
    return this.parts.some((p) => p.age < p.life);
  }

  update() {
    for (const p of this.parts) {
      if (p.age >= p.life) continue;
      p.age++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += CAR_FX_GRAVITY;
      p.vx *= 0.98;
      p.rot += p.spin;
    }
  }

  draw(ctx, cameraX = 0) {
    for (const p of this.parts) {
      if (p.age >= p.life) continue;
      const frame = getSpriteFrame('car', 'fx', p.frame / CAR_FX_COUNT);
      if (!frame) continue;
      // Fade out over the last third of the particle's life.
      const t = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = t > 0.66 ? 1 - (t - 0.66) / 0.34 : 1;
      ctx.translate(p.x - cameraX, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(
        frame.image, frame.sx, frame.sy, frame.sw, frame.sh,
        -frame.sw / 2, -frame.sh / 2, frame.sw, frame.sh,
      );
      ctx.restore();
    }
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
