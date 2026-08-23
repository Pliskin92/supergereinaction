// A fixed, dark arena for tuning movement and combat before any levels exist.
const ARENA_WIDTH = 480;
const ARENA_COLORS = ['#05060a', '#151824'];
const ARENA_SPAWN_DELAY = 90;

class MechanicsArena {
  constructor() {
    this.worldWidth = ARENA_WIDTH;
    this.enemies = [];
    this.spawnTimer = 0;
  }

  advanceLockX() {
    return this.worldWidth;
  }

  update(player, bounds) {
    for (const enemy of this.enemies) enemy.update(player, bounds);
    this.enemies = this.enemies.filter(enemy => !enemy.dead || enemy.deathTimer < 90);

    if (this.enemies.length > 0) return;
    if (this.spawnTimer > 0) {
      this.spawnTimer--;
      return;
    }

    this.enemies.push(new Enemy('minion', this.worldWidth - 80, bounds.top + 36));
    this.spawnTimer = ARENA_SPAWN_DELAY;
  }

  activeEnemies() {
    return this.enemies.filter(enemy => !enemy.dead);
  }
}

