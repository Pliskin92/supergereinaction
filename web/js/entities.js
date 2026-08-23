// Entity logic: player, enemies, assists. Ported/expanded from the PSn00bSDK C scaffold.

const PLAYER_MOVE_SPEED = 0.3;
const PLAYER_RUN_SPEED = 0.65;
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
const PLAYER_SLIDE_SPEED = 4.2;
const PLAYER_COMBO_WINDOW = 22;
const PLAYER_SLIDE_DURATION = 26;
const PLAYER_HEAVY_DURATION = 28;
const HIT_STUN_FRAMES = 14;
const GERE_WALK_CYCLE_FRAMES = 140;

const PLAYER_JUMP_SPEED = 3.6;
const PLAYER_GRAVITY = 0.18;
const PLAYER_JUMP_DURATION = 42;

const PlayerColors = {
  suit: Palette.suitBlack,
  accent: Palette.suitGold,
  cape: Palette.capeGold,
  emblem: 'G',
  skin: Palette.skin,
  hair: Palette.hair,
};

// Each playable character has its own sprite-sheet coverage (see
// CharacterSpriteSheets in assets.js), so the combat action -> clip mapping
// is data-driven per spriteCharacter. An action key that's absent for a
// character (e.g. no 'roll' clip) simply can't be triggered for them —
// see Player.hasAction().
const PLAYER_ANIM_MAPS = {
  gere: {
    idle: { key: 'idle', loop: true, cycleFrames: 80 },
    walk: { key: 'walk', loop: true, cycleFrames: GERE_WALK_CYCLE_FRAMES },
    run: { key: 'run', loop: true, cycleFrames: 80 },
    jump: { key: 'jump', loop: false, holdFrames: PLAYER_JUMP_DURATION },
    punch1: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch2: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch3: { key: 'kick', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    slide: { key: 'roll', loop: false, holdFrames: PLAYER_SLIDE_DURATION },
    heavy: { key: 'shoot', loop: false, holdFrames: PLAYER_HEAVY_DURATION },
    hurt: { key: 'hurt', loop: false, holdFrames: HIT_STUN_FRAMES },
  },
  giox: {
    idle: { key: 'idle', loop: true, cycleFrames: 80 },
    walk: { key: 'walk', loop: true, cycleFrames: 80 },
    run: { key: 'run', loop: true, cycleFrames: 80 },
    jump: { key: 'jump', loop: false, holdFrames: PLAYER_JUMP_DURATION },
    punch1: { key: 'kick', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch2: { key: 'kick', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch3: { key: 'kick', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    heavy: { key: 'shockwave', loop: false, holdFrames: PLAYER_HEAVY_DURATION },
    hurt: { key: 'hurt', loop: false, holdFrames: HIT_STUN_FRAMES },
  },
  minion: {
    idle: { key: 'idle', loop: true, cycleFrames: 80 },
    walk: { key: 'walk', loop: true, cycleFrames: 80 },
    run: { key: 'run', loop: true, cycleFrames: 80 },
    jump: { key: 'jump', loop: false, holdFrames: PLAYER_JUMP_DURATION },
    punch1: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch2: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch3: { key: 'kick', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    heavy: { key: 'shoot', loop: false, holdFrames: PLAYER_HEAVY_DURATION },
  },
  boss1: {
    idle: { key: 'idle', loop: true, cycleFrames: 80 },
    walk: { key: 'walk', loop: true, cycleFrames: 80 },
    run: { key: 'run', loop: true, cycleFrames: 80 },
    punch1: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch2: { key: 'punch', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    punch3: { key: 'kick', loop: false, holdFrames: PLAYER_COMBO_WINDOW },
    heavy: { key: 'shoot', loop: false, holdFrames: PLAYER_HEAVY_DURATION },
  },
};

const PREVIEW_ANIM_MAPS = {
  giovanni: {
    idle: { key: 'idle', loop: true, cycleFrames: 80 },
    walk: { key: 'walk', loop: true, cycleFrames: 80 },
    run: { key: 'run', loop: true, cycleFrames: 80 },
  },
  minion: {
    idle: { key: 'walk', loop: false, holdFrames: 1 },
    walk: { key: 'walk', loop: true, cycleFrames: 80 },
    run: { key: 'run', loop: true, cycleFrames: 80 },
  },
  boss1: {
    idle: { key: 'walk', loop: false, holdFrames: 1 },
    walk: { key: 'walk', loop: true, cycleFrames: 80 },
    run: { key: 'run', loop: true, cycleFrames: 80 },
  },
};

class Player {
  constructor(x, y, spriteCharacter = 'gere', movementOnly = false) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.spriteCharacter = spriteCharacter;
    this.animationMap = movementOnly ? PREVIEW_ANIM_MAPS[spriteCharacter] : PLAYER_ANIM_MAPS[spriteCharacter];
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
    this.vy = 0;
    this.jumpTimer = 0;
    this.grounded = true;
  }

  // Whether this character has a sprite-backed clip for the given combat
  // action (jump/slide/heavy/punch1-3) — missing clips mean the move is
  // simply unavailable for that character rather than falling back silently.
  hasAction(action) {
    return !!(this.animationMap && this.animationMap[action]);
  }

  startJump() {
    if (this.hitStun > 0 || !this.grounded) return;
    if (!this.hasAction('jump')) return;
    this.action = 'jump';
    this.jumpTimer = PLAYER_JUMP_DURATION;
    this.vy = -PLAYER_JUMP_SPEED;
    this.grounded = false;
  }

  startHeavy() {
    if (this.hitStun > 0 || this.moveTimer > 0 || !this.grounded) return;
    if (!this.hasAction('heavy')) return;
    this.action = 'heavy';
    this.moveTimer = PLAYER_HEAVY_DURATION;
    this.slingShot = true;
  }

  startPunchCombo() {
    if (this.hitStun > 0 || !this.grounded) return;
    if (!this.hasAction('punch1')) return;
    if (this.moveTimer > 0 && this.action === 'slide') return;
    if (this.moveTimer === 0) this.comboStep = 0;
    if (this.comboStep < 3) this.comboStep++;
    this.action = ['punch1', 'punch2', 'punch3'][this.comboStep - 1];
    this.moveTimer = PLAYER_COMBO_WINDOW;
    this.comboDamage = 8 + this.comboStep * 4;
    this.attackHit = false;
  }

  startKneeSlide() {
    if (this.hitStun > 0 || !this.grounded) return;
    if (!this.hasAction('slide')) return;
    if (this.moveTimer > 0 && this.action !== 'slide') return;
    this.action = 'slide';
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

      if (!this.grounded) {
        this.jumpTimer--;
        this.vy += PLAYER_GRAVITY;
        if (this.jumpTimer <= 0 || this.vy >= PLAYER_JUMP_SPEED) {
          this.grounded = true;
          this.vy = 0;
          this.action = 'idle';
        }
      }

      if (this.action === 'slide' && this.moveTimer > 0) {
        this.x += this.vx;
      } else {
        if (input.held.left) { dx--; this.facing = -1; }
        if (input.held.right) { dx++; this.facing = 1; }
        if (input.held.up) dy--;
        if (input.held.down) dy++;

        const speed = input.held.run ? PLAYER_RUN_SPEED : PLAYER_MOVE_SPEED;
        this.x += dx * speed;
        this.y += dy * speed;

        if (!this.grounded) {
          // Airborne: keep the jump clip playing regardless of horizontal input.
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
    const holdFrames = anim.loop ? anim.cycleFrames : anim.holdFrames;
    const t = anim.loop
      ? (this.animTimer % holdFrames) / holdFrames
      : clamp(this.animTimer / holdFrames, 0, 0.999);
    return getSpriteFrame(this.spriteCharacter, anim.key, t);
  }

  // Screen-space rise while airborne, as a parabola peaking mid-jump. this.y
  // (world-space lane depth) never changes from jumping — only the sprite's
  // drawn height off the ground does, so the ground shadow stays anchored.
  getJumpOffset() {
    if (this.grounded || !this.hasAction('jump')) return 0;
    const t = clamp(this.jumpTimer / PLAYER_JUMP_DURATION, 0, 1);
    return Math.sin(t * Math.PI) * 34;
  }

  // cameraX: world-space camera offset; screen-space x = this.x - cameraX.
  // Defaults to 0 so callers that don't scroll (none left, but safe) still work.
  draw(ctx, cameraX = 0) {
    const sx = this.x - cameraX;
    const jumpOffset = this.getJumpOffset();
    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln / 3) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    const spriteFrame = this.getSpriteDraw();
    if (spriteFrame) {
      const drawW = spriteFrame.sw;
      const drawH = spriteFrame.sh;
      ctx.save();
      ctx.translate(sx, this.y - jumpOffset);
      ctx.scale(this.facing, 1);
      ctx.drawImage(
        spriteFrame.image,
        spriteFrame.sx, spriteFrame.sy, spriteFrame.sw, spriteFrame.sh,
        -drawW / 2, -drawH, drawW, drawH
      );
      ctx.restore();
    } else {
      drawHumanoid(ctx, sx, this.y - jumpOffset, {
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
    // No sheet has an explicit idle/hurt clip — walk's first frame stands in
    // for idle (a static "ready" pose), and hurt is conveyed purely via the
    // existing flashTimer brightness flash rather than a dedicated clip.
    spriteAnimMap: {
      idle: { key: 'walk', loop: false, holdFrames: 1 },
      walk: { key: 'walk', loop: true, cycleFrames: 24 },
      hurt: { key: 'walk', loop: false, holdFrames: 1 },
    },
  },
  boss1: {
    hp: 220, speed: 0.55, damage: 16, contactRange: 20, color: { suit: '#0f5f2e', accent: '#ffffff', skin: Palette.skin, hair: '#1a1a1a' },
    scoreValue: 2000, boss: true, name: 'The Hooded Villain',
    spriteCharacter: 'boss1',
    spriteAnimMap: {
      idle: { key: 'walk', loop: false, holdFrames: 1 },
      walk: { key: 'walk', loop: true, cycleFrames: 24 },
      hurt: { key: 'walk', loop: false, holdFrames: 1 },
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
      const drawW = spriteFrame.sw;
      const drawH = spriteFrame.sh;
      drawGroundShadow(ctx, sx, this.y, drawW);
      ctx.save();
      ctx.translate(sx, this.y);
      ctx.scale(this.facing, 1);
      ctx.drawImage(
        spriteFrame.image,
        spriteFrame.sx, spriteFrame.sy, spriteFrame.sw, spriteFrame.sh,
        -drawW / 2, -drawH, drawW, drawH
      );
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
      const drawW = spriteFrame.sw;
      const drawH = spriteFrame.sh;
      drawGroundShadow(ctx, sx, this.y, drawW);
      ctx.save();
      ctx.translate(sx, this.y);
      ctx.scale(this.facing, 1);
      ctx.drawImage(
        spriteFrame.image,
        spriteFrame.sx, spriteFrame.sy, spriteFrame.sw, spriteFrame.sh,
        -drawW / 2, -drawH, drawW, drawH
      );
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
