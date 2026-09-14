# Super Gere — Godot rewrite

A rewrite of the game in Godot 4.3, targeting the Play Store.

The JavaScript version it replaces is complete, playable and tagged
**`v1.0-js`** — `git checkout v1.0-js` brings it back whole. Nothing here
deletes it.

## Why this exists

The web version worked and was fast once loaded (median frame gap 1.7ms,
no frame in 300 over 20ms). What it could not escape was shipping ~7MB of
sprite art over a network before anyone could play. Packaged as an app that
cost is paid once at install, where players expect it.

## Running it

```bash
# The editor, to see and play the game
godot4 --path godot

# The test suite, headless — no display needed
godot4 --headless --path godot --script tests/test_runner.gd
```

The first run on a fresh clone needs an import pass, which builds the
`class_name` registry the scripts resolve against:

```bash
godot4 --headless --path godot --import
```

Without it every suite fails with `Identifier "Config" not declared`.

## Installing Godot

Get 4.3 from [godotengine.org/download](https://godotengine.org/download).
It is a single executable — no installer.

```bash
curl -sL -o godot4.zip \
  https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
unzip godot4.zip
sudo install -m755 Godot_v4.3-stable_linux.x86_64 /usr/local/bin/godot4
```

**Not `apt install godot3`** — that is Godot 3, a different engine with
incompatible GDScript.

## Layout

```
godot/
  project.godot     engine config and the input map
  scripts/
    config.gd       every tunable number, in one testable place
    game_state.gd   the run and the settings (autoload)
    main.gd         entry scene
  scenes/
    main.tscn
  tests/
    test_runner.gd  headless runner; exits non-zero on failure
    test_*.gd       one suite per module
```

## How this is built

Tests come with each module, not after it. The runner was written before
the game, and it is checked that it can actually go **red** — a suite that
cannot fail proves nothing. It has already caught two real bugs in its own
first hour, including a version of itself that reported `PASSED` while a
whole suite failed to compile.

Balance lives in `config.gd` as data, so the engine can assert things a
reader would otherwise have to hold in their head: that a roll outruns a
run, that an assist cannot be permanently summoned, that no difficulty
starts with zero lives.

## State

Skeleton only: project config, input map, run/settings state, test harness,
CI. **45 assertions passing.** No art, no gameplay yet — the ground first,
by design.

Next: the sprite pipeline (converting the existing atlases to Godot
`SpriteFrames`), then the player, then enemies.
