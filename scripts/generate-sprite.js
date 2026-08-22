#!/usr/bin/env node
// Dev-time sprite generation via the Stability AI Stable Image "core" API.
// Not used by the game itself — this is a one-off asset pipeline: run it,
// review the output, crop/clean it up, then commit the result into
// web/assets/ the same way the textures.jpeg crops were added.
//
// Usage:
//   export STABILITY_API_KEY=sk-...
//   node scripts/generate-sprite.js "Grandma Carla, angry cartoon villain, side view" grandma_carla_idle
//
// Or keep the key in .env (see .env.example) and use Node's built-in loader:
//   node --env-file=.env scripts/generate-sprite.js "..." grandma_carla_idle
//
// Output lands in scripts/generated/ (gitignored) as a raw PNG — review it
// before moving/cropping it into web/assets/.

'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const API_URL = 'https://api.stability.ai/v2beta/stable-image/generate/core';
const OUT_DIR = path.join(__dirname, 'generated');

const STYLE_SUFFIXES = {
  // Character sprites: matches the flat cel-shaded look of the original
  // textures.jpeg pack (rounded, kid-friendly superhero comic style).
  sprite:
    ', flat cel-shaded cartoon illustration, bold black outlines, ' +
    'vibrant flat colors, children\'s superhero comic style, plain white background, ' +
    'full body, clean vector-like linework',
  // Level backgrounds: wide side-scrolling beat-em-up scene, no characters.
  background:
    ', flat cel-shaded cartoon illustration background art, bold black outlines, ' +
    'vibrant flat colors, children\'s superhero comic style, side-scrolling beat-em-up ' +
    'stage background, wide indoor scene, no characters, no people, empty scene, ' +
    'clean vector-like linework, slight perspective',
};

function parseArgs(argv) {
  const [, , prompt, name, ...rest] = argv;
  if (!prompt || !name) {
    console.error('Usage: node scripts/generate-sprite.js "<prompt>" <output-name> [--aspect 1:1] [--negative "..."] [--style sprite|background]');
    process.exit(1);
  }
  const opts = { aspect_ratio: '1:1', negative_prompt: '', style: 'sprite' };
  for (let i = 0; i < rest.length; i += 2) {
    if (rest[i] === '--aspect') opts.aspect_ratio = rest[i + 1];
    if (rest[i] === '--negative') opts.negative_prompt = rest[i + 1];
    if (rest[i] === '--style') opts.style = rest[i + 1];
  }
  if (!STYLE_SUFFIXES[opts.style]) {
    console.error(`Unknown --style "${opts.style}". Valid options: ${Object.keys(STYLE_SUFFIXES).join(', ')}`);
    process.exit(1);
  }
  return { prompt, name, opts };
}

function buildMultipartBody(fields) {
  const boundary = '----SuperGereSpriteGen' + Date.now();
  const parts = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === '') continue;
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    );
  }
  parts.push(`--${boundary}--\r\n`);
  return { body: Buffer.from(parts.join(''), 'utf8'), boundary };
}

function generate({ prompt, name, opts }) {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    console.error('Missing STABILITY_API_KEY environment variable.');
    console.error('Get a free key at https://platform.stability.ai/account/keys and export it:');
    console.error('  export STABILITY_API_KEY=sk-...');
    process.exit(1);
  }

  const fullPrompt = prompt + STYLE_SUFFIXES[opts.style];
  const { body, boundary } = buildMultipartBody({
    prompt: fullPrompt,
    negative_prompt: opts.negative_prompt,
    aspect_ratio: opts.aspect_ratio,
    output_format: 'png',
  });

  const url = new URL(API_URL);
  const req = https.request(
    {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'image/*',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    },
    (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';

        if (res.statusCode !== 200) {
          console.error(`Stability API error (HTTP ${res.statusCode}):`);
          console.error(data.toString('utf8'));
          process.exit(1);
        }

        if (contentType.includes('application/json')) {
          // Shouldn't happen when Accept: image/* succeeds, but handle it
          // in case the API returns a JSON envelope with base64 image data.
          try {
            const json = JSON.parse(data.toString('utf8'));
            if (json.image) {
              writeOutput(Buffer.from(json.image, 'base64'), name);
              return;
            }
          } catch {
            // fall through to error
          }
          console.error('Unexpected JSON response:', data.toString('utf8'));
          process.exit(1);
        }

        writeOutput(data, name);
      });
    }
  );

  req.on('error', (err) => {
    console.error('Request failed:', err.message);
    process.exit(1);
  });

  req.write(body);
  req.end();
}

function writeOutput(buffer, name) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log('Saved', outPath);
  console.log('Review it, then crop/clean up and move it into web/assets/ if it looks good.');
}

generate(parseArgs(process.argv));
