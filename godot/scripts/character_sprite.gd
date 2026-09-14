# An AnimatedSprite2D that stays anchored to its own feet.
#
# The frames of a clip are trimmed to different heights -- a crouch is
# shorter than a stand -- so a single offset cannot serve all of them.
# Applying frame 0's offset to the whole clip makes the character rise and
# sink as it plays, which reads on screen as the sprite bobbing against the
# floor rather than standing on it.
#
# This node re-applies the right offset whenever the frame changes, so the
# node's own position IS the character's feet and gameplay code can treat it
# as a point on the ground.
class_name CharacterSprite
extends AnimatedSprite2D

var _library: SpriteLibrary
var _character := ""
# clip -> Array[Vector2], cached so a frame change is a lookup rather than a
# recomputation.
var _offsets: Dictionary = {}


func setup(library: SpriteLibrary, character: String) -> void:
	_library = library
	_character = character
	centered = true
	frame_changed.connect(_apply_offset)
	animation_changed.connect(_apply_offset)


# Adds a clip and makes it available to play().
func add_clip(clip: String) -> bool:
	var loaded := _library.load_clip(_character, clip)
	if loaded == null:
		return false
	if sprite_frames == null:
		sprite_frames = SpriteFrames.new()
		sprite_frames.remove_animation("default")
	# SpriteFrames holds one animation per clip name, so the frames are
	# copied across rather than the whole resource being replaced -- a
	# character needs all its clips in one SpriteFrames to switch between
	# them.
	if not sprite_frames.has_animation(clip):
		sprite_frames.add_animation(clip)
	sprite_frames.set_animation_speed(clip, loaded.get_animation_speed(clip))
	sprite_frames.set_animation_loop(clip, loaded.get_animation_loop(clip))
	for i in loaded.get_frame_count(clip):
		sprite_frames.add_frame(clip, loaded.get_frame_texture(clip, i))
	_offsets[clip] = _library.offsets_for(_character, clip)
	return true


func _apply_offset() -> void:
	var list: Array = _offsets.get(animation, [])
	if frame >= 0 and frame < list.size():
		offset = list[frame]
