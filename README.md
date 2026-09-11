# Super Gere: Parise Rescue

A 2D side-scrolling beat-em-up featuring Super Gere on a mission to rescue his family from a gauntlet of enemies across six story levels. Built with **pure HTML5 Canvas and vanilla JavaScript** — no build step, no framework dependencies, no compilation required.

## Overview

Super Gere must fight through waves of enemies to rescue his beloved family members:
- **Grandma Carla** from her street
- **Grandpa Gastone** from his garage  
- **Uncle Mattia** from his workshop
- **Uncle Michele** from his yard
- Face the **Boss Luigi** showdown
- The final rescue: **Mario, Wario & Bowser**

Originally designed as a PS1 (PSn00bSDK) title, this project was adapted to the web for fast iteration without needing a MIPS cross-compiler, BIOS, or emulator.

## Quick Start

### Play in Browser

No installation needed! Open the game directly:

```bash
cd web
python3 -m http.server 8080
# then open http://localhost:8080 in your browser
```

Or simply open `web/index.html` directly in any modern browser.

### Run with Docker

Pull the published image (no build needed):

```bash
docker run -p 8080:80 ghcr.io/pliskin92/supergereinaction:latest
# then open http://localhost:8080
```

Or build it yourself:

```bash
docker build -t super-gere .
docker run -p 8080:80 super-gere
```

## Publishing

`.github/workflows/publish.yml` runs on every push to `main` and does two
things:

- **GitHub Pages** — deploys `web/` as the playable site, minus
  `web/assets/private/` (~200MB of working art, which is tracked in git and
  would otherwise be published: Pages is public even from a private repo).
  A guard fails the deploy if shipping code ever references that path. The source is
  written for a domain root (`<base href="/">` and absolute links), so the
  workflow rewrites those to the project subpath at deploy time. That is
  done in the workflow rather than in the source because the game navigates
  between directories at different depths, where relative paths that work
  from one break from the other — and because the Docker image and
  `python3 -m http.server` really are served from a root.
- **ghcr.io** — builds and pushes the container image for `linux/amd64` and
  `linux/arm64`, tagged `latest` and with the commit SHA.

Neither needs a secret: Pages uses OIDC and ghcr.io uses the built-in
`GITHUB_TOKEN`.

**One-time setup** — in the repo's *Settings → Pages*, set **Source** to
**GitHub Actions**. Until that is done the Pages job fails; the image job is
unaffected.

## Controls

| Action | Keys |
|--------|------|
| **Move** | Arrow Keys or WASD |
| **Jump** | Space |
| **Punch Combo (punch-punch-kick)** | J |
| **Roll** | K |
| **Heavy Attack** | L |
| **Pause** | P |
| **Confirm / Buy in Shop** | Enter |
| **Leave Shop** | Escape |

## Mobile

The game plays on phones and tablets. Open the same URL in a mobile browser:
an on-screen pad appears on touch devices, the canvas fills the screen, and
in portrait the game asks to be turned (it is a wide side-scroller). Nothing
changes on desktop — the pad is gated on `(pointer: coarse)`, so a narrow
desktop window keeps its keyboard and its layout.

It is also an installable PWA (`web/manifest.webmanifest`) — "Add to Home
Screen" launches it fullscreen in landscape with no browser chrome.

| Touch | Action |
|---|---|
| **D-pad** (bottom left) | Move |
| **A** | Punch combo |
| **B** | Roll |
| **C** | Heavy attack |
| **⇑** | Jump |
| **☰** (bottom centre) | Back to menu |

On menus, cutscenes and summaries the pad drives the existing keyboard
handlers by dispatching synthetic key events, so those screens needed no
touch-specific code (see `web/js/touch.js`).

## Campaign

**New Game** starts a six-level run. The score, the lives you have left and
the family you have rescued carry from one level to the next; the run is
remembered for the browser tab, so **Continue** appears on the title screen
while one is part-played. Only finishing the whole run writes to the
highscore table — a run abandoned partway is not recorded.

Levels are described by a single table, `web/js/campaign.js`: backdrop,
walkable band, length, roster, pack sizes, boss and who is rescued. Adding
a level is a row there, not another copy of `level.js`.

Levels 2-6 are fully playable but still borrow level 1's street art, and
share its boss. See [ART-TODO.md](ART-TODO.md) for what is missing and how
to drop it in — every slot has a working fallback, so art can be added one
piece at a time.

To jump straight to a level while testing:

```
/level/index.html?level=4
```

## Story & Levels

1. **Grandma Carla's Street** — Battle through robotic minions down a progressively advancing street toward Grandma's flower-covered house
2. **Grandpa Gastone's Garage** — Face enemies in the garage setting
3. **Uncle Mattia's Workshop** — Unlock Uncle Mattia as an assist character
4. **Uncle Michele's Yard** — Unlock Uncle Michele as an assist character
5. **Showdown with Boss Luigi** — Epic battle against the main antagonist
6. **Final Rescue** — Confront Mario, Wario & Bowser in the ultimate rescue mission

### Level Structure

- Family members are **rescued, not fought** — victory requires reaching them safely after defeating the level's enemies
- Clearing a level boss isn't enough; you must reach the family member to trigger the rescue sequence and unlock the shop/next level
- Level 1 has been fully reworked with the rescue structure; Levels 2-6 maintain the original layout and are planned for future updates

## Project Structure

```
supergereinaction/
├── web/                    # Main game application
│   ├── index.html         # Entry point
│   ├── js/                # Game logic and mechanics
│   ├── assets/            # Sprites, backgrounds, audio
│   └── README.md          # Web-specific documentation
├── scripts/               # Build and utility scripts
│   ├── build-lint-bundle.js
│   ├── docker-run.sh
│   └── generate-sprite.js
├── package.json           # Project metadata and lint configuration
├── Dockerfile             # Docker containerization
├── eslint.config.js       # Code quality rules
└── .env.example           # Environment variable template
```

## Development

### Linting

Check code quality with ESLint:

```bash
npm run lint           # Run all linting checks
npm run lint:bundle   # Check bundled output specifically
```

### Building Assets

Generate sprite sheets and assets:

```bash
node scripts/generate-sprite.js
```

### Environment Setup

Copy the environment template to get started:

```bash
cp .env.example .env
```

## Tech Stack

- **Engine**: HTML5 Canvas
- **Language**: Vanilla JavaScript (ES6+)
- **Build**: No build step required
- **Linting**: ESLint
- **Containerization**: Docker
- **Deployment**: Static file hosting (HTTP server)

## Browser Requirements

- Modern browser with HTML5 Canvas support
- JavaScript ES6+ support
- Recommended: Chrome, Firefox, Safari, or Edge (latest versions)

## Features

✨ **No Dependencies** — Pure JavaScript, no npm packages for the game  
🎮 **Retro Pixel Art** — Authentic beat-em-up aesthetic  
🎵 **Dynamic Gameplay** — Multiple levels, enemies, and assist mechanics  
⚡ **Fast Loading** — Instant play, no build compilation  
🐳 **Docker Ready** — One-command deployment  
📱 **Responsive Canvas** — Scales to fill browser window

## Contributing

We welcome contributions! Areas for improvement:

- Completing Levels 2-6 with full rescue structure
- Additional enemy designs and AI behaviors
- Audio and music implementation
- Mobile touch controls
- Difficulty settings and balance adjustments

Please open an issue or submit a pull request to help bring Super Gere's adventure to life!

## License

(Add appropriate license here)

## Credits

**Game Design & Development**: The Super Gere Team  
**Original Concept**: PS1-era beat-em-up inspired by arcade classics  
**Web Adaptation**: Modern browser gaming

