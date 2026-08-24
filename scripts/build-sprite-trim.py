#!/usr/bin/env python3
"""Precompute per-frame trim data for every AutoSprite sheet.

NOTE ON SOURCE ART: a hand-packed sheet that gets repacked into a uniform
grid must be repacked to a NEW file -- keep the artist's original alongside
it (conventionally `_source.png` in the pack folder, which this script
ignores because it lives outside a clip directory). Overwriting the
original in place destroys the only copy of any sprite the repack did not
carry across, such as debris and impact FX.


AutoSprite's atlas.json only records the uniform grid slicing (every frame
is a 256x256 tile at a fixed x/y). It carries no trim box, no source size
and no pivot, so the renderer has no way to know two things that differ
per clip:

  1. The character is drawn at different scales in different clips. For
     gere, idle is ~204px tall inside its tile while run is only ~146px --
     roughly 26% smaller for the same standing height.
  2. The character's feet don't sit at a consistent height inside the
     tile. idle's feet land at y=235, run's float around y=192-208. Drawing
     every tile bottom-anchored therefore makes some clips hover.

AutoSprite's own preview hides both because it frames each clip on the
character's bounding box. Anything that renders the raw tile (our canvas
renderer) shows them as size popping and vertical jitter between actions.

This script derives the missing data straight from the pixels -- frame
bounding boxes are unambiguous, unlike the head-width/pixel-area proxies
that capes and outstretched limbs corrupt -- and writes a trim.json beside
each atlas.json:

    {
      "reference_height": 204.0,     # this character's baseline (idle)
      "clip_height": 146.0,          # this clip's representative height
      "scale": 1.397,                # multiply drawn size by this
      "frames": {
        "0": {"x":56,"y":53,"w":98,"h":140,"baseline":208},
        ...
      }
    }

`scale` normalises the clip so the character matches the character's
reference height, and each frame's `baseline` (bbox bottom) lets the
renderer plant feet on a common line instead of the tile edge.

Usage:
    python3 scripts/build-sprite-trim.py            # write trim.json files
    python3 scripts/build-sprite-trim.py --check    # report, write nothing
"""

import json
import os
import statistics
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required: pip install pillow")

RELEASE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "web", "assets", "release"
)
ALPHA_CUTOFF = 40

# Clips whose pose is close enough to standing that their height is a fair
# proxy for the character's true scale. Attack/knockdown/airborne clips
# crouch, lunge or tuck, so their raw height says nothing about scale.
# Matched case-insensitively: not every character's folders use the same
# casing (supergere's are "Punch"/"Roll"/"Hurt" where gere's are lowercase),
# and a casing mismatch here would silently misclassify a tucked clip as
# upright and blow it up to standing height.
UPRIGHT_CLIPS = ("idle_right", "walk_right", "victory", "wave", "hit_react")

# Height only measures drawing scale for upright poses. These clips are
# horizontal, prone or tucked by design -- roll is a seated slide, fall and
# dash are lunges -- so their bounding box is short because of the pose,
# not because the character was drawn smaller. Correcting them by height
# would blow them up (gere/roll measured 1.73x, boss1/fall 1.70x), so they
# are left unscaled and only get baseline alignment.
POSE_SHORTENED_CLIPS = ("roll", "fall", "dash", "hurt", "ko")


def is_upright(clip_name):
    return clip_name.lower() in UPRIGHT_CLIPS


def is_pose_shortened(clip_name):
    return clip_name.lower() in POSE_SHORTENED_CLIPS


def frame_boxes(sheet_path, frame_w, frame_h, cols, rows):
    """Bounding box of the opaque pixels in every frame, in tile-local coords.

    Tiles are not necessarily square: a sheet of side-on cars, for instance,
    is far wider than it is tall, so width and height are tracked separately
    rather than assuming one `frame_size` for both.
    """
    img = Image.open(sheet_path).convert("RGBA")
    alpha = img.split()[3]
    boxes = {}
    for index in range(cols * rows):
        col, row = index % cols, index // cols
        x0, y0 = col * frame_w, row * frame_h
        tile = alpha.crop((x0, y0, x0 + frame_w, y0 + frame_h))
        # point() thresholds alpha so getbbox() ignores near-transparent
        # antialiasing fringes that would otherwise inflate every box.
        bbox = tile.point(lambda a: 255 if a > ALPHA_CUTOFF else 0).getbbox()
        if bbox:
            boxes[index] = bbox
    return boxes


def representative_height(boxes):
    """Median opaque height -- robust to the odd frame that leaves the tile.

    Uses the lower half of the per-frame heights: a clip's tallest frames
    are usually the ones where a raised arm, cape or prop (giox's victory
    racket, for instance) sticks out past the head, which inflates the box
    without the character actually being drawn any bigger.
    """
    heights = sorted(b[3] - b[1] for b in boxes.values())
    if not heights:
        return None
    lower = heights[: max(1, len(heights) // 2)]
    return statistics.median(lower)


def clip_dirs(char_dir):
    for name in sorted(os.listdir(char_dir)):
        path = os.path.join(char_dir, name)
        if os.path.isfile(os.path.join(path, "spritesheet.png")):
            yield name, path


def main():
    check_only = "--check" in sys.argv
    if not os.path.isdir(RELEASE):
        sys.exit("not found: %s" % RELEASE)

    for char_name in sorted(os.listdir(RELEASE)):
        char_dir = os.path.join(RELEASE, char_name)
        if not os.path.isdir(char_dir) or not char_name.endswith("_sprites"):
            continue

        clips = {}
        for clip_name, clip_path in clip_dirs(char_dir):
            atlas = json.load(open(os.path.join(clip_path, "atlas.json")))
            meta = atlas["meta"]
            # Newer AutoSprite exports omit meta.frame_size and nest each
            # frame under a "frame" key. Fall back to the first frame's own
            # width, which is the tile size for these uniform-grid atlases.
            if "frame_size" in meta:
                frame_w = meta["frame_size"]["w"]
                frame_h = meta["frame_size"].get("h", frame_w)
            else:
                first = atlas["frames"][sorted(atlas["frames"], key=int)[0]]
                first = first.get("frame") or first
                frame_w, frame_h = first["w"], first["h"]
            cols = meta["size"]["w"] // frame_w
            rows = meta["size"]["h"] // frame_h
            boxes = frame_boxes(
                os.path.join(clip_path, "spritesheet.png"),
                frame_w, frame_h, cols, rows,
            )
            if not boxes:
                continue
            clips[clip_name] = {
                "path": clip_path,
                "boxes": boxes,
                "height": representative_height(boxes),
            }

        if not clips:
            continue

        # The character's true scale comes from upright clips only; if a
        # character has none (every clip is an action), fall back to the
        # tallest clip so scaling is at least self-consistent.
        upright = {n: c["height"] for n, c in clips.items() if is_upright(n)}
        reference = (
            statistics.median(upright.values())
            if upright
            else max(c["height"] for c in clips.values())
        )

        # The character's standing baseline: where the feet rest when simply
        # stood on the floor. Taken as the median over the upright clips'
        # own lowest points, so one odd frame in one clip cannot shift it.
        # This is what `lift` is measured against (see below), which keeps a
        # grounded clip grounded even when its feet never quite reach that
        # clip's own extreme.
        upright_grounds = [
            max(by1 for (_, _, _, by1) in clips[n]["boxes"].values())
            for n in clips
            if is_upright(n)
        ]
        standing_baseline = (
            int(statistics.median(upright_grounds)) if upright_grounds else None
        )

        print("=== %s (reference height %.1f) ===" % (char_name, reference))
        # If the upright clips themselves disagree, the reference is a guess
        # and every scale derived from it inherits that error -- worth seeing
        # rather than silently baking in.
        if len(upright) > 1:
            spread = max(upright.values()) / min(upright.values())
            if spread > 1.08:
                print(
                    "  !! upright clips disagree by %.0f%% (%s)"
                    % (
                        (spread - 1) * 100,
                        ", ".join(
                            "%s=%.0f" % (n, h) for n, h in sorted(upright.items())
                        ),
                    )
                )
                print("     reference is unreliable; source art needs a consistent export")
        for clip_name in sorted(clips):
            clip = clips[clip_name]
            if is_pose_shortened(clip_name):
                scale = 1.0
                note = "  (pose-shortened, not rescaled)"
            elif clip["height"]:
                scale = reference / clip["height"]
                note = "  <== rescaled" if abs(scale - 1) > 0.04 else ""
            else:
                scale, note = 1.0, ""
            print(
                "  %-26s height=%6.1f  scale=%5.3f%s"
                % (clip_name, clip["height"], scale, note)
            )

            if check_only:
                continue

            # The clip's ground line, which `lift` is measured against.
            #
            # Using this clip's own lowest point (max by1) is wrong for any
            # clip whose feet never return to the standing baseline: one
            # outlier frame -- a lunge, a low cape sweep -- then defines the
            # floor and every *other* frame is reported as airborne. gere's
            # attack_right is exactly this case: its frames sit at ~213, the
            # same as idle, but a single frame reaching 236 gave the whole
            # clip a ~23px phantom lift, so the character visibly floated
            # up and down while attacking.
            #
            # The character's standing baseline (median over the upright
            # clips) is the stable reference instead. A clip is only treated
            # as leaving the ground when its feet rise above THAT, which is
            # what genuine airborne motion looks like -- jump still encodes
            # its real ~72px rise. Clips that dip below the standing line
            # (crouches, slides) clamp to zero rather than reporting a
            # negative lift.
            ground = standing_baseline if standing_baseline is not None else max(
                by1 for (_, _, _, by1) in clip["boxes"].values()
            )

            frames = {}
            for index, (bx0, by0, bx1, by1) in sorted(clip["boxes"].items()):
                frames[str(index)] = {
                    "x": bx0,
                    "y": by0,
                    "w": bx1 - bx0,
                    "h": by1 - by0,
                    "baseline": by1,
                    "lift": max(0, ground - by1),
                }
            payload = {
                "reference_height": round(reference, 2),
                "clip_height": round(clip["height"], 2),
                "scale": round(scale, 4),
                "ground": ground,
                "frames": frames,
            }
            with open(os.path.join(clip["path"], "trim.json"), "w") as fh:
                json.dump(payload, fh, indent=2)
                fh.write("\n")
        print()

    if check_only:
        print("--check: no files written")


if __name__ == "__main__":
    main()
