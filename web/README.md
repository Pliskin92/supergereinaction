# Super Gere: Parise Rescue (Web Build)

A 2D side-scrolling beat-em-up starring Super Gere, rescuing his family from a
gauntlet of enemies across six story levels. Built with plain HTML5 Canvas and
vanilla JavaScript — no build step, no dependencies.

Originally scaffolded as a PS1 (PSn00bSDK) title on the
`copilot/create-super-gere-project-structure` branch; rebuilt for the web to
allow fast iteration without a MIPS cross-compiler, BIOS, or emulator.

## Run it

Just open [index.html](index.html) directly in a browser, or serve the
folder with any static file server, e.g.:

```bash
cd web
python3 -m http.server 8080
# then open http://localhost:8080
```

## Controls

- Move: Arrow Keys / WASD
- Punch combo: J
- Knee slide: K
- Jump: Space
- Call an Uncle assist (Platinum State only): L
- Pause: P
- Confirm / buy in shop: Enter
- Leave shop: Escape

## Story / Levels

1. Grandma Carla's Street
2. Grandpa Gastone's Garage
3. Uncle Mattia's Workshop (unlocks Uncle Mattia assist)
4. Uncle Michele's Yard (unlocks Uncle Michele assist)
5. Showdown with Boss Luigi
6. Final Rescue: Mario, Wario & Bowser

Family members are **rescued, not fought** — level 1 (the only one reworked
so far) fights through waves of a robotic minion and a boss villain (both
original designs, not family members) down a street that visibly progresses
toward Grandma Carla's house across 4 distinct background segments, arriving
at her warm, flower-covered front door in the final one. She appears near
the end of the street once the boss falls; reach her and she's rescued (a
floating "Grandma Carla is safe!" + score bump), which is what actually
unlocks the shop/next-level transition — clearing the boss alone isn't
enough. Levels 2-6 haven't been converted to this rescue structure yet and
still use their original family-member-as-boss design.

Build fury by fighting to trigger **Platinum State** — a temporary
transformation (white hair, glowing eyes) that lets you call in an unlocked
Uncle for a timed assist attack.

## Art

Super Gere is animated with real multi-frame pixel-art sprite sheets from
[assets/gere_sprites/](assets/gere_sprites/) (generated via AutoSprite —
see "Generating sprite sheets" below): idle, walk, run, punch, kick, jump,
roll, hurt, victory, and a special energy-blast attack ("shoot", unlocked
later). Each animation is a `spritesheet.png` (a uniform grid of frames) plus
an `atlas.json` describing each frame's pixel coordinates and the clip's
playback duration — [js/assets.js](js/assets.js) loads both and
[js/entities.js](js/entities.js)'s `Player.getSpriteDraw()` picks the right
frame each tick based on the player's current action and how long they've
been in it.

[assets/](assets/) also holds real artwork cropped directly from the
project's `textures.jpeg` character sheet (the hero portrait shown on the
menu screen, and two HUD face expressions for normal / Platinum State), plus
generated street and shop background art per level (see
"Generating backgrounds" below).

Level 1's enemy cast also has real sprite sheets: [assets/minion_sprites/](assets/minion_sprites/)
(the recurring robotic henchman) and [assets/boss1_sprites/](assets/boss1_sprites/)
(the boss villain, including a `fall` clip that plays on defeat). Grandma
Carla, as a rescued NPC rather than an enemy, has her own smaller set at
[assets/carla_sprites/](assets/carla_sprites/) — `wave` (played on loop while
waiting) and `victory` (once rescued). `EnemyTypes` entries opt into sprite
rendering via `spriteCharacter`/`spriteAnimMap` fields (see
[js/entities.js](js/entities.js)); enemy types without those fields — the
rest of the family-as-boss cast (Grandpa Gastone, the uncles, Boss Luigi,
Mario/Wario/Bowser) — still render through the procedural vector fallback in
[js/sprites.js](js/sprites.js), same as before.

[js/assets.js](js/assets.js) loads all of this asynchronously and the game
falls back to vector drawing automatically for anything not (yet) loaded, so
a slow or failed image load never blocks or crashes the game.

Giovanni (the second playable character) has a full sprite-sheet set saved
at [assets/giovanni_sprites/](assets/giovanni_sprites/) but isn't wired into
gameplay yet — adding a second playable character needs its own
character-select / control-swap work first.

### Generating sprite sheets

Real multi-frame character animation (like Gere's) comes from
[AutoSprite](https://www.autosprite.io), not Stability — Stability's
Stable Image models are illustration generators and don't reliably produce
either genuine pixel art or a consistent multi-frame grid no matter how
they're prompted; AutoSprite is purpose-built for exactly this (upload a
character reference, pick an animation, get back a `spritesheet.png` +
`atlas.json` pair). Its free tier is web-app only; API/MCP access needs a
paid plan. The current workflow is manual: generate a sheet in the
AutoSprite dashboard, download it, and drop the
`<animation>/{spritesheet.png,atlas.json}` folder into
`assets/<character>_sprites/` (matching one of the character keys in
`CharacterSpriteSheets` in [js/assets.js](js/assets.js) — `gere`, `minion`,
`boss1`, `carla`, or a new one) using the same lowercase-with-underscores
naming as the existing folders, then add the action -> folder mapping to
that character's entry in `CharacterSpriteSheets`.

### Generating backgrounds

[scripts/generate-sprite.js](../scripts/generate-sprite.js) is a dev-time
tool (not used by the game itself) that calls the Stability AI Stable Image
API — good for wide scenic backgrounds (streets, shop interiors), which
don't need multi-frame consistency the way character sprites do.

```bash
cp .env.example .env   # then fill in STABILITY_API_KEY (get a free key at
                        # https://platform.stability.ai/account/keys)
node --env-file=.env scripts/generate-sprite.js \
  "quiet residential street, small cozy house" street_example \
  --style background --aspect 16:9
```

Output lands in `scripts/generated/` (gitignored) as a raw PNG. Review it,
then move/rename the result into [assets/](assets/) before wiring it into
the game (see `AssetPaths` in [js/assets.js](js/assets.js)).

A level can use either one repeated background (`LevelDefs[i].bgImage`, a
single key) or a real per-segment progression (`LevelDefs[i].bgImages`, an
array with one key per on-screen segment — see level 1's 4-segment street
in [js/levels.js](js/levels.js) for the pattern). `LevelRuntime.backgroundSegments()`
prefers `bgImages` when present and falls back to repeating `bgImage`
otherwise.

## Code layout

- [js/sprites.js](js/sprites.js) — procedural vector-drawn character
  rendering (used as a fallback and for everything the texture pack doesn't
  cover)
- [js/assets.js](js/assets.js) — loads real artwork and sprite-sheet
  animations from [assets/](assets/)
- [js/entities.js](js/entities.js) — Player, Enemy, and AssistSystem game
  logic
- [js/levels.js](js/levels.js) — level/wave definitions and runtime
- [js/game.js](js/game.js) — main loop, input, HUD, menu/shop/game-over
  states
