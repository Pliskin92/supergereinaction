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
  slide1: 'assets/slide_1_crouch.png',
  slide2: 'assets/slide_2_kick.png',
  slide3: 'assets/slide_3_ground.png',
  slide4: 'assets/slide_4_recover.png',
};

const Assets = {};
let assetsLoaded = false;

function loadAssets() {
  const keys = Object.keys(AssetPaths);
  let remaining = keys.length;
  return new Promise((resolve) => {
    if (remaining === 0) {
      assetsLoaded = true;
      resolve();
      return;
    }
    keys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        Assets[key] = img;
        remaining--;
        if (remaining === 0) {
          assetsLoaded = true;
          resolve();
        }
      };
      img.onerror = () => {
        // Missing/broken asset: leave it out of Assets so callers fall back
        // to procedural drawing instead of crashing.
        remaining--;
        if (remaining === 0) {
          assetsLoaded = true;
          resolve();
        }
      };
      img.src = AssetPaths[key];
    });
  });
}

const PlayerSlideFrames = () => [Assets.slide1, Assets.slide2, Assets.slide3, Assets.slide4];
