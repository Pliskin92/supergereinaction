# The entry scene.
#
# Scaffolding while the game is built: it stands the player on a floor line
# so movement and combat can be seen working. It will become the title
# screen.
extends Node2D

const FLOOR_Y := 430

var _library := SpriteLibrary.new()
var _player: Player


func _ready() -> void:
	print("Super Gere — Godot %s" % Engine.get_version_info()["string"])
	print("  difficulty: %s (%d lives)" % [GameState.difficulty, GameState.lives])
	_player = Player.new()
	_player.setup(_library, "gere")
	_player.position = Vector2(200, FLOOR_Y)
	_player.bounds = Rect2(40, FLOOR_Y - 60, Config.VIEW_WIDTH - 80, 120)
	add_child(_player)
	print("  player ready at %s" % _player.position)
	if OS.get_environment("SG_CAPTURE") != "":
		_capture()


# Routes presses to the player. Input is read here rather than inside the
# player so the same player can be driven by a test or a replay.
func _unhandled_input(event: InputEvent) -> void:
	if _player == null:
		return
	for action in ["punch", "roll", "heavy", "jump"]:
		if event.is_action_pressed(action):
			_player.handle_action(action)


# Drives the player through a scripted sequence and saves frames, so the
# pipeline can be checked by eye from a headless run.
func _capture() -> void:
	var base: String = OS.get_environment("SG_CAPTURE")
	var script := [
		["idle", ""], ["punch", "punch"], ["roll", "roll"], ["heavy", "heavy"],
	]
	for entry in script:
		if entry[1] != "":
			_player.handle_action(entry[1])
		# Far enough into the clip to be recognisably mid-action.
		for i in 8:
			_player._tick_state(1.0 / 60.0)
			await get_tree().process_frame
		var image := get_viewport().get_texture().get_image()
		image.save_png("%s-%s.png" % [base, entry[0]])
		print("  captured %s" % entry[0])
		# Let the action finish before the next one.
		for i in 40:
			_player._tick_state(1.0 / 60.0)
			await get_tree().process_frame
	get_tree().quit()
