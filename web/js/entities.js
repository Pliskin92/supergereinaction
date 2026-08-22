// Entity logic: player, enemies, assists. Ported/expanded from the PSn00bSDK C scaffold.

const PLAYER_MOVE_SPEED = 1.6;
const PLAYER_SLIDE_SPEED = 4.2;
const PLAYER_COMBO_WINDOW = 22;
const PLAYER_SLIDE_DURATION = 26;
const PLATINUM_STATE_FRAMES = 10 * 60;
const HIT_STUN_FRAMES = 14;

const PlayerColors = {
  suit: Palette.suitBlack,
  accent: Palette.suitGold,
  cape: Palette.capeGold,
  emblem: 'G',
  skin: Palette.skin,
  hair: Palette.hair,
};

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.hp = 100;
    this.maxHp = 100;
    this.fury = 0;
    this.platinumTimer = 0;
    this.platinum = false;
    this.comboStep = 0;
    this.comboDamage = 0;
    this.moveTimer = 0;
    this.action = 'idle';
    this.walkPhase = 0;
    this.hitStun = 0;
    this.invuln = 0;
    this.attackHit = false; // whether current attack already landed
    this.jumpVy = 0;
    this.grounded = true;
    this.z = 0; // depth offset for jump visual
  }

  startPunchCombo() {
    if (this.hitStun > 0) return;
    if (this.moveTimer > 0 && this.action === 'slide') return;
    if (this.moveTimer === 0) this.comboStep = 0;
    if (this.comboStep < 3) this.comboStep++;
    this.action = ['punch1', 'punch2', 'punch3'][this.comboStep - 1];
    this.moveTimer = PLAYER_COMBO_WINDOW;
    this.comboDamage = 8 + this.comboStep * 4;
    this.attackHit = false;
    this.fury = clamp(this.fury + 8, 0, 100);
    if (this.fury >= 100 && !this.platinum) {
      this.platinum = true;
      this.platinumTimer = PLATINUM_STATE_FRAMES;
    }
  }

  startKneeSlide() {
    if (this.hitStun > 0) return;
    if (this.moveTimer > 0 && this.action !== 'slide') return;
    this.action = 'slide';
    this.moveTimer = PLAYER_SLIDE_DURATION;
    this.vx = this.facing * PLAYER_SLIDE_SPEED;
    this.attackHit = false;
    this.fury = clamp(this.fury + 12, 0, 100);
    if (this.fury >= 100 && !this.platinum) {
      this.platinum = true;
      this.platinumTimer = PLATINUM_STATE_FRAMES;
    }
  }

  jump() {
    if (!this.grounded || this.hitStun > 0) return;
    this.jumpVy = -5.2;
    this.grounded = false;
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

  update(input, bounds) {
    let dx = 0, dy = 0;

    if (this.hitStun > 0) {
      this.hitStun--;
      this.x += this.vx;
      this.vx *= 0.85;
    } else {
      if (input.pressed.punch) this.startPunchCombo();
      if (input.pressed.slide) this.startKneeSlide();
      if (input.pressed.jump) this.jump();

      if (this.moveTimer > 0) this.moveTimer--;

      if (this.action === 'slide' && this.moveTimer > 0) {
        this.x += this.vx;
      } else {
        if (input.held.left) { dx--; this.facing = -1; }
        if (input.held.right) { dx++; this.facing = 1; }
        if (input.held.up) dy--;
        if (input.held.down) dy++;

        this.x += dx * PLAYER_MOVE_SPEED;
        this.y += dy * PLAYER_MOVE_SPEED;

        if (dx !== 0 || dy !== 0) {
          this.action = 'walk';
          this.walkPhase += 0.35;
        } else if (this.moveTimer === 0) {
          this.action = 'idle';
          this.comboStep = 0;
          this.comboDamage = 0;
        }
      }
    }

    // jump physics (visual hop, doesn't leave the beat-em-up plane)
    if (!this.grounded) {
      this.z += this.jumpVy;
      this.jumpVy += 0.35;
      if (this.z >= 0) {
        this.z = 0;
        this.jumpVy = 0;
        this.grounded = true;
      }
    }

    this.x = clamp(this.x, bounds.left, bounds.right);
    this.y = clamp(this.y, bounds.top, bounds.bottom);

    if (this.moveTimer === 0 && this.action === 'slide') {
      this.action = 'idle';
      this.vx = 0;
    }

    if (this.invuln > 0) this.invuln--;

    if (this.platinum && this.platinumTimer > 0) {
      this.platinumTimer--;
      if (this.platinumTimer === 0) {
        this.platinum = false;
        this.fury = 0;
      }
    }
  }

  getAttackHitbox() {
    if (this.action === 'punch1' || this.action === 'punch2' || this.action === 'punch3') {
      return { x: this.x + this.facing * 16, y: this.y - 20, w: 16, h: 20, damage: this.comboDamage };
    }
    if (this.action === 'slide' && this.moveTimer > 0) {
      return { x: this.x + this.facing * 6, y: this.y - 6, w: 20, h: 12, damage: 10 };
    }
    return null;
  }

  draw(ctx) {
    ctx.save();
    if (this.invuln > 0 && Math.floor(this.invuln / 3) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
    if (this.platinum) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#8fe8ff';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 20 + this.z, 22 + Math.sin(Date.now() / 100) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawHumanoid(ctx, this.x, this.y + this.z, {
      walkPhase: this.walkPhase,
      action: this.action,
      facing: this.facing,
      platinum: this.platinum,
    }, PlayerColors);
    ctx.restore();
  }
}

// Enemy archetypes matching the family cast from the scaffold's level design
const EnemyTypes = {
  minion: {
    hp: 30, speed: 0.7, damage: 6, contactRange: 14, color: { suit: '#38424f', accent: '#7d92a8', skin: Palette.skin, hair: '#333' },
    scoreValue: 100,
  },
  grandma_carla: {
    hp: 80, speed: 0.5, damage: 10, contactRange: 16, color: { suit: '#7a3b56', accent: '#e8c1d6', skin: Palette.skinShade, hair: '#cfcfcf', emblem: null },
    scoreValue: 500, boss: true, name: 'Grandma Carla',
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
  }

  update(player, bounds) {
    if (this.dead) {
      this.deathTimer++;
      return;
    }

    if (this.flashTimer > 0) this.flashTimer--;

    if (this.hitStun > 0) {
      this.hitStun--;
      this.action = 'hurt';
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

  draw(ctx) {
    if (this.dead && this.deathTimer > 60) return;
    ctx.save();
    if (this.flashTimer > 0) {
      ctx.filter = 'brightness(2)';
    }
    drawHumanoid(ctx, this.x, this.y, {
      walkPhase: this.walkPhase,
      action: this.action,
      facing: this.facing,
    }, this.def.color);
    ctx.restore();

    if (!this.dead) {
      // small hp bar for bosses
      if (this.def.boss) {
        const w = 30;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(this.x - w / 2, this.y - 52, w, 4);
        ctx.fillStyle = '#e84c4c';
        ctx.fillRect(this.x - w / 2, this.y - 52, w * (this.hp / this.maxHp), 4);
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

  draw(ctx, player) {
    if (!this.active) return;
    const assistX = player.x + player.facing * 30;
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

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
