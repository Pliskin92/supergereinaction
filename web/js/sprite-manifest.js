// GENERATED FILE -- do not edit by hand.
//
// Run scripts/build-sprite-manifest.py to regenerate. CI checks that this
// is current (see .github/workflows/ci.yml), so an added sprite folder that
// is not reflected here fails the build rather than silently not loading.
//
// This is the list of clip folders that ACTUALLY EXIST on disk, per
// character. assets.js consults it before requesting anything, so the game
// never asks the server for a clip that was never drawn.
//
// Why it exists: the loader used to request every canonical action for
// every character and let the misses 404. The deployed game made 441
// requests, 120 of them 404s, at ~1.3s each over the network -- and the
// loading gate waits on all of them. That was eight seconds of staring at a
// loading bar for files that do not exist.

const SpriteManifest = {
  "bananana": [
    "Fall",
    "Hit React",
    "Hurt",
    "Kick",
    "Punch",
    "attack_right",
    "idle_right",
    "jump_right",
    "run_right",
    "walk_right"
  ],
  "boss1": [
    "fall",
    "heavy",
    "idle_right",
    "kick",
    "punch",
    "run_right",
    "walk_right"
  ],
  "boxingsack": [
    "swing"
  ],
  "car": [
    "damage",
    "fx"
  ],
  "carla": [
    "victory",
    "walk_right",
    "wave"
  ],
  "gere": [
    "Dance",
    "Dash",
    "Fall",
    "Hit React",
    "Hurt",
    "Kick",
    "Punch",
    "Roll",
    "Victory",
    "attack_right",
    "idle_right",
    "jump_right",
    "relaxed",
    "run_right",
    "walk_right"
  ],
  "giox": [
    "Ranged Tennis Ball smash",
    "Tennis racket smash",
    "dance",
    "fall",
    "heavy",
    "hit_react",
    "hurt",
    "idle_right",
    "jump_right",
    "kick",
    "punch",
    "roll",
    "run_right",
    "victory",
    "walk_right",
    "wave"
  ],
  "meeottee": [
    "Dance",
    "Fall",
    "Hit React",
    "Hurt",
    "Kick",
    "Punch",
    "Victory",
    "attack_right",
    "idle_right",
    "jump_right",
    "run_right",
    "walk_right"
  ],
  "minion": [
    "Hit React",
    "Hurt",
    "fall",
    "heavy",
    "idle_right",
    "jump_right",
    "kick",
    "punch",
    "run_right",
    "walk_right"
  ],
  "roger": [
    "Dance",
    "Fall",
    "Hit React",
    "Hurt",
    "Kick",
    "Punch",
    "Roll",
    "attack_right",
    "idle_right",
    "jump_right",
    "run_right",
    "walk_right"
  ],
  "supergere": [
    "Dance",
    "Dash",
    "Fall",
    "Hit React",
    "Hurt",
    "Kick",
    "Punch",
    "Roll",
    "Victory",
    "attack_right",
    "idle_right",
    "jump_right",
    "run_right",
    "walk_right"
  ]
};
