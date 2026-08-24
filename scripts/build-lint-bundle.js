// Concatenates web/js in actual <script> load order so ESLint's no-undef
// check runs against real runtime scope, matching how index.html loads them.
const fs = require('fs');
const path = require('path');

const WEB_JS = path.join(__dirname, '..', 'web', 'js');
const OUT_DIR = path.join(__dirname, '..', '.lint-bundle');

// The two pages load different script sets, so each gets its own bundle:
// a name defined only in game.js must not count as defined when linting
// the arena, which never loads it.
//
// Each list must stay in sync with the <script> tags in its page.
const bundles = {
  // web/index.html — the title screen only; no gameplay modules.
  'bundle.js': ['i18n.js', 'highscores.js', 'title.js', 'game.js'],
  // web/arena/index.html
  // web/level/index.html
  'bundle-level.js': [
    'i18n.js', 'sprites.js', 'assets.js', 'entities.js',
    'fury-hud.js', 'level.js',
  ],
  'bundle-arena.js': [
    'i18n.js', 'sprites.js', 'assets.js', 'entities.js',
    'stages.js', 'fury-hud.js', 'char-arena.js',
  ],
};

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [outName, loadOrder] of Object.entries(bundles)) {
  const bundle = loadOrder
    .map((file) => fs.readFileSync(path.join(WEB_JS, file), 'utf8'))
    .join('\n;\n');
  fs.writeFileSync(path.join(OUT_DIR, outName), bundle);
  console.log('Wrote', path.join(OUT_DIR, outName));
}
