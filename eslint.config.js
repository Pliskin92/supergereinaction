module.exports = [
  {
    // Vendored third-party builds (e.g. Phaser) aren't project source —
    // linting a minified bundle is both wasteful and produces false
    // positives from patterns that are fine in generated code.
    ignores: ['web/js/vendor/**'],
  },
  {
    files: ['web/js/**/*.js', '.lint-bundle/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly',
        document: 'readonly',
        requestAnimationFrame: 'readonly',
        console: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        Image: 'readonly',
        Promise: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'error',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-args': 'error',
      'no-func-assign': 'error',
      'no-fallthrough': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error',
    },
  },
  {
    // The real source files are loaded as plain <script> tags sharing one
    // global scope (sprites.js -> entities.js -> levels.js -> game.js), so
    // cross-file references there are expected, not undefined-variable
    // bugs. `no-undef` is only meaningful against the concatenated bundle
    // (see scripts.lint in package.json), so it's disabled on the raw
    // per-file sources to avoid false positives.
    files: ['web/js/**/*.js'],
    rules: {
      'no-undef': 'off',
    },
  },
];
