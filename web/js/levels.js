// Level definitions matching the family-rescue story arc from the scaffold.

const LevelDefs = [
  {
    id: 'grandma_carla',
    name: 'Grandma Carla’s Kitchen',
    bg: ['#3b2a1f', '#5c4530'],
    waves: [
      ['minion', 'minion'],
      ['minion', 'minion', 'minion'],
      ['grandma_carla'],
    ],
    opensShop: true,
    unlocksAssist: null,
  },
  {
    id: 'grandpa_gastone',
    name: 'Grandpa Gastone’s Garage',
    bg: ['#2a2a30', '#454550'],
    waves: [
      ['minion', 'minion'],
      ['minion', 'minion', 'minion'],
      ['minion', 'minion'],
      ['grandpa_gastone'],
    ],
    opensShop: true,
    unlocksAssist: null,
  },
  {
    id: 'uncle_mattia',
    name: 'Uncle Mattia’s Workshop',
    bg: ['#1a2a3a', '#2c4a63'],
    waves: [
      ['minion', 'minion'],
      ['minion', 'minion', 'minion'],
      ['minion'],
      ['uncle_mattia'],
    ],
    opensShop: true,
    unlocksAssist: 'mattia',
  },
  {
    id: 'uncle_michele',
    name: 'Uncle Michele’s Yard',
    bg: ['#1f2e1a', '#375c2c'],
    waves: [
      ['minion', 'minion'],
      ['minion', 'minion', 'minion'],
      ['minion', 'minion'],
      ['minion'],
      ['uncle_michele'],
    ],
    opensShop: true,
    unlocksAssist: 'michele',
  },
  {
    id: 'boss_luigi',
    name: 'Showdown with Boss Luigi',
    bg: ['#2a1f1f', '#5c2c2c'],
    waves: [
      ['minion', 'minion'],
      ['boss_luigi'],
    ],
    opensShop: true,
    unlocksAssist: null,
  },
  {
    id: 'multi_boss',
    name: 'Final Rescue: Mario, Wario & Bowser',
    bg: ['#100a1a', '#2a1a3a'],
    waves: [
      ['mario'],
      ['wario'],
      ['bowser'],
    ],
    opensShop: false,
    unlocksAssist: null,
  },
];

class LevelRuntime {
  constructor(index) {
    this.index = index;
    this.def = LevelDefs[index];
    this.waveIndex = 0;
    this.enemies = [];
    this.complete = false;
    this.spawnedWave = false;
  }

  spawnWave(bounds) {
    const wave = this.def.waves[this.waveIndex];
    this.enemies = wave.map((type, i) => {
      const x = bounds.right - 20 - i * 34;
      const y = bounds.top + 20 + (i % 2) * 30;
      return new Enemy(type, x, y);
    });
    this.spawnedWave = true;
  }

  update(player, bounds) {
    if (this.complete) return;

    if (!this.spawnedWave) {
      this.spawnWave(bounds);
    }

    for (const e of this.enemies) {
      e.update(player, bounds);
    }

    // clean up long-dead enemies
    this.enemies = this.enemies.filter(e => !e.dead || e.deathTimer < 90);

    const allDead = this.enemies.every(e => e.dead);
    if (allDead) {
      if (this.waveIndex + 1 < this.def.waves.length) {
        this.waveIndex++;
        this.spawnedWave = false;
      } else {
        this.complete = true;
      }
    }
  }

  activeEnemies() {
    return this.enemies.filter(e => !e.dead);
  }
}
