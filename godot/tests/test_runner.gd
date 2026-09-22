# The headless test runner.
#
# Built before the game rather than after it, because the whole point of
# this rewrite is ground that can be shown to be stable rather than hoped to
# be. Every module gets tests as it is written, and this runs them all in
# one command with no editor and no display:
#
#     godot4 --headless --path godot --script tests/test_runner.gd
#
# It exits non-zero when anything fails, so CI can gate on it.
#
# Deliberately not a third-party framework: a test runner that is fifty
# lines of GDScript has no version to pin, no addon to install, and nothing
# to break when the engine updates.
extends SceneTree

var _passed := 0
var _failed := 0
var _current := ""
# Set by t.finished() at the end of a suite; see _run_all for why.
var _suite_finished := false


func _init() -> void:
	print("")
	print("Super Gere — test suite")
	print("=======================")
	_run_all()
	print("")
	if _failed == 0:
		print("PASSED: %d assertions, 0 failures" % _passed)
		quit(0)
	else:
		print("FAILED: %d failures out of %d assertions" % [_failed, _passed + _failed])
		quit(1)


# Each suite is a file in tests/ exposing `run(t)`, where `t` is this runner.
# Listed explicitly rather than discovered by scanning the directory: a test
# file that silently stops being run is worse than one that has to be added
# to a list.
func _run_all() -> void:
	var suites := [
		"res://tests/test_config.gd",
		"res://tests/test_game_state.gd",
		"res://tests/test_sprite_library.gd",
		"res://tests/test_player.gd",
		"res://tests/test_enemy.gd",
		"res://tests/test_combat.gd",
		"res://tests/test_encounter.gd",
		"res://tests/test_scoring.gd",
		"res://tests/test_progression.gd",
		"res://tests/test_title.gd",
		"res://tests/test_touch.gd",
	]
	for path in suites:
		# ResourceLoader rather than load(): a suite with a parse error makes
		# load() return a GDScript that cannot be instantiated, and calling
		# new() on it merely pushes an error the runner then IGNORED --
		# reporting PASSED while a whole suite never ran. That is the worst
		# failure a test runner can have, so every step is checked.
		if not ResourceLoader.exists(path):
			_fail_hard("suite missing: %s" % path)
			continue
		var script: GDScript = load(path)
		if script == null or not script.can_instantiate():
			_fail_hard("suite failed to compile (parse error?): %s" % path)
			continue
		var suite: Object = script.new()
		if suite == null:
			_fail_hard("suite could not be instantiated: %s" % path)
			continue
		if not suite.has_method("run"):
			_fail_hard("%s has no run()" % path)
			continue
		# A suite that dies partway -- a nonexistent method, a null access --
		# stops running without raising anything this loop can catch, and the
		# runner would then report PASSED on however many assertions happened
		# to have run before it fell over. That is the same blind spot as a
		# suite failing to compile, and it has now been hit twice.
		#
		# So a suite must SAY it finished. run() sets this flag as its last
		# act, via t.finished(); if it never gets there, the suite is counted
		# as failed whatever its assertions said.
		_suite_finished = false
		suite.run(self)
		if not _suite_finished:
			_fail_hard(
				"%s stopped partway -- an error inside it killed the suite"
				% path.get_file()
			)


func _fail_hard(message: String) -> void:
	_failed += 1
	print("  FAIL  %s" % message)


# ---- The assertions a suite calls ----

# Names the group of assertions that follow, so a failure says what was
# being tested rather than only what went wrong.
func describe(name: String) -> void:
	_current = name
	print("")
	print("%s" % name)


# Called by a suite as its final statement, to prove it ran to the end
# rather than dying partway through.
func finished() -> void:
	_suite_finished = true


func check(condition: bool, message: String) -> void:
	if condition:
		_passed += 1
		print("  ok    %s" % message)
	else:
		_failed += 1
		print("  FAIL  %s" % message)


# Equality with both values reported on failure -- a bare "expected true"
# tells you nothing about what actually happened.
func equal(actual: Variant, expected: Variant, message: String) -> void:
	if actual == expected:
		_passed += 1
		print("  ok    %s" % message)
	else:
		_failed += 1
		print("  FAIL  %s  (got %s, expected %s)" % [message, actual, expected])


# Floats need a tolerance: 0.1 + 0.2 != 0.3 in any language with doubles.
func near(actual: float, expected: float, message: String, tolerance := 0.0001) -> void:
	if absf(actual - expected) <= tolerance:
		_passed += 1
		print("  ok    %s" % message)
	else:
		_failed += 1
		print("  FAIL  %s  (got %f, expected %f)" % [message, actual, expected])
