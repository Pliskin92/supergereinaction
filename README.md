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

```bash
docker build -t super-gere .
docker run -p 8080:80 super-gere
# then open http://localhost:8080
```

## Controls

| Action | Keys |
|--------|------|
| **Move** | Arrow Keys or WASD |
| **Punch Combo** | J |
| **Knee Slide** | K |
| **Jump** | Space |
| **Call Uncle Assist** | L (Platinum State only) |
| **Pause** | P |
| **Confirm / Buy in Shop** | Enter |
| **Leave Shop** | Escape |

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

