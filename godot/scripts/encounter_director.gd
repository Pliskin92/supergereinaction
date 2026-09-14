# Decides when a fight happens and who is in it.
#
# Deliberately separate from the level scene, and it touches no nodes: it
# takes the player's position and hands back "spawn these, here". That means
# the pacing of a whole level can be simulated in a test -- walk a virtual
# player down a virtual street and assert the fights come at a sensible
# rhythm and the roster is actually spent -- which is the part the web
# version could never check and repeatedly got wrong.
#
# The shape is the beat-em-up one: walk, a pack arrives ON SCREEN, the
# street LOCKS until they are down, the lock lifts, walk again. A running
# battle you can outrun is not the same game.
class_name EncounterDirector
extends RefCounted

# How far the player walks between fights, in screen-widths measured from
# where the last one ENDED.
#
# From where it ended, not where it started: a fight is fought across a
# whole locked screen and can finish anywhere in it, so measuring from the
# trigger made the real walk anything from a few seconds to twenty. The web
# version shipped that for a long time.
const SPACING_SCREENS := 0.55
# Randomised by this fraction, so the level does not tick like a metronome.
const SPACING_JITTER := 0.25
# Where along the street the first pack fires and the last one may. The tail
# is kept clear so the walk into the boss is a beat of quiet.
const FIRST_AT := 0.05
const LAST_AT := 0.86
# Where the boss waits.
const BOSS_AT := 0.95

var level: Dictionary = {}
var world_width := 0.0
var screen_width := 0.0

# How many enemies this run of the level will spend, rolled once at setup.
var roster := 0
var spawned := 0
var encounters := 0
# The world x the next pack fires at.
var next_at := 0.0
# The right-hand wall while a fight is on; 0.0 when the street is open.
var lock_x := 0.0
var boss_spawned := false

var _rng := RandomNumberGenerator.new()


func setup(level_def: Dictionary, world_w: float, screen_w: float, seed_value := 0) -> void:
	level = level_def
	world_width = world_w
	screen_width = screen_w
	if seed_value != 0:
		_rng.seed = seed_value
	else:
		_rng.randomize()
	# The roster varies a little per run, so two playthroughs are not the
	# identical sequence of packs.
	var target: int = level.get("roster", 24)
	roster = target + _rng.randi_range(-2, 2)
	spawned = 0
	encounters = 0
	lock_x = 0.0
	boss_spawned = false
	next_at = world_width * FIRST_AT


# How far apart packs are placed, in world pixels.
#
# Derived from the roster rather than fixed: the street has to hold roughly
# `roster` enemies in packs of average size, so the gap is the walkable span
# divided by how many packs that works out to. A fixed spacing would spend
# the whole roster in the first third and leave the rest empty pavement.
func spacing() -> float:
	var average_pack: float = (float(level.get("pack_min", 3))
		+ float(level.get("pack_max", 5))) / 2.0
	var packs := maxf(1.0, roundf(float(roster) / average_pack))
	var span := world_width * (LAST_AT - FIRST_AT)
	return maxf(screen_width * SPACING_SCREENS, span / packs)


# True while a fight is unresolved. The level passes in whether any enemy is
# still standing; the director does not hold the enemies itself.
func is_locked(enemies_alive: bool) -> bool:
	return lock_x > 0.0 and enemies_alive


# Whether a pack should arrive now. Nothing fires while the street is
# locked, once the roster is spent, or past the run-in to the boss.
func should_trigger(player_x: float, enemies_alive: bool) -> bool:
	if is_locked(enemies_alive):
		return false
	if spawned >= roster:
		return false
	if next_at > world_width * LAST_AT:
		return false
	return player_x >= next_at


# The pack that arrives: a list of { type, offset_x, depth } where offset_x
# is relative to the player and depth is 0..1 across the lane.
#
# Split around the player rather than all in front, so a pack cuts off the
# retreat as well as the advance.
func build_pack(player_facing: int) -> Array:
	var size: int = _rng.randi_range(level.get("pack_min", 3), level.get("pack_max", 5))
	size = mini(size, roster - spawned)
	var types: Array = level.get("minions", ["minion"])
	var standard: String = types[0]
	var tough: String = types[1] if types.size() > 1 else types[0]
	var tough_share: float = level.get("tough_share", 0.3)

	var pack := []
	# Slots either side of the player, far enough out not to land on top of
	# them and spread so two do not arrive on the same spot.
	var ahead := int(ceil(size * 0.6))
	for i in size:
		var in_front := i < ahead
		var slot := (i if in_front else i - ahead)
		var direction := player_facing if in_front else -player_facing
		var offset := direction * (140.0 + slot * 110.0)
		# Guarantee one of each type in a pack big enough to hold both, so a
		# mixed street is actually seen rather than left to lucky rolls.
		var type := standard
		if i == 1 and size >= 3:
			type = tough
		elif i > 1 and _rng.randf() < tough_share:
			type = tough
		pack.append({
			"type": type,
			"offset_x": offset,
			"depth": _rng.randf_range(0.1, 0.9),
		})
	spawned += pack.size()
	encounters += 1
	return pack


# Called when a pack has been placed: locks the street at the right-hand
# edge of the screen the fight is happening on.
func lock_street(camera_x: float) -> void:
	lock_x = camera_x + screen_width - 40.0


# Called the moment the last enemy of a pack goes down. The next mark is set
# from WHERE THE PLAYER IS NOW, which is what makes the gap between fights a
# constant walk rather than a lottery.
func unlock_street(player_x: float) -> void:
	lock_x = 0.0
	var gap := spacing()
	var jitter := gap * SPACING_JITTER * _rng.randf_range(-1.0, 1.0)
	next_at = player_x + gap + jitter


func boss_x() -> float:
	return world_width * BOSS_AT


# True once the player has walked far enough for the boss to be placed.
func should_spawn_boss(player_x: float) -> bool:
	if boss_spawned:
		return false
	return player_x >= boss_x() - screen_width
