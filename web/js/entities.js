// Entity logic: player, enemies, assists. Ported/expanded from the PSn00bSDK C scaffold.

// Distance covered per tick while walking/running. Previously 0.3/0.65 —
// too slow to match the walk animation's stride cadence, so the character
// looked like it was shuffling/sliding in place rather than covering ground.
const PLAYER_MOVE_SPEED = 1.1;
const PLAYER_RUN_SPEED = 2.2;
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
const PLAYER_SLIDE_DURATION = 28;
const PLAYER_HEAVY_DURATION = 30;
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

const PREVIEW_ANIM_MAP = {
  idle: { key: 'idle_right', loop: false, holdFrames: 1 },
  walk: { key: 'walk_right', loop: true, cycleFrames: 80 },
  run: { key: 'run_right', loop: true, cycleFrames: 80 },
};

class Player {
  constructor(x, y, spriteCharacter = 'gere', movementOnly = false) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.facing = 1;
    this.spriteCharacter = spriteCharacter;
    this.animationMap = movementOnly ? PREVIEW_ANIM_MAP : PLAYER_ANIM_MAP;
    this.movementOnly = movementOnly;
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
    this.slingShot = false;
    this.animTimer = 0; // frames elapsed in the current action, for sprite-sheet playback
    this.prevAction = 'idle';
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
    this.moveTimer = PLAYER_HEAVY_DURATION;
    this.slingShot = true;
  }

  startPunchCombo() {
    if (this.hitStun > 0) return;
    if (!this.hasAction('punch1')) return;
    if (this.moveTimer > 0 && this.action === 'slide') return;
    if (this.moveTimer === 0) this.comboStep = 0;
    // Wrap back to the first hit after the finisher instead of clamping at
    // 3 — clamping left a masher stuck replaying punch3, since comboStep
    // only reset once moveTimer drained, i.e. only after waiting for idle.
    this.comboStep = (this.comboStep % 3) + 1;
    this.action = ['punch1', 'punch2', 'punch3'][this.comboStep - 1];
    // Re-triggering the same step (punch1 -> punch1 on a fast wrap) keeps
    // this.action unchanged, so update()'s action !== prevAction check
    // never fires; reset animTimer here or the clip freezes mid-swing.
    this.animTimer = 0;
    this.moveTimer = PLAYER_COMBO_WINDOW;
    this.comboDamage = 8 + this.comboStep * 4;
    this.attackHit = false;
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
  }

  takeDamage(amount, fromX) {
    if (this.invuln > 0) return;
    this.hp = clamp(this.hp - amount, 0, this.maxHp);
    this.hitStun = HIT_STUN_FRAMES;
    this.invuln = 30;
    this.action = 'hurt';
    this.vx = (this.x < fromX ? -1 : 1) * 1.5;
  }

  heal(amount) {
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }

  // bounds: { left, right, top, bottom } — left/right clamp world-space x
  // (either the full level worldWidth or a wave's soft-lock zone), top/bottom
  // clamp y exactly as before. All movement/collision math here stays in
  // world space; only draw() converts to screen space via cameraX.
  update(input, bounds) {
    let dx = 0, dy = 0;

    if (this.movementOnly) {
      if (input.held.left) { dx--; this.facing = -1; }
      if (input.held.right) { dx++; this.facing = 1; }
      if (input.held.up) dy--;
      if (input.held.down) dy++;
      const speed = input.held.run ? PLAYER_RUN_SPEED : PLAYER_MOVE_SPEED;
      this.x = clamp(this.x + dx * speed, bounds.left, bounds.right);
      this.y = clamp(this.y + dy * speed, bounds.top, bounds.bottom);
      this.action = dx !== 0 || dy !== 0 ? (input.held.run ? 'run' : 'walk') : 'idle';
      if (this.action !== this.prevAction) {
        this.animTimer = 0;
        this.prevAction = this.action;
      } else {
        this.animTimer++;
      }
      return;
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

      if (this.moveTimer > 0) this.moveTimer--;

      const jumping = this.action === 'jump' && this.moveTimer > 0;

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

        if (jumping) {
          // Keep the jump clip/animTimer running regardless of movement —
          // a jump can go forward/back/sideways, but it still plays out on
          // its own timer rather than being cut short or extended by input.
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

  getAttackHitbox() {
    if (this.action === 'punch1' || this.action === 'punch2' || this.action === 'punch3') {
      return { x: this.x + this.facing * 16, y: this.y - 20, w: 16, h: 20, damage: this.comboDamage };
    }
    if (this.action === 'slide' && this.moveTimer > 0) {
      return { x: this.x + this.facing * 6, y: this.y - 6, w: 20, h: 12, damage: 10 };
    }
    if (this.action === 'heavy' && this.moveTimer > 0) {
      return { x: this.x + this.facing * 20, y: this.y - 22, w: 24, h: 26, damage: 22 };
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
  minion: {
    hp: 30, speed: 0.7, damage: 6, contactRange: 14, color: { suit: '#38424f', accent: '#7d92a8', skin: Palette.skin, hair: '#333' },
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
    hp: 220, speed: 0.55, damage: 16, contactRange: 20, color: { suit: '#0f5f2e', accent: '#ffffff', skin: Palette.skin, hair: '#1a1a1a' },
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
  grandpa_gastone: {
    hp: 110, speed: 0.45, damage: 14, contactRange: 18, color: { suit: '#4a4034', accent: '#c99a4a', skin: Palette.skinShade, hair: '#d8d8d8' },
    scoreValue: 700, boss: true, name: 'Grandpa Gastone',
  },
  uncle_mattia: {
    hp: 130, speed: 0.6, damage: 12, contactRange: 16, color: { suit: '#1e3a5f', accent: '#5cc9ff', skin: Palette.skin, hair: '#222' },
    scoreValue: 900, boss: true, name: 'Uncle Mattia',
  },
  uncle_michele: {
    hp: 150, speed: 0.65, damage: 13, contactRange: 16, color: { suit: '#3a2a1e', accent: '#ff9d4d', skin: Palette.skin, hair: '#1a1a1a' },
    scoreValue: 1000, boss: true, name: 'Uncle Michele',
  },
  boss_luigi: {
    hp: 220, speed: 0.55, damage: 16, contactRange: 20, color: { suit: '#0f5f2e', accent: '#ffffff', skin: Palette.skin, hair: '#1a1a1a' },
    scoreValue: 2000, boss: true, name: 'Boss Luigi',
  },
  mario: {
    hp: 140, speed: 0.6, damage: 12, contactRange: 16, color: { suit: '#8a1c1c', accent: '#3355ff', skin: Palette.skin, hair: '#1a1a1a' },
    scoreValue: 1200, boss: true, name: 'Mario',
  },
  wario: {
    hp: 160, speed: 0.5, damage: 14, contactRange: 18, color: { suit: '#7a5c1e', accent: '#4a2a8a', skin: Palette.skin, hair: '#1a1a1a' },
    scoreValue: 1200, boss: true, name: 'Wario',
  },
  bowser: {
    hp: 260, speed: 0.4, damage: 18, contactRange: 22, color: { suit: '#1e6b1e', accent: '#ffd54d', skin: '#d9a86b', hair: '#8a1c1c' },
    scoreValue: 2500, boss: true, name: 'Bowser',
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
  }

  // bounds: same world-space {left, right, top, bottom} contract as Player.update.
  update(player, bounds) {
    if (this.dead) {
      this.deathTimer++;
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

  takeDamage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitStun = 12;
    this.flashTimer = 6;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.action = 'ko';
      this.deathTimer = 0;
    }
  }

  getHitbox() {
    return { x: this.x - 8, y: this.y - 30, w: 16, h: 30 };
  }

  draw(ctx, cameraX = 0) {
    // Death visuals (e.g. boss1's fall clip) hold for up to koAnim.holdFrames;
    // types without a 'ko' clip keep the previous fixed 60-frame window.
    const koAnim = this.def.spriteAnimMap && this.def.spriteAnimMap.ko;
    const deathHoldFrames = koAnim ? koAnim.holdFrames : 60;
    if (this.dead && this.deathTimer > deathHoldFrames) return;
    const sx = this.x - cameraX;
    ctx.save();
    if (this.flashTimer > 0) {
      ctx.filter = 'brightness(2)';
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

// Assist characters: Uncle Mattia (heal + laser) and Uncle Michele (ground pound rush)
const ASSIST_MATTIA_DURATION = 20 * 60;
const ASSIST_MICHELE_DURATION = 8 * 60;
const ASSIST_COOLDOWN_FRAMES = 15 * 60;

class AssistSystem {
  constructor() {
    this.active = null;
    this.activeTimer = 0;
    this.cooldownMattia = 0;
    this.cooldownMichele = 0;
  }

  canActivate(type) {
    if (this.active) return false;
    if (type === 'mattia') return this.cooldownMattia === 0;
    if (type === 'michele') return this.cooldownMichele === 0;
    return false;
  }

  activate(type) {
    if (!this.canActivate(type)) return false;
    this.active = type;
    this.activeTimer = type === 'mattia' ? ASSIST_MATTIA_DURATION : ASSIST_MICHELE_DURATION;
    return true;
  }

  update(player, enemies) {
    if (this.cooldownMattia > 0) this.cooldownMattia--;
    if (this.cooldownMichele > 0) this.cooldownMichele--;
    if (!this.active) return;

    if (this.active === 'mattia') {
      if (this.activeTimer % 60 === 0) player.heal(2);
      if (this.activeTimer % 20 === 0) {
        const assistX = player.x + player.facing * 30;
        for (const e of enemies) {
          if (!e.dead && Math.abs(e.x - assistX) < 40 && Math.abs(e.y - player.y) < 30) {
            e.takeDamage(4);
          }
        }
      }
    } else if (this.active === 'michele') {
      if (this.activeTimer % 15 === 0) {
        const assistX = player.x + player.facing * 24;
        for (const e of enemies) {
          if (!e.dead && Math.abs(e.x - assistX) < 30 && Math.abs(e.y - player.y) < 30) {
            e.takeDamage(6);
          }
        }
      }
    }

    this.activeTimer--;
    if (this.activeTimer <= 0) {
      if (this.active === 'mattia') this.cooldownMattia = ASSIST_COOLDOWN_FRAMES;
      if (this.active === 'michele') this.cooldownMichele = ASSIST_COOLDOWN_FRAMES;
      this.active = null;
    }
  }

  draw(ctx, player, cameraX = 0) {
    if (!this.active) return;
    const assistX = player.x + player.facing * 30 - cameraX;
    const colors = this.active === 'mattia'
      ? { suit: '#1e3a5f', accent: '#5cc9ff', skin: Palette.skin, hair: '#222' }
      : { suit: '#3a2a1e', accent: '#ff9d4d', skin: Palette.skin, hair: '#1a1a1a' };
    drawHumanoid(ctx, assistX, player.y - 4, {
      walkPhase: Date.now() / 100,
      action: 'walk',
      facing: player.facing,
    }, colors);
  }
}

// Rescued family-member NPCs shown at the end of a level once its boss wave
// is cleared. Not an Enemy: no hp, no combat, can't be attacked. typeKey
// indexes into NpcTypes (parallel to EnemyTypes) so future levels can add
// grandpa/uncles/etc. by adding a table entry + a LevelDefs[i].npc field,
// without touching this class.
const NpcTypes = {
  grandma_carla: {
    name: 'Grandma Carla',
    spriteCharacter: 'carla',
    color: { suit: '#7a3b56', accent: '#e8c1d6', skin: Palette.skinShade, hair: '#cfcfcf', emblem: null },
    waveAnim: { key: 'wave', loop: true, cycleFrames: 40 },
    victoryAnim: { key: 'victory', loop: true, cycleFrames: 40 },
    rescueText: 'Grandma Carla is safe!',
    rescueScore: 500,
  },
};

class NPC {
  constructor(typeKey, x, y) {
    this.type = typeKey;
    this.def = NpcTypes[typeKey];
    this.x = x;
    this.y = y;
    this.facing = -1;
    this.rescued = false;
    this.animTimer = 0;
    this.prevAction = 'wave';
  }

  get action() {
    return this.rescued ? 'victory' : 'wave';
  }

  // Called once level.complete flips true and the player has walked close
  // enough — flips rescued state and returns true the single frame it does
  // so callers can push a floatText/score bump exactly once.
  rescue() {
    if (this.rescued) return false;
    this.rescued = true;
    return true;
  }

  update() {
    if (this.action !== this.prevAction) {
      this.animTimer = 0;
      this.prevAction = this.action;
    } else {
      this.animTimer++;
    }
  }

  getSpriteDraw() {
    const anim = this.rescued ? this.def.victoryAnim : this.def.waveAnim;
    if (!anim) return null;
    const holdFrames = anim.loop ? anim.cycleFrames : anim.holdFrames;
    const t = anim.loop
      ? (this.animTimer % holdFrames) / holdFrames
      : clamp(this.animTimer / holdFrames, 0, 0.999);
    return getSpriteFrame(this.def.spriteCharacter, anim.key, t);
  }

  draw(ctx, cameraX = 0) {
    const sx = this.x - cameraX;
    ctx.save();
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
        walkPhase: this.animTimer * 0.1,
        action: 'idle',
        facing: this.facing,
      }, this.def.color);
    }
    ctx.restore();
  }
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
