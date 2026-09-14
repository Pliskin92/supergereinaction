#!/usr/bin/env python3
"""Downscales every sprite sheet, and the atlas/trim data with it.

The sheets were authored as 25 frames of 256x256, 1280x1280 per clip, and
the characters inside are drawn on screen at roughly 150px tall. Every sheet
therefore carries about 70% more pixels than anything ever displays, and
across 62 sheets that is 14.8MB the player downloads before the game opens.

At the default scale a frame tile is 160px against a ~150px draw height --
still above what is displayed, so nothing visibly softens -- and the art
drops to roughly a third of its size.

WHY IT IS DONE THIS WAY. Two obvious approaches make the files BIGGER:

  * Converting to RGBA first. The sheets are already palette-mode ('P') PNGs
    with 8-bit transparency, which is close to optimal for flat-shaded art.
    Converting up to RGBA and re-encoding loses that: the same image comes
    back two to four times larger. The resize here stays in palette mode.

  * Repacking frames to their bounding boxes. Tried, measured: 17MB -> 42MB.
    PNG already compresses the flat transparent padding to almost nothing,
    so removing it saves no bytes while the re-encode loses the original's
    compression.

NEAREST rather than LANCZOS: this is pixel art with hard edges, and a smooth
filter blurs them into the transparent background, which then costs MORE
bytes because the palette fills with intermediate shades.

atlas.json and trim.json are scaled alongside, because getSpriteFrame()
reads tile coordinates from one and the bounding box from the other -- they
must agree with the image or the game draws the wrong rectangle.

Usage:
    python3 scripts/downscale-sprites.py --dry-run   # report only
    python3 scripts/downscale-sprites.py             # do it
"""

import argparse
import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow is required: pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RELEASE = os.path.join(ROOT, 'web', 'assets', 'release')

# 0.625 puts a 256px tile at 160px, against characters drawn at ~150px. Going
# further (0.5 -> 128px tiles) does soften the art at its largest, so this is
# the point that saves the most without the player seeing it.
DEFAULT_SCALE = 0.625


def scale_box(box, scale):
    """Scales a frame rectangle, keeping it inside the resized image."""
    return {
        'x': int(box['x'] * scale),
        'y': int(box['y'] * scale),
        'w': max(1, int(box['w'] * scale)),
        'h': max(1, int(box['h'] * scale)),
    }


def downscale_clip(clip_dir, scale, dry_run):
    sheet_path = os.path.join(clip_dir, 'spritesheet.png')
    atlas_path = os.path.join(clip_dir, 'atlas.json')
    if not (os.path.exists(sheet_path) and os.path.exists(atlas_path)):
        return None

    before = os.path.getsize(sheet_path)
    image = Image.open(sheet_path)
    new_size = (int(image.width * scale), int(image.height * scale))
    if new_size[0] < 1 or new_size[1] < 1:
        return None

    if dry_run:
        # Resize to a temporary file to get a real number rather than an
        # estimate -- the repack attempt failed precisely because its
        # estimate assumed size tracks area, and PNG does not work that way.
        resized = image.resize(new_size, Image.NEAREST)
        tmp = os.path.join(clip_dir, '.size-probe.png')
        resized.save(tmp, optimize=True)
        after = os.path.getsize(tmp)
        os.remove(tmp)
        return (before, after)

    # Stay in palette mode: `image` is already 'P', and resize preserves it.
    image.resize(new_size, Image.NEAREST).save(sheet_path, optimize=True)

    atlas = json.load(open(atlas_path))
    for key, frame in atlas['frames'].items():
        if 'frame' in frame:
            frame['frame'] = scale_box(frame['frame'], scale)
        else:
            atlas['frames'][key] = scale_box(frame, scale)
    meta = atlas.setdefault('meta', {})
    # The sheet's own dimensions, which must follow the image or the
    # metadata quietly describes a file that no longer exists. Nothing in
    # the web game reads this, which is why it was missed the first time --
    # and why it matters now that a Godot importer will trust it.
    if 'size' in meta:
        meta['size'] = {'w': new_size[0], 'h': new_size[1]}
    if 'frame_size' in meta:
        meta['frame_size'] = {
            'w': max(1, int(meta['frame_size']['w'] * scale)),
            'h': max(1, int(meta['frame_size']['h'] * scale)),
        }
    json.dump(atlas, open(atlas_path, 'w'), indent=1)

    trim_path = os.path.join(clip_dir, 'trim.json')
    if os.path.exists(trim_path):
        trim = json.load(open(trim_path))
        for key, box in trim['frames'].items():
            scaled = scale_box(box, scale)
            # `lift` is how far a frame's feet sit above the clip's ground
            # line; it is a distance in the same space, so it scales too --
            # missing this would leave jumps at the wrong height.
            scaled['lift'] = int(box.get('lift', 0) * scale)
            trim['frames'][key] = scaled
        json.dump(trim, open(trim_path, 'w'), indent=1)

    return (before, os.path.getsize(sheet_path))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--scale', type=float, default=DEFAULT_SCALE)
    args = parser.parse_args()

    total_before = total_after = count = 0
    for pack in sorted(os.listdir(RELEASE)):
        if not pack.endswith('_sprites'):
            continue
        pack_dir = os.path.join(RELEASE, pack)
        for clip in sorted(os.listdir(pack_dir)):
            clip_dir = os.path.join(pack_dir, clip)
            if not os.path.isdir(clip_dir):
                continue
            result = downscale_clip(clip_dir, args.scale, args.dry_run)
            if result is None:
                continue
            before, after = result
            total_before += before
            total_after += after
            count += 1

    verb = 'would save' if args.dry_run else 'saved'
    print(f'{count} clips at scale {args.scale}; {verb} '
          f'{(total_before - total_after) / 1048576:.1f} MB '
          f'({total_before / 1048576:.1f} -> {total_after / 1048576:.1f} MB)')


if __name__ == '__main__':
    main()
