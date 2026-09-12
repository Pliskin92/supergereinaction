#!/usr/bin/env python3
"""Writes web/js/sprite-manifest.js: which sprite clips actually exist.

Without it the loader asks for every canonical action for every character
and lets the misses 404. On localhost that is free. Over a real network it
is not: the deployed game issued 441 requests, 120 of them 404s, at roughly
1.3 seconds each, and the loading gate waits on all of them -- eight seconds
before the game was playable, for files that were never there.

The manifest is generated rather than hand-written so it cannot drift from
the art: add a clip folder, rerun this, and the loader picks it up. CI
regenerates and diffs it the same way it does trim.json, so a commit that
adds art without rerunning this is caught.

Usage:  python3 scripts/build-sprite-manifest.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE = os.path.join(ROOT, 'web', 'assets', 'release')
OUT = os.path.join(ROOT, 'web', 'js', 'sprite-manifest.js')

HEADER = """// GENERATED FILE -- do not edit by hand.
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

"""


def main():
    manifest = {}
    for entry in sorted(os.listdir(RELEASE)):
        if not entry.endswith('_sprites'):
            continue
        character = entry[: -len('_sprites')]
        pack = os.path.join(RELEASE, entry)
        clips = []
        for clip in sorted(os.listdir(pack)):
            clip_dir = os.path.join(pack, clip)
            # A clip is real only if it has an atlas: the loader needs the
            # atlas to make sense of the sheet, and skips the pair without
            # it anyway.
            if os.path.isdir(clip_dir) and os.path.exists(
                os.path.join(clip_dir, 'atlas.json')
            ):
                clips.append(clip)
        if clips:
            manifest[character] = clips

    body = json.dumps(manifest, indent=2, sort_keys=True)
    with open(OUT, 'w') as handle:
        handle.write(HEADER)
        handle.write('const SpriteManifest = ')
        handle.write(body)
        handle.write(';\n')

    total = sum(len(v) for v in manifest.values())
    print(f'Wrote {OUT}: {len(manifest)} characters, {total} clips')


if __name__ == '__main__':
    main()
