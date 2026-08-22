// Concatenates web/js in actual <script> load order so ESLint's no-undef
// check runs against real runtime scope, matching how index.html loads them.
const fs = require('fs');
const path = require('path');

const WEB_JS = path.join(__dirname, '..', 'web', 'js');
const OUT_DIR = path.join(__dirname, '..', '.lint-bundle');

const loadOrder = ['sprites.js', 'entities.js', 'levels.js', 'game.js'];

fs.mkdirSync(OUT_DIR, { recursive: true });

const bundle = loadOrder
  .map((file) => fs.readFileSync(path.join(WEB_JS, file), 'utf8'))
  .join('\n;\n');

fs.writeFileSync(path.join(OUT_DIR, 'bundle.js'), bundle);
console.log('Wrote', path.join(OUT_DIR, 'bundle.js'));
