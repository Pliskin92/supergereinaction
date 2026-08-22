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

## Code layout

- [js/sprites.js](js/sprites.js) — procedural vector-drawn character
  rendering (no image assets required)
- [js/entities.js](js/entities.js) — Player, Enemy, and AssistSystem game
  logic
- [js/levels.js](js/levels.js) — level/wave definitions and runtime
- [js/game.js](js/game.js) — main loop, input, HUD, menu/shop/game-over
  states
