# The entry scene.
#
# Deliberately near-empty for now: it exists so the project boots, and so
# there is a place for the title screen to be built into. It prints its
# state on start, which is what lets a headless run prove the autoload and
# the input map are actually wired.
extends Node2D


func _ready() -> void:
	print("Super Gere — Godot %s" % Engine.get_version_info()["string"])
	print("  viewport: %dx%d" % [Config.VIEW_WIDTH, Config.VIEW_HEIGHT])
	print("  difficulty: %s (%d lives)" % [GameState.difficulty, GameState.lives])
	# Proves the input map loaded: a missing action here is a typo in
	# project.godot that would otherwise only surface as a dead key in game.
	var actions := ["move_left", "move_right", "punch", "roll", "heavy", "jump"]
	var missing: Array[String] = []
	for action in actions:
		if not InputMap.has_action(action):
			missing.append(action)
	if missing.is_empty():
		print("  input: all %d core actions bound" % actions.size())
	else:
		push_error("input actions missing: %s" % ", ".join(missing))
