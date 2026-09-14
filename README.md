# Super Gere: Parise Rescue

A 2D side-scrolling beat-em-up. Super Gere fights down six streets to
rescue his family from Mr. Meeottee.

Built in **Godot 4.3**, targeting Android and the Play Store.

## Running it

```bash
# The editor
godot4 --path godot

# The test suite — headless, no display needed
godot4 --headless --path godot --script tests/test_runner.gd
```

A fresh clone needs one import pass first, which builds the `class_name`
registry the scripts resolve against:

```bash
godot4 --headless --path godot --import
```

Without it every suite fails with `Identifier "Config" not declared`.

## Installing Godot

Get **4.3** from [godotengine.org/download](https://godotengine.org/download).
It is a single executable — no installer.

```bash
curl -sL -o godot4.zip \
  https://github.com/godotengine/godot/releases/download/4.3-stable/Godot_v4.3-stable_linux.x86_64.zip
unzip godot4.zip
sudo install -m755 Godot_v4.3-stable_linux.x86_64 /usr/local/bin/godot4
```

Not `apt install godot3` — that is Godot 3, a different engine with
incompatible GDScript.

## Layout

```
godot/
  project.godot     engine config and the input map
  scripts/
    config.gd              every tunable number, in one testable place
    game_state.gd          the run and the settings (autoload)
    campaign.gd            the six levels, as a table
    sprite_library.gd      loads the sprite packs into Godot animations
    character_sprite.gd    keeps a sprite anchored to its own feet
    player.gd              movement, the combo, the roll, FURY
    enemy.gd               approach, telegraph, swing, recover
    enemy_types.gd         what each enemy is, as data
    combat.gd              who hits whom
    encounter_director.gd  when a fight happens and who is in it
    level.gd               the street that ties it together
  scenes/
  tests/
    test_runner.gd    headless; exits non-zero on failure
    test_*.gd         one suite per module
art-source/           working art, not committed (see .gitignore)
```

## How this is built

Tests come with each module, not after it. The runner was written before
the game, and it is checked that it can actually go **red** — a suite that
cannot fail proves nothing.

It has earned that twice over. It caught a version of itself that reported
`PASSED` while a whole suite failed to compile, and later another that
reported `PASSED` while a suite died partway through and nine of its ten
sections never ran. A suite must now declare it finished, or it counts as
failed whatever its assertions said.

Whole systems are simulated, not just unit-tested. The enemy AI passed
every unit test while being completely deadlocked — each part correct, the
combination unplayable — and only walking a virtual player through a whole
fight found it. Level pacing gets the same treatment.

**242 assertions**, green in CI.

## State

Playable in the editor: a street that scrolls, a player who moves and
fights, enemies that arrive in packs and lock the street, a boss at the
end.

Not yet: HUD, title screen, end-of-level flow, the story scenes, the shop,
the lock code, touch controls, APK export.

Levels 2-6 run on the same engine and share level 1's street art and boss.
See [ART-TODO.md](ART-TODO.md).

## History

A complete JavaScript/Canvas version of this game came first and is tagged
**`v1.0-js`** — six levels, story scenes, a shop, assists, mobile support
and offline caching. `git checkout v1.0-js` brings it back whole.

It was replaced rather than extended because its cost was structural: ~7MB
of sprite art crossing a network before anyone could play. Packaged as an
app that cost is paid once at install.
