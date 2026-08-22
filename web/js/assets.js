// Loads real cropped artwork from the Super Gere texture pack (see textures.jpeg).
// Falls back gracefully: game logic never blocks on load, sprites.js vector
// drawing is used automatically for anything not yet loaded.

const AssetPaths = {
  heroPortrait: 'assets/hero_portrait.png',
  faceHappy: 'assets/face_happy.png',
  faceSmirk: 'assets/face_smirk.png',
  faceBigSmile: 'assets/face_bigsmile.png',
  faceAngry: 'assets/face_angry.png',
  facePlatinumAngry: 'assets/face_platinum_angry.png',
  facePlatinumShout: 'assets/face_platinum_shout.png',
  // Level fight backgrounds: the street outside each relative's house.
  streetGrandma: 'assets/street_grandma.jpg',
  streetGrandpa: 'assets/street_grandpa.jpg',
  streetMattia: 'assets/street_mattia.jpg',
  streetMichele: 'assets/street_michele.jpg',
  streetBoss: 'assets/street_boss.jpg',
  // Shop backgrounds: interior of each relative's house, shown between levels.
  shopGrandmaKitchen: 'assets/shop_grandma_kitchen.jpg',
  shopGrandpaGarage: 'assets/shop_grandpa_garage.jpg',
  shopMattiaWorkshop: 'assets/shop_mattia_workshop.jpg',
  shopMicheleYard: 'assets/shop_michele_yard.jpg',
  shopBossLuigi: 'assets/shop_boss_luigi.jpg',
};

// Multi-frame sprite-sheet animations for Super Gere, generated via
// AutoSprite (see web/assets/gere_sprites/<name>/{spritesheet.png,atlas.json}).
// Each atlas.json describes a uniform grid of frames with pixel coordinates
// and an overall clip duration; SpriteAnim wraps that into something
// drawable frame-by-frame against player.walkPhase-style timers.
const GereSpriteSheets = {
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
};

const Assets = {};
const SpriteAnims = {};
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

function loadSpriteSheet(key, dir) {
  return Promise.all([
    loadImage(`assets/${dir}/spritesheet.png`),
    loadJSON(`assets/${dir}/atlas.json`),
  ]).then(([image, atlas]) => {
    if (!image || !atlas) return;
    const frameKeys = Object.keys(atlas.frames).sort((a, b) => Number(a) - Number(b));
    SpriteAnims[key] = {
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
  const sheetPromises = Object.entries(GereSpriteSheets).map(([key, dir]) =>
    loadSpriteSheet(key, dir)
  );
  return Promise.all([...imagePromises, ...sheetPromises]).then(() => {
    assetsLoaded = true;
  });
}

// Returns { image, sx, sy, sw, sh } for the frame closest to `t` (0..1
// normalized progress through the clip), or null if the sheet isn't loaded.
function getSpriteFrame(animKey, t) {
  const anim = SpriteAnims[animKey];
  if (!anim || anim.frames.length === 0) return null;
  const idx = Math.min(anim.frames.length - 1, Math.floor(clamp(t, 0, 0.999) * anim.frames.length));
  const f = anim.frames[idx];
  return { image: anim.image, sx: f.x, sy: f.y, sw: f.w, sh: f.h };
}
