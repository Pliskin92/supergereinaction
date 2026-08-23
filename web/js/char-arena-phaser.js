// Real gameplay test arena for /test/phaser/, built on Phaser 3 instead of
// the vanilla-Canvas Player class (see js/char-arena.js) — same controls,
// same per-character canonical clips, same move timings, so the two arenas
// are a like-for-like comparison of the two rendering approaches.
//
// AutoSprite's atlas.json is a flat {frames: {i: {x,y,w,h,duration}}} grid,
// not Phaser's TexturePacker atlas format, so sheets are loaded as plain
// Phaser spritesheets (uniform 256x256 frames) and per-clip animations are
// built directly from our own atlas JSON (fetched once per clip) instead of
// going through Phaser's atlas loader.

const ARENA_W = 960;
const ARENA_H = 480;
const GROUND_Y = ARENA_H - 40;

const CANONICAL_ACTIONS = [
  'idle_right', 'walk_right', 'run_right', 'jump_right',
  'punch', 'kick', 'heavy', 'roll',
  'hurt', 'hit_react', 'fall', 'victory', 'dance', 'wave',
];

const MOVE_SPEED = 1.1 * 60;   // px/sec, matches PLAYER_MOVE_SPEED (px/tick @60fps)
const RUN_SPEED = 2.2 * 60;
const DODGE_SPEED = 2.6 * 60;
const COMBO_WINDOW_MS = (22 / 60) * 1000;
const SLIDE_DURATION_MS = (26 / 60) * 1000;
const HEAVY_DURATION_MS = (28 / 60) * 1000;
const JUMP_DURATION_MS = (30 / 60) * 1000;

const Input = {
  held: { left: false, right: false, up: false, down: false, run: false },
};

const keyMap = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  Shift: 'run',
};

const heldKeys = new Set();
let pendingPunch = false;
let pendingRoll = false;
let pendingHeavy = false;
let pendingJump = false;

window.addEventListener('keydown', (e) => {
  if (keyMap[e.key]) Input.held[keyMap[e.key]] = true;
  if (!heldKeys.has(e.key)) {
    if (e.key === 'j' || e.key === 'J') pendingPunch = true;
    if (e.key === 'k' || e.key === 'K') pendingRoll = true;
    if (e.key === 'l' || e.key === 'L') pendingHeavy = true;
    if (e.key === ' ') pendingJump = true;
  }
  heldKeys.add(e.key);
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  if (keyMap[e.key]) Input.held[keyMap[e.key]] = false;
  heldKeys.delete(e.key);
});

// Cache of { frameCount, durationS } per "<character>/<action>" so
// switching characters doesn't re-fetch atlases already seen this session.
const atlasCache = {};

async function fetchAtlas(character, action) {
  const cacheKey = `${character}/${action}`;
  if (cacheKey in atlasCache) return atlasCache[cacheKey];
  const dir = `${character}_sprites/${action}`;
  const res = await fetch(`assets/release/${dir}/atlas.json`);
  if (!res.ok) {
    atlasCache[cacheKey] = null;
    return null;
  }
  const data = await res.json();
  const entry = { frameCount: Object.keys(data.frames).length, durationS: data.meta.duration_s || 1 };
  atlasCache[cacheKey] = entry;
  return entry;
}

// Phaser's preload()/create() lifecycle is synchronous — it can't await a
// fetch mid-preload (an async preload() returns before any load.spritesheet
// call is queued, so nothing loads). So atlas metadata for a character is
// resolved up front, here, before the scene ever starts; preload()/create()
// then just synchronously consume that already-known data.
async function loadCharacterManifest(character) {
  const available = {};
  await Promise.all(CANONICAL_ACTIONS.map(async (action) => {
    const entry = await fetchAtlas(character, action);
    if (entry) available[action] = entry;
  }));
  return available;
}

class ArenaScene extends Phaser.Scene {
  constructor() {
    super('arena');
  }

  init(data) {
    // Phaser auto-starts a single-scene config once the game boots, before
    // arenaSetUp()'s first explicit scene.start() call with real data — that
    // first auto-start has no data and is a no-op; the explicit start right
    // after is what actually loads and creates the character.
    this.character = data && data.character;
    this.available = (data && data.available) || {};
    this.action = 'idle_right';
    this.actionLockUntil = 0;
    this.comboStep = 0;
    this.facing = 1;
  }

  preload() {
    if (!this.character) return;
    for (const action of Object.keys(this.available)) {
      const textureKey = `${this.character}/${action}`;
      if (!this.textures.exists(textureKey)) {
        this.load.spritesheet(textureKey, `assets/release/${this.character}_sprites/${action}/spritesheet.png`, {
          frameWidth: 256,
          frameHeight: 256,
        });
      }
    }
  }

  create() {
    if (!this.character) return;
    for (const [action, entry] of Object.entries(this.available)) {
      const textureKey = `${this.character}/${action}`;
      const animKey = `${this.character}/${action}/anim`;
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers(textureKey, { start: 0, end: entry.frameCount - 1 }),
          frameRate: entry.frameCount / entry.durationS,
          repeat: -1,
        });
      }
    }

    this.sprite = this.add.sprite(ARENA_W / 2, GROUND_Y, `${this.character}/idle_right`);
    this.sprite.setOrigin(0.5, 1);
    this.playAction('idle_right', true);
  }

  hasAction(action) {
    return !!this.available[action];
  }

  playAction(action, loop) {
    if (!this.hasAction(action)) return false;
    this.action = action;
    this.sprite.play({ key: `${this.character}/${action}/anim`, repeat: loop ? -1 : 0 });
    return true;
  }

  startJump() {
    if (this.time.now < this.actionLockUntil) return;
    if (!this.playAction('jump_right', false)) return;
    this.actionLockUntil = this.time.now + JUMP_DURATION_MS;
  }

  startHeavy() {
    if (this.time.now < this.actionLockUntil) return;
    if (!this.playAction('heavy', false)) return;
    this.actionLockUntil = this.time.now + HEAVY_DURATION_MS;
  }

  startRoll() {
    if (this.time.now < this.actionLockUntil) return;
    if (!this.playAction('roll', false)) return;
    this.actionLockUntil = this.time.now + SLIDE_DURATION_MS;
  }

  startPunch() {
    const midCombo = this.time.now < this.actionLockUntil && this.action === (this.comboStep === 3 ? 'kick' : 'punch');
    if (this.time.now < this.actionLockUntil && !midCombo) return;
    this.comboStep = this.comboStep < 3 ? this.comboStep + 1 : 1;
    const clip = this.comboStep === 3 ? 'kick' : 'punch';
    if (!this.playAction(clip, false)) { this.comboStep = 0; return; }
    this.actionLockUntil = this.time.now + COMBO_WINDOW_MS;
  }

  update(time, delta) {
    if (!this.sprite) return;
    if (pendingJump) { this.startJump(); pendingJump = false; }
    if (pendingPunch) { this.startPunch(); pendingPunch = false; }
    if (pendingRoll) { this.startRoll(); pendingRoll = false; }
    if (pendingHeavy) { this.startHeavy(); pendingHeavy = false; }

    const locked = time < this.actionLockUntil;
    if (!locked) {
      let dx = 0, dy = 0;
      if (Input.held.left) { dx -= 1; this.facing = -1; }
      if (Input.held.right) { dx += 1; this.facing = 1; }
      if (Input.held.up) dy -= 1;
      if (Input.held.down) dy += 1;

      const speed = Input.held.run ? RUN_SPEED : MOVE_SPEED;
      const dt = delta / 1000;
      this.sprite.x = Phaser.Math.Clamp(this.sprite.x + dx * speed * dt, 24, ARENA_W - 24);
      this.sprite.y = Phaser.Math.Clamp(this.sprite.y + dy * DODGE_SPEED * dt, ARENA_H * 0.5, ARENA_H - 30);
      this.sprite.setFlipX(this.facing < 0);

      if (dx !== 0 || dy !== 0) {
        this.playAction(Input.held.run ? 'run_right' : 'walk_right', true);
      } else if (this.action !== 'idle_right') {
        this.comboStep = 0;
        this.playAction('idle_right', true);
      }
    } else if (this.sprite.anims.currentAnim && !this.sprite.anims.isPlaying) {
      // A one-shot combat clip (jump/heavy/roll/punch/kick) finished playing
      // before its lock window elapsed — release back to idle immediately
      // rather than holding the last frame until the timer catches up.
      this.comboStep = 0;
      this.playAction('idle_right', true);
    }
  }

}

async function arenaSetUp() {
  const config = {
    type: Phaser.AUTO,
    width: ARENA_W,
    height: ARENA_H,
    parent: 'phaserHost',
    backgroundColor: '#0a0a12',
    pixelArt: true,
    scene: ArenaScene,
  };
  const game = new Phaser.Game(config);

  const select = document.getElementById('characterSelect');
  const startCharacter = async (character) => {
    const available = await loadCharacterManifest(character);
    game.scene.stop('arena');
    game.scene.start('arena', { character, available });
  };

  await startCharacter(select ? select.value : 'gere');

  if (select) {
    select.addEventListener('change', () => {
      startCharacter(select.value);
      select.blur();
    });
  }
}

arenaSetUp();
