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

1. Grandma Carla's Kitchen
2. Grandpa Gastone's Garage
3. Uncle Mattia's Workshop (unlocks Uncle Mattia assist)
4. Uncle Michele's Yard (unlocks Uncle Michele assist)
5. Showdown with Boss Luigi
6. Final Rescue: Mario, Wario & Bowser

Build fury by fighting to trigger **Platinum State** — a temporary
transformation (white hair, glowing eyes) that lets you call in an unlocked
Uncle for a timed assist attack.

## Art

[assets/](assets/) holds real artwork cropped directly from the project's
`textures.jpeg` character sheet: the hero portrait (menu screen), two HUD
face expressions (normal and Platinum State), and all 4 frames of Gere's
knee-slide animation. Everything else — walk/punch/idle/hurt poses and the
whole enemy cast — is still procedurally drawn in [js/sprites.js](js/sprites.js),
since the source sheet only covers Super Gere in those specific poses.
[js/assets.js](js/assets.js) loads these images asynchronously and the game
falls back to vector drawing automatically for anything not (yet) loaded, so
a slow or failed image load never blocks or crashes the game.

### Generating new sprites

[scripts/generate-sprite.js](../scripts/generate-sprite.js) is a dev-time
tool (not used by the game itself) that calls the Stability AI Stable Image
API to generate new character art — useful for the enemy cast, which the
original texture pack doesn't cover.

```bash
cp .env.example .env   # then fill in STABILITY_API_KEY (get a free key at
                        # https://platform.stability.ai/account/keys)
node --env-file=.env scripts/generate-sprite.js \
  "Grandma Carla, angry cartoon villain, side view" grandma_carla_idle
```

Output lands in `scripts/generated/` (gitignored) as a raw PNG. Review it,
crop/clean it up the same way the `textures.jpeg` frames were processed, and
move the result into [assets/](assets/) before wiring it into the game.

## Code layout

- [js/sprites.js](js/sprites.js) — procedural vector-drawn character
  rendering (used as a fallback and for everything the texture pack doesn't
  cover)
- [js/assets.js](js/assets.js) — loads the real cropped artwork from
  [assets/](assets/)
- [js/entities.js](js/entities.js) — Player, Enemy, and AssistSystem game
  logic
- [js/levels.js](js/levels.js) — level/wave definitions and runtime
- [js/game.js](js/game.js) — main loop, input, HUD, menu/shop/game-over
  states
