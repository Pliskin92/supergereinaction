// Loads the sprite-sheet animations. Nothing blocks on this: a clip that
// hasn't loaded (or doesn't exist for a character) simply isn't in
// SpriteAnims, and callers fall back to sprites.js vector drawing.

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
  // Lounging, hands behind the head. Only gere has one; it is what the
  // opening cutscene shows him doing before he hears his father.
  'relaxed',
];

// giovanni's sprites have moved to web/assets/private/ and are no longer
// shipped, so the character is not loaded here any more.
//
// 'supergere' is not selectable: it's the FURY transformation skin that
// Player swaps to at full meter (see PLAYER_FURY_CHARACTER), but it loads
// through exactly the same path as any other character.
// 'bananana' is a second street minion. Like 'minion' it is not actually
// selectable -- the list is really "every character pack that loads" -- but
// it goes through the identical path, so it needs no special handling.
// 'roger' and 'meeottee' are cutscene-only characters (Gere's father and
// the villain, in the opening). Neither is selectable nor spawns as an
// enemy, but they load through the identical path, which also means the
// level's loading gate waits on them like everything else.
const PlayableCharacters = [
  'gere', 'giox', 'minion', 'boss1', 'carla', 'supergere', 'bananana',
  'roger', 'meeottee',
];

// Per-character folder-name overrides. The convention is that a clip's
// folder is named for its canonical action, but supergere's pack was
// exported with capitalised names ('Punch', not 'punch') and uses
// 'Hit React' with a space. Rather than rename the shipped art, map the
// exceptions here; anything absent falls through to the canonical name.
//
// supergere's pack has no 'heavy' or 'wave' clip. 'wave' is cosmetic and is
// simply left absent (it 404s and hasAction() reports it unavailable, the
// same as any other partial character). 'heavy' is a combat move the player
// would otherwise *lose* on transforming, which would make FURY a downgrade
// mid-fight, so it is pointed at the pack's dedicated 'attack_right' clip.
// gere's pack was re-exported from the same tool as supergere's, so it now
// uses byte-identical folder names -- capitalised clips, 'Hit React' with a
// space, and 'attack_right' in place of 'heavy'. The two therefore share one
// alias table rather than keeping a duplicate copy per character.
const AUTOSPRITE_CAPITALISED_CLIPS = {
  punch: 'Punch',
  kick: 'Kick',
  roll: 'Roll',
  hurt: 'Hurt',
  hit_react: 'Hit React',
  fall: 'Fall',
  victory: 'Victory',
  dance: 'Dance',
  heavy: 'attack_right',
};

const SPRITE_FOLDER_ALIASES = {
  supergere: AUTOSPRITE_CAPITALISED_CLIPS,
  gere: AUTOSPRITE_CAPITALISED_CLIPS,
  // bananana came from the same exporter again: capitalised clips, 'Hit
  // React' with a space, and 'attack_right' standing in for 'heavy'. It has
  // no roll/victory/dance/wave, which simply 404 and stay unavailable.
  bananana: AUTOSPRITE_CAPITALISED_CLIPS,
  // roger's and meeottee's packs came from the same exporter as gere's.
  roger: AUTOSPRITE_CAPITALISED_CLIPS,
  meeottee: AUTOSPRITE_CAPITALISED_CLIPS,
  // The minion's newer clips came from the same exporter, so its reaction
  // and death folders are capitalised too; its older combat clips are not.
  minion: { hurt: 'Hurt', hit_react: 'Hit React' },
};

const CharacterSpriteSheets = {};
for (const character of PlayableCharacters) {
  const sheets = {};
  const aliases = SPRITE_FOLDER_ALIASES[character] || {};
  for (const action of CANONICAL_ACTIONS) {
    sheets[action] = `${character}_sprites/${aliases[action] || action}`;
  }
  CharacterSpriteSheets[character] = sheets;
}

// Prop sprite packs. These are not characters: they have no canonical
// action set, they're never selectable, and each declares only the clips it
// actually has. Kept out of PlayableCharacters so the roster stays the list
// of things you can play as, but they load through the same path and land
// in the same SpriteAnims table.
const PropSpriteSheets = {
  boxingsack: { swing: 'boxingsack_sprites/swing' },
  car: { damage: 'car_sprites/damage', fx: 'car_sprites/fx' },
};

const SpriteAnims = {}; // SpriteAnims[character][action] -> anim data

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
    // trim.json is generated by scripts/build-sprite-trim.py and supplies
    // the per-frame bounding box + per-clip scale that atlas.json lacks.
    // Optional: a clip without it just renders as an untrimmed tile.
    loadJSON(`assets/release/${encodedDir}/trim.json`),
  ]).then(([image, atlas, trim]) => {
    if (!image || !atlas) return;
    const frameKeys = Object.keys(atlas.frames).sort((a, b) => Number(a) - Number(b));
    if (!SpriteAnims[character]) SpriteAnims[character] = {};
    // AutoSprite emits two atlas shapes. The character packs use a flat
    // frame ({x,y,w,h}) plus meta.frame_size/duration_s; newer exports use
    // the TexturePacker-style nested {frame:{x,y,w,h}} and omit both meta
    // fields. Normalise here so everything downstream sees one shape,
    // rather than teaching every consumer about the difference.
    const frames = frameKeys.map((k) => {
      const f = atlas.frames[k];
      return f.frame ? f.frame : f;
    });
    const frameSize = atlas.meta.frame_size
      || (frames.length ? { w: frames[0].w, h: frames[0].h } : null);
    SpriteAnims[character][action] = {
      image,
      frames,
      frameSize,
      durationS: atlas.meta.duration_s || 1,
      trim: trim || null,
    };
  });
}

// Whether a clip folder actually exists on disk.
//
// The manifest is generated from the art itself
// (scripts/build-sprite-manifest.py). Consulting it means a clip that was
// never drawn costs nothing, instead of a request that 404s -- which is
// free on localhost and emphatically not over a network: the deployed game
// spent 120 of its 441 requests on misses, at roughly 1.3 seconds each,
// with the loading gate waiting on every one.
//
// Falls back to "try it and see" when the manifest is absent, so the game
// still works if the file has not been generated.
function spriteClipExists(character, dir) {
  if (typeof SpriteManifest === 'undefined') return true;
  const clips = SpriteManifest[character];
  if (!clips) return false;
  // `dir` is '<character>_sprites/<clip>'; the manifest keys on the clip.
  const clip = dir.slice(dir.indexOf('/') + 1);
  return clips.includes(clip);
}

// Who each page actually needs.
//
// The packs total 17MB across 102 sheets, and the loading gate waits for
// every one before the game starts. Most of that is not used by the page
// waiting on it: the level was downloading giox (11.4MB, arena-only), the
// boxing sack and the bonus-stage car before it would let anyone play --
// roughly 12MB of the 17 spent on art that never appears.
//
// Listing the cast per page rather than loading the roster is the single
// biggest thing that makes the deployed game start quickly.
// Everything a level shows. ALL of it loads before play starts.
//
// Streaming art in during play was tried and is worse than the wait it
// saves: a boss that pops in mid-approach, an animation that hitches the
// first time it plays, a transformation that arrives as a stick figure.
// A game that stutters is worse than a game that takes a moment to open,
// so the loading screen holds until every sheet this level needs is in
// memory -- and the service worker means that happens once per device, not
// once per visit.
const LEVEL_CHARACTERS = [
  // The player, and the skin he transforms into.
  'gere', 'supergere',
  // The street, and the boss at the end of it.
  'minion', 'bananana', 'boss1',
];
// The cutscene and story-scene cast. Deliberately NOT in the gate above:
// roger and meeottee are ~17MB of sheets between them, and holding the
// level's start on art that only the opening cutscene uses is most of what
// made the deployed game take eight seconds to become playable. These load
// in the background and the cutscene waits for them itself.
const STORY_CHARACTERS = ['roger', 'meeottee', 'carla'];
const ARENA_CHARACTERS = ['gere', 'supergere', 'giox', 'minion', 'boss1'];
const ARENA_PROPS = ['boxingsack', 'car'];

// The clips gameplay actually draws.
//
// PLAYER_ANIM_MAP and the EnemyTypes maps between them reference ten clips;
// the canonical action list is longer because it also covers cosmetics
// (dance, victory, wave, relaxed) and reaction clips the level never plays.
// Those are whole spritesheets -- 100-300KB each -- downloaded before the
// game would start, for poses nobody sees during a fight.
//
// The cutscene and the story scenes DO use some of them, which is why this
// is a per-call filter rather than a change to CANONICAL_ACTIONS: the story
// cast loads with its own list (see STORY_CLIPS).
const GAMEPLAY_CLIPS = [
  'idle_right', 'walk_right', 'run_right', 'jump_right',
  'punch', 'kick', 'heavy', 'roll', 'hurt', 'fall',
];
// What the cutscene and the between-level scenes stage. drawIntroCharacter
// maps its poses onto these.
const STORY_CLIPS = [
  'idle_right', 'walk_right', 'run_right',
  'punch', 'heavy', 'hurt', 'fall', 'victory', 'relaxed',
];


// Called once per sheet as it lands, so a caller can drive a real progress
// bar. Set by the page; ignored when absent.
let onSpriteLoaded = null;
function setSpriteProgressCallback(fn) {
  onSpriteLoaded = fn;
}

// Loads the sheets for a named cast. `characters` is a list of character
// keys; `props` a list of prop-pack keys; `clips` restricts which actions
// are fetched. Omitting them loads everything, which is what an unknown
// caller should get.
//
// Returns a promise that also carries `count`: how many sheets it is
// fetching, so the caller can size a progress bar before any arrive.
function loadAssets(characters = null, props = null, clips = null) {
  const sheetPromises = [];
  const packs = {};
  const wantChars = characters || Object.keys(CharacterSpriteSheets);
  for (const character of wantChars) {
    if (CharacterSpriteSheets[character]) {
      packs[character] = CharacterSpriteSheets[character];
    }
  }
  const wantProps = props || Object.keys(PropSpriteSheets);
  for (const prop of wantProps) {
    if (PropSpriteSheets[prop]) packs[prop] = PropSpriteSheets[prop];
  }
  for (const [character, actions] of Object.entries(packs)) {
    for (const [action, dir] of Object.entries(actions)) {
      // Props declare only the clips they have, so they are never filtered:
      // a prop's single clip IS its gameplay clip.
      if (clips && CharacterSpriteSheets[character] && !clips.includes(action)) continue;
      if (!spriteClipExists(character, dir)) continue;
      sheetPromises.push(
        loadSpriteSheet(character, action, dir).then((r) => {
          if (onSpriteLoaded) onSpriteLoaded();
          return r;
        }),
      );
    }
  }
  const all = Promise.all(sheetPromises);
  all.count = sheetPromises.length;
  return all;
}

// Returns the frame closest to `t` (0..1 normalized progress through the
// clip), or null if the character/action sheet isn't loaded (caller should
// fall back to procedural drawing).
//
// Without trim data the result is the raw grid tile: { image, sx, sy, sw,
// sh, offsetX: 0, lift: 0 }. With it (see scripts/build-sprite-trim.py):
//
//   * sx/sy/sw/sh are tightened to the character's actual pixels, so the
//     box's bottom edge is the character's feet — callers anchor there,
//     which stops clips from hovering at different heights in their tiles.
//   * `lift` is how far this frame's feet sit above the clip's own ground
//     line. Airborne frames encode real vertical motion this way (gere's
//     jump rises 72px), so it must be preserved — anchoring every frame
//     flat to the ground would pin a jumping character to the floor.
//   * `offsetX` re-centres the trimmed box against the tile's centre so a
//     pose that leans left/right doesn't teleport the character sideways.
//
// Sprites are drawn at their authored size: trim.json's `scale` (which
// would normalise every clip to a common character height) is deliberately
// NOT applied — the size differences between clips are a source-art issue
// to be fixed in the sprite sheets themselves, not compensated for here.
function getSpriteFrame(character, action, t) {
  const anim = SpriteAnims[character] && SpriteAnims[character][action];
  // `frames` is guarded rather than assumed: a sheet whose atlas.json is
  // malformed still lands in SpriteAnims, and hasAction() only checks that
  // the entry exists — so a bad atlas would otherwise crash the draw loop
  // every frame instead of falling back to procedural drawing.
  if (!anim || !anim.frames || anim.frames.length === 0) return null;
  const idx = Math.min(anim.frames.length - 1, Math.floor(clamp(t, 0, 0.999) * anim.frames.length));
  const f = anim.frames[idx];

  const trim = anim.trim && anim.trim.frames && anim.trim.frames[String(idx)];
  if (!trim) {
    return { image: anim.image, sx: f.x, sy: f.y, sw: f.w, sh: f.h, offsetX: 0, lift: 0 };
  }
  return {
    image: anim.image,
    sx: f.x + trim.x,
    sy: f.y + trim.y,
    sw: trim.w,
    sh: trim.h,
    offsetX: (trim.x + trim.w / 2) - f.w / 2,
    lift: trim.lift || 0,
  };
}
