# Loads the sprite packs into Godot animations.
#
# The art comes from the web version: each clip is a spritesheet plus an
# atlas.json giving the grid, and a trim.json giving each frame's real
# bounding box inside its tile. Godot has no importer for that pair, so this
# is it.
#
# Why the trim data matters, and why it cannot be skipped: the tiles are
# uniform (160x160) but the character inside is not centred in them and does
# not fill them. Drawing whole tiles would make the character drift around
# its own feet between frames -- the walk would bob and slide. The trim box
# is what pins each frame to the same ground line.
#
# `lift` is the exception: it is how far a frame's feet sit ABOVE that
# ground line, and it encodes real vertical motion (a jump rises through its
# clip). Zeroing it would pin a jumping character to the floor, so it is
# preserved and applied as an offset.
#
# Clips are loaded lazily, per character, so a scene that only shows the
# player does not pay for the whole cast -- the mistake that made the web
# version slow to start.
class_name SpriteLibrary
extends RefCounted

const ASSETS_ROOT := "res://assets"

# Canonical action names, and the folders they may actually live in.
#
# The packs came from two runs of the same exporter and disagree about case:
# gere has "Punch" and "Fall", minion has "punch" and "fall", and some packs
# use "attack_right" where others have "heavy". Rather than make every
# caller learn which character is which -- the web version's approach, a
# per-character alias table that had to be maintained by hand -- a clip name
# is looked up against the candidates below and the first that exists wins.
#
# The order matters: the canonical lowercase name is tried first, so a pack
# that follows the convention costs nothing.
const CLIP_ALIASES := {
	"punch": ["punch", "Punch"],
	"kick": ["kick", "Kick"],
	"heavy": ["heavy", "attack_right"],
	"roll": ["roll", "Roll"],
	"hurt": ["hurt", "Hurt"],
	"hit_react": ["hit_react", "Hit React"],
	"fall": ["fall", "Fall"],
	"victory": ["victory", "Victory"],
	"dance": ["dance", "Dance"],
	"relaxed": ["relaxed"],
	"idle_right": ["idle_right"],
	"walk_right": ["walk_right"],
	"run_right": ["run_right"],
	"jump_right": ["jump_right"],
	"wave": ["wave"],
}

# character -> { clip_name: SpriteFrames }
var _packs: Dictionary = {}
# character -> { clip_name: Array[Vector2] } — the per-frame draw offset that
# puts every frame on a common ground line.
var _offsets: Dictionary = {}


# Reads one clip into a SpriteFrames, or null if its files are missing or
# malformed. A missing clip is a normal condition -- not every character has
# every action -- so this reports null rather than erroring.
func load_clip(character: String, clip: String) -> SpriteFrames:
	var dir := _resolve_dir(character, clip)
	if dir == "":
		return null
	var sheet_path := "%s/spritesheet.png" % dir
	var texture: Texture2D = load(sheet_path)
	if texture == null:
		return null

	var atlas := _read_json("%s/atlas.json" % dir)
	if atlas.is_empty() or not atlas.has("frames"):
		return null
	var trim := _read_json("%s/trim.json" % dir)

	var frames := SpriteFrames.new()
	frames.remove_animation("default")
	frames.add_animation(clip)
	# The clip's own duration decides its frame rate, so a 25-frame clip
	# authored over two seconds plays at the pace it was drawn at rather
	# than at an arbitrary default.
	var duration: float = atlas.get("meta", {}).get("duration_s", 1.0)
	var count: int = atlas["frames"].size()
	if count > 0 and duration > 0.0:
		frames.set_animation_speed(clip, float(count) / duration)
	frames.set_animation_loop(clip, true)

	var offsets: Array[Vector2] = []
	# Frame keys are numeric strings; sort by value, not lexically, or frame
	# 10 lands between 1 and 2.
	var keys: Array = atlas["frames"].keys()
	keys.sort_custom(func(a, b): return int(a) < int(b))

	for i in keys.size():
		var key: String = str(keys[i])
		var tile: Dictionary = _frame_box(atlas["frames"][key])
		var box := tile
		var lift := 0.0
		if not trim.is_empty() and trim.has("frames") and trim["frames"].has(key):
			var t: Dictionary = trim["frames"][key]
			# The trimmed box is relative to its tile, so it is offset into
			# sheet space here.
			box = {
				"x": tile["x"] + int(t["x"]),
				"y": tile["y"] + int(t["y"]),
				"w": int(t["w"]),
				"h": int(t["h"]),
			}
			lift = float(t.get("lift", 0))

		var region := AtlasTexture.new()
		region.atlas = texture
		region.region = Rect2(box["x"], box["y"], box["w"], box["h"])
		frames.add_frame(clip, region)

		# Draw offset: centre the frame horizontally on the character's own
		# axis, and sit its bottom edge on the ground line, raised by `lift`.
		#
		# This is PER FRAME and must be applied per frame, because the
		# trimmed boxes differ in height across a clip -- a crouch is shorter
		# than a stand. Applying frame 0's offset to every frame makes the
		# character rise and sink as it animates, which reads as the sprite
		# bobbing against the floor.
		offsets.append(Vector2(0, -float(box["h"]) / 2.0 - lift))

	if not _offsets.has(character):
		_offsets[character] = {}
	_offsets[character][clip] = offsets
	return frames


# The per-frame draw offsets for a loaded clip, or an empty array if it was
# never loaded.
func offsets_for(character: String, clip: String) -> Array[Vector2]:
	if not _offsets.has(character):
		return []
	var empty: Array[Vector2] = []
	return _offsets[character].get(clip, empty)


# Loads a set of clips for one character, keeping what exists and quietly
# skipping what does not.
func load_character(character: String, clips: Array) -> Dictionary:
	var loaded: Dictionary = {}
	for clip in clips:
		var frames := load_clip(character, str(clip))
		if frames != null:
			loaded[str(clip)] = frames
	_packs[character] = loaded
	return loaded


func has_clip(character: String, clip: String) -> bool:
	return _packs.has(character) and _packs[character].has(clip)


func clips_for(character: String) -> Array:
	if not _packs.has(character):
		return []
	return _packs[character].keys()


# AutoSprite emitted two atlas shapes: a flat {x,y,w,h} and a nested
# {frame:{...}}. Both are in the shipped art, so both are handled here
# rather than every caller learning the difference.
func _frame_box(entry: Dictionary) -> Dictionary:
	if entry.has("frame"):
		return entry["frame"]
	return entry


# The folder a clip actually lives in, trying each spelling the packs use.
# Returns "" when the character simply does not have that action, which is a
# normal condition rather than an error.
func _resolve_dir(character: String, clip: String) -> String:
	var candidates: Array = CLIP_ALIASES.get(clip, [clip])
	for name in candidates:
		var dir := "%s/%s_sprites/%s" % [ASSETS_ROOT, character, name]
		if ResourceLoader.exists("%s/spritesheet.png" % dir):
			return dir
	return ""


func _read_json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	return parsed
