# Tests for scripts/game_state.gd.
#
# GameState is an autoload, so these use a fresh instance rather than the
# live one: a test that mutated the running game's run would pass once and
# then poison whatever ran after it.
#
# What is worth testing here is the thing the previous version got wrong
# twice -- that a run carries everything it should across a level boundary,
# and that bad stored data cannot produce an unplayable state.
extends RefCounted


func _fresh() -> Node:
	var script: GDScript = load("res://scripts/game_state.gd")
	var state: Node = script.new()
	# _ready() does not fire outside the tree, so the reset it performs is
	# done explicitly. Settings are left at their defaults, which is what a
	# test wants -- no reading of the developer's own settings file.
	state.difficulty = Config.DEFAULT_DIFFICULTY
	state.reset_run()
	return state


func run(t) -> void:
	t.describe("GameState — a fresh run")
	var state := _fresh()
	t.equal(state.level, 0, "starts on the first level")
	t.equal(state.score, 0, "starts with no score")
	t.equal(
		state.lives,
		Config.lives_for(Config.DEFAULT_DIFFICULTY),
		"starts with the difficulty's lives"
	)
	t.equal(state.rescued.size(), 0, "has rescued nobody")
	t.near(state.attack_multiplier, 1.0, "has no attack bonus")

	t.describe("GameState — completing a level")
	state.complete_level(8500, 4, "carla")
	t.equal(state.level, 1, "advances to the next level")
	t.equal(state.score, 8500, "banks what the level earned")
	t.equal(state.lives, 4, "carries the lives that survived")
	t.check(state.rescued.has("carla"), "remembers who was rescued")

	state.complete_level(6000, 3, "gastone")
	t.equal(state.score, 14500, "score accumulates across levels")
	t.equal(state.rescued.size(), 2, "rescues accumulate")

	t.describe("GameState — a rescue is never double-counted")
	state.complete_level(100, 3, "gastone")
	t.equal(state.rescued.size(), 2, "rescuing the same person twice adds one entry")

	t.describe("GameState — a level with no rescue")
	var before: int = state.rescued.size()
	state.complete_level(100, 3, "")
	t.equal(state.rescued.size(), before, "an empty rescue adds nobody")
	t.equal(state.level, 4, "but the level still advances")

	t.describe("GameState — end of the run")
	t.check(state.run_complete(4), "a run past its last level is complete")
	t.check(not state.run_complete(6), "a run with levels left is not")

	t.describe("GameState — reset clears everything")
	state.reset_run()
	t.equal(state.level, 0, "level is back to the first")
	t.equal(state.score, 0, "score is cleared")
	t.equal(state.rescued.size(), 0, "rescues are cleared")

	t.describe("GameState — difficulty decides the lives a run starts with")
	state.difficulty = "hell"
	state.reset_run()
	t.equal(state.lives, Config.lives_for("hell"), "hell starts with its own count")
	state.difficulty = "easy"
	state.reset_run()
	t.equal(state.lives, Config.lives_for("easy"), "easy starts with its own count")
	t.check(state.lives > 0, "every difficulty starts playable")
