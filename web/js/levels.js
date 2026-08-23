// Level definitions matching the family-rescue story arc from the scaffold.
// Each level is fought on the street outside the named relative's house;
// bgImage is that street scene. shopImage is the interior of that same
// house, shown on the shop screen once the street fight is won.
//
// Levels now scroll: worldWidth is the total horizontal extent of the level
// (in world-space px, same units as player.x / enemy.x). bgImage is repeated
// across that width as a placeholder "segments" array (see LevelRuntime.
// backgroundSegments) until distinct per-segment art exists — swapping in a
// real array of 3-4 unique images per level later is a one-line change there.

const SCREEN_W = 480;
const LEVEL_SCREENS_WIDE = 4;
const DEFAULT_WORLD_WIDTH = SCREEN_W * LEVEL_SCREENS_WIDE;
// Fallback y for a level's NPC when LevelDefs[i].npc doesn't specify one —
// matches the fight lane spawn.top + 20 convention used by spawnWave().
const NPC_DEFAULT_Y = 20;
// How close (world-space px) the player must walk to a rescued NPC's x
// before she's considered "reached" and flips to her victory animation.
const NPC_RESCUE_DISTANCE = 70;

const LevelDefs = [
  {
    id: 'grandma_carla',
    name: 'Grandma Carla’s Street',
    bg: ['#3b2a1f', '#5c4530'],
    bgImage: 'streetGrandma',
    shopImage: 'shopGrandmaKitchen',
    worldWidth: DEFAULT_WORLD_WIDTH,
    waves: [
      ['minion', 'minion'],
      ['minion', 'minion', 'minion'],
      ['boss1'],
    ],
    opensShop: true,
    unlocksAssist: null,
    npc: { typeKey: 'grandma_carla', x: DEFAULT_WORLD_WIDTH - 60 },
  },
  {
    id: 'grandpa_gastone',
    name: 'Grandpa Gastone’s Street',
    bg: ['#2a2a30', '#454550'],
    bgImage: 'streetGrandpa',
    shopImage: 'shopGrandpaGarage',
    worldWidth: DEFAULT_WORLD_WIDTH,
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
    name: 'Uncle Mattia’s Street',
    bg: ['#1a2a3a', '#2c4a63'],
    bgImage: 'streetMattia',
    shopImage: 'shopMattiaWorkshop',
    worldWidth: DEFAULT_WORLD_WIDTH,
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
    name: 'Uncle Michele’s Street',
    bg: ['#1f2e1a', '#375c2c'],
    bgImage: 'streetMichele',
    shopImage: 'shopMicheleYard',
    worldWidth: DEFAULT_WORLD_WIDTH,
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
    bgImage: 'streetBoss',
    shopImage: 'shopBossLuigi',
    worldWidth: DEFAULT_WORLD_WIDTH,
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
    // No bgImage/segments yet for this roster (being replaced later) — the
    // background-drawing code below tolerates that and falls back to the
    // solid gradient in `bg`, repeated across worldWidth like a normal segment.
    worldWidth: DEFAULT_WORLD_WIDTH,
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
    this.worldWidth = this.def.worldWidth || DEFAULT_WORLD_WIDTH;
    this.waveIndex = 0;
    this.enemies = [];
    this.complete = false;
    this.spawnedWave = false;
    // Progress-gated pacing: divide the level into one zone per wave. Wave N
    // won't spawn until the player's worldX has reached zone N's start AND
    // the previous wave is fully cleared (existing "must clear to advance"
    // behavior, kept as-is).
    const waveCount = this.def.waves.length;
    this.waveThresholds = this.def.waves.map((_, i) => (this.worldWidth * i) / waveCount);

    // Data-driven rescued-NPC support (see LevelDefs[i].npc), mirroring how
    // bgImage/shopImage are already optional per-level fields. Only levels
    // that set `npc` get one; other levels' runtimes simply have npc: null.
    // y matches where spawnWave() places enemies (bounds.top + 20) since the
    // real bounds.top isn't known until game.js's worldBounds() at draw time,
    // and this is just a fixed spot in the fight lane.
    this.npc = this.def.npc
      ? new NPC(this.def.npc.typeKey, this.def.npc.x, this.def.npc.y != null ? this.def.npc.y : NPC_DEFAULT_Y)
      : null;
  }

  // Placeholder segment list: the same bgImage key repeated across the level
  // width. Swap this for a real per-segment array (e.g. def.bgImages, one
  // key per screen) once distinct segment art exists — everything else
  // (tiling/scrolling in game.js) already treats backgrounds as a list.
  backgroundSegments() {
    const segments = Math.max(1, Math.ceil(this.worldWidth / SCREEN_W));
    const key = this.def.bgImage || null;
    return Array.from({ length: segments }, () => key);
  }

  // While a wave is active and has living enemies, softly wall the player in
  // just ahead of the fight so it can't be outrun (classic beat-em-up lock).
  // Returns the world-space right edge of the player's current movement zone.
  advanceLockX() {
    if (this.complete) return this.worldWidth;
    const active = this.activeEnemies();
    if (active.length === 0) return this.worldWidth;
    const lockAt = this.waveThresholds[this.waveIndex] + SCREEN_W * 0.9;
    return Math.min(this.worldWidth, lockAt);
  }

  spawnWave(bounds) {
    const wave = this.def.waves[this.waveIndex];
    const spawnRightEdge = Math.min(
      this.worldWidth,
      this.waveThresholds[this.waveIndex] + SCREEN_W - 20
    );
    this.enemies = wave.map((type, i) => {
      const x = spawnRightEdge - i * 34;
      const y = bounds.top + 20 + (i % 2) * 30;
      return new Enemy(type, x, y);
    });
    this.spawnedWave = true;
  }

  // Advances the NPC's idle animation every tick (so she's waving the whole
  // fight, not just once reachable), and flips her to rescued once the level
  // is complete AND the player has walked close enough to her position.
  // Returns true the single tick rescue actually triggers, so game.js can
  // push a floatText/score bump using its existing pattern — this class
  // stays free of game.js's HUD/score globals.
  updateNpc(player) {
    if (!this.npc) return false;
    this.npc.update();
    if (this.npc.rescued) return false;
    if (!this.complete) return false;
    if (Math.abs(player.x - this.npc.x) > NPC_RESCUE_DISTANCE) return false;
    return this.npc.rescue();
  }

  update(player, bounds) {
    if (this.complete) return;

    if (!this.spawnedWave) {
      const threshold = this.waveThresholds[this.waveIndex];
      if (player.x >= threshold) {
        this.spawnWave(bounds);
      }
    }

    for (const e of this.enemies) {
      e.update(player, bounds);
    }

    // clean up long-dead enemies
    this.enemies = this.enemies.filter(e => !e.dead || e.deathTimer < 90);

    if (!this.spawnedWave) return;

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

