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
// web/assets/<character>_sprites/<name>/{spritesheet.png,atlas.json}).
// Each atlas.json describes a uniform grid of frames with pixel coordinates
// and an overall clip duration. Sheets are namespaced per character
// ("gere", "minion", "carla", ...) so different casts can reuse action
// names (e.g. every character has its own "walk") without colliding.
const CharacterSpriteSheets = {
  gere: {
    idle: 'gere_sprites/idle_right',
    walk: 'gere_sprites/walk_right',
    run: 'gere_sprites/run_right',
    punch: 'gere_sprites/punch',
    kick: 'gere_sprites/kick',
    shoot: 'gere_sprites/attack_right',
    jump: 'gere_sprites/jump_right',
    roll: 'gere_sprites/roll',
    hurt: 'gere_sprites/hurt',
    victory: 'gere_sprites/victory',
  },
  minion: {
    walk: 'minion_sprites/walk_right',
    run: 'minion_sprites/run_right',
    punch: 'minion_sprites/punch',
    kick: 'minion_sprites/kick',
    shoot: 'minion_sprites/attack_right',
    jump: 'minion_sprites/jump_right',
  },
  carla: {
    walk: 'carla_sprites/walk_right',
    wave: 'carla_sprites/wave',
    victory: 'carla_sprites/victory',
  },
  boss1: {
    walk: 'boss1_sprites/walk_right',
    run: 'boss1_sprites/run_right',
    punch: 'boss1_sprites/punch',
    kick: 'boss1_sprites/kick',
    shoot: 'boss1_sprites/attack_right',
    fall: 'boss1_sprites/fall',
  },
};

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
  return Promise.all([
    loadImage(`assets/release/${dir}/spritesheet.png`),
    loadJSON(`assets/release/${dir}/atlas.json`),
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
