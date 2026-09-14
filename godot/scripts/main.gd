# The entry scene.
#
# For now it is a proving ground: it stands the cast on a floor line so the
# sprite pipeline can be SEEN to work, not merely asserted to. A test can
# tell you a region is inside a sheet; only a picture tells you the feet
# line up.
#
# This is scaffolding and will be replaced by the title screen.
extends Node2D

const CAST := ["gere", "supergere", "minion", "bananana", "boss1"]
const FLOOR_Y := 430

var _library := SpriteLibrary.new()


func _ready() -> void:
	print("Super Gere — Godot %s" % Engine.get_version_info()["string"])
	print("  difficulty: %s (%d lives)" % [GameState.difficulty, GameState.lives])
	_check_input()
	_stand_the_cast()


func _check_input() -> void:
	var actions := ["move_left", "move_right", "punch", "roll", "heavy", "jump"]
	var missing: Array[String] = []
	for action in actions:
		if not InputMap.has_action(action):
			missing.append(action)
	if missing.is_empty():
		print("  input: all %d core actions bound" % actions.size())
	else:
		push_error("input actions missing: %s" % ", ".join(missing))


# One of each character, idling on a common floor line. If the pipeline is
# right they all stand ON that line; if the trim data were ignored they
# would float or sink by different amounts each.
func _stand_the_cast() -> void:
	var x := 140
	for character in CAST:
		var sprite := CharacterSprite.new()
		sprite.setup(_library, character)
		sprite.add_clip("idle_right")
		# The node's position IS the character's feet: CharacterSprite keeps
		# the per-frame offset in step, so this sits on the floor line and
		# stays there through the whole clip.
		sprite.position = Vector2(x, FLOOR_Y)
		sprite.animation = "idle_right"
		sprite.play()
		add_child(sprite)
		x += 170
	print("  stood %d characters on the floor line" % get_child_count())
	# Capture a frame when asked, so the pipeline can be checked by eye from
	# a headless run rather than only by assertion.
	if OS.get_environment("SG_CAPTURE") != "":
		await get_tree().process_frame
		await get_tree().process_frame
		var image := get_viewport().get_texture().get_image()
		image.save_png(OS.get_environment("SG_CAPTURE"))
		print("  captured to %s" % OS.get_environment("SG_CAPTURE"))
		get_tree().quit()
