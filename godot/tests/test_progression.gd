# Tests the run advancing across levels.
#
# Not the scene -- the STATE. Whether the six levels chain correctly is a
# question about GameState, Campaign and Scoring agreeing, and that can be
# asserted without a scene tree. The web version's equivalent bug (a field
# written in one place and silently dropped in another) lived exactly here.
extends RefCounted


func _fresh_state() -> Node:
	var script: GDScript = load("res://scripts/game_state.gd")
	var state: Node = script.new()
	state.difficulty = Config.DEFAULT_DIFFICULTY
	state.reset_run()
	return state


func run(t) -> void:
	t.describe("Progression — a run walks all six levels")
	var state := _fresh_state()
	var total := 0
	for i in Campaign.count():
		var level := Campaign.get_level(state.level)
		var is_final := Campaign.is_final(state.level)
		# Each level earns something and takes some time.
		var summary := Scoring.summarise(5000, 120.0, state.lives, is_final)
		total = summary["total"] + state.score
		state.complete_level(summary["total"], state.lives, level.get("rescue", ""))
	t.equal(state.level, Campaign.count(), "the run ends past the last level")
	t.check(state.run_complete(Campaign.count()), "and reports itself complete")
	t.check(state.score > 0, "with a score")

	t.describe("Progression — rescues accumulate across the run")
	# Five of the six levels rescue someone; level 5 is the Luigi fight.
	t.equal(state.rescued.size(), 5, "five family members are rescued")
	for who in ["carla", "gastone", "mattia", "michele", "family"]:
		t.check(state.rescued.has(who), "%s is among them" % who)

	t.describe("Progression — only the final level pays the lives bonus")
	var mid_bonus := 0
	var final_bonus := 0
	for i in Campaign.count():
		var summary := Scoring.summarise(1000, 60.0, 4, Campaign.is_final(i))
		if Campaign.is_final(i):
			final_bonus += summary["lives_bonus"]
		else:
			mid_bonus += summary["lives_bonus"]
	t.equal(mid_bonus, 0, "no lives bonus is paid across the first five levels")
	t.check(final_bonus > 0, "the sixth pays it once")

	t.describe("Progression — score only grows")
	state = _fresh_state()
	var last := 0
	for i in Campaign.count():
		state.complete_level(3000, state.lives, "")
		t.check(state.score > last, "level %d leaves the score higher" % (i + 1))
		last = state.score

	t.describe("Progression — a spent run resets to the first level")
	state = _fresh_state()
	state.complete_level(5000, 2, "carla")
	state.complete_level(5000, 1, "gastone")
	t.equal(state.level, 2, "the run is partway through")
	state.reset_run()
	t.equal(state.level, 0, "resetting puts it back at the first level")
	t.equal(state.score, 0, "with no score")
	t.equal(state.rescued.size(), 0, "and nobody rescued")
	t.equal(
		state.lives, Config.lives_for(Config.DEFAULT_DIFFICULTY),
		"and the difficulty's lives restored"
	)

	t.describe("Progression — every level has somewhere to go")
	for i in Campaign.count():
		if Campaign.is_final(i):
			t.check(true, "level %d is the last, so it ends the run" % (i + 1))
		else:
			var next := Campaign.get_level(i + 1)
			t.check(
				next.get("title_key", "") != "",
				"level %d leads to a level with a title" % (i + 1)
			)

	t.finished()
