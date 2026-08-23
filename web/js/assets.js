// Loads real cropped artwork from the Super Gere texture pack (see textures.jpeg).
// Falls back gracefully: game logic never blocks on load, sprites.js vector
// drawing is used automatically for anything not yet loaded.

const AssetPaths = {
  heroPortrait: 'assets/release/hero_portrait.png',
  faceHappy: 'assets/release/face_happy.png',
  faceSmirk: 'assets/release/face_smirk.png',
  faceBigSmile: 'assets/release/face_bigsmile.png',
  faceAngry: 'assets/release/face_angry.png',
  streetLv1Example1: 'assets/release/street-lv1-example1.jpg',
  streetLv1Example2: 'assets/release/street-lv1-example2.jpg',
};

// Multi-frame sprite-sheet animations, generated via AutoSprite (see
// web/assets/release/<character>_sprites/<name>/{spritesheet.png,atlas.json}).
// Each atlas.json describes a uniform grid of frames with pixel coordinates
// and an overall clip duration.
//
// Every character's sprite folders use the same canonical action names
// (below) — no per-character key remapping. A character simply omits the
// folders it doesn't have (e.g. carla has no combat clips at all, boss1 has
// no jump); loadSpriteSheet() already skips setting SpriteAnims[char][action]
// when a sheet 404s, so a missing folder just means that action isn't
// available for that character, with no separate gating table required.
const CANONICAL_ACTIONS = [
  'idle_right', 'walk_right', 'run_right', 'jump_right',
  'punch', 'kick', 'heavy', 'roll',
  'hurt', 'hit_react', 'fall', 'victory', 'dance', 'wave',
];

const PlayableCharacters = ['gere', 'giox', 'minion', 'boss1', 'carla', 'giovanni'];

const CharacterSpriteSheets = {};
for (const character of PlayableCharacters) {
  const sheets = {};
  for (const action of CANONICAL_ACTIONS) {
    sheets[action] = `${character}_sprites/${action}`;
  }
  CharacterSpriteSheets[character] = sheets;
}

const Assets = {};
const SpriteAnims = {}; // SpriteAnims[character][action] -> anim data
let assetsLoaded = false;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function loadJSON(src) {
  return fetch(src)
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);
}

function loadSpriteSheet(character, action, dir) {
  const encodedDir = dir.split('/').map(encodeURIComponent).join('/');
  return Promise.all([
    loadImage(`assets/release/${encodedDir}/spritesheet.png`),
    loadJSON(`assets/release/${encodedDir}/atlas.json`),
  ]).then(([image, atlas]) => {
    if (!image || !atlas) return;
    const frameKeys = Object.keys(atlas.frames).sort((a, b) => Number(a) - Number(b));
    if (!SpriteAnims[character]) SpriteAnims[character] = {};
    SpriteAnims[character][action] = {
      image,
      frames: frameKeys.map((k) => atlas.frames[k]),
      frameSize: atlas.meta.frame_size,
      durationS: atlas.meta.duration_s || 1,
    };
  });
}

function loadAssets() {
  const keys = Object.keys(AssetPaths);
  const imagePromises = keys.map((key) =>
    loadImage(AssetPaths[key]).then((img) => {
      if (img) Assets[key] = img;
    })
  );
  const sheetPromises = [];
  for (const [character, actions] of Object.entries(CharacterSpriteSheets)) {
    for (const [action, dir] of Object.entries(actions)) {
      sheetPromises.push(loadSpriteSheet(character, action, dir));
    }
  }
  return Promise.all([...imagePromises, ...sheetPromises]).then(() => {
    assetsLoaded = true;
  });
}

// Returns { image, sx, sy, sw, sh } for the frame closest to `t` (0..1
// normalized progress through the clip), or null if the character/action
// sheet isn't loaded (caller should fall back to procedural drawing).
function getSpriteFrame(character, action, t) {
  const anim = SpriteAnims[character] && SpriteAnims[character][action];
  if (!anim || anim.frames.length === 0) return null;
  const idx = Math.min(anim.frames.length - 1, Math.floor(clamp(t, 0, 0.999) * anim.frames.length));
  const f = anim.frames[idx];
  return { image: anim.image, sx: f.x, sy: f.y, sw: f.w, sh: f.h };
}
