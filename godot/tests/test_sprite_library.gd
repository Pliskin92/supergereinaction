# Tests for scripts/sprite_library.gd.
#
# These run against the REAL art rather than fixtures. That is deliberate:
# the thing most likely to break here is not the code's logic but its
# agreement with 102 clips of shipped data -- a frame key sorted lexically,
# an atlas in the other of the two shapes, a clip whose trim file is
# missing. Only the real files catch that.
extends RefCounted


func run(t) -> void:
	var lib := SpriteLibrary.new()

	t.describe("SpriteLibrary — loading a real clip")
	var idle := lib.load_clip("gere", "idle_right")
	t.check(idle != null, "gere's idle loads")
	if idle == null:
		return  # nothing below is meaningful without it
	t.check(idle.has_animation("idle_right"), "the animation is named for its clip")
	t.equal(idle.get_frame_count("idle_right"), 25, "all 25 frames are present")
	t.check(idle.get_animation_speed("idle_right") > 0.0, "plays at a real frame rate")

	t.describe("SpriteLibrary — frames are trimmed, not whole tiles")
	# The tiles are 160x160; a trimmed frame must be smaller, or the trim
	# data was ignored and the character will drift around its own feet.
	var frame: Texture2D = idle.get_frame_texture("idle_right", 0)
	t.check(frame != null, "frame 0 has a texture")
	if frame != null:
		t.check(
			frame.get_width() < 160 and frame.get_height() < 160,
			"frame 0 is tighter than its 160x160 tile (%dx%d)"
				% [frame.get_width(), frame.get_height()]
		)

	t.describe("SpriteLibrary — every frame is on the sheet")
	var sheet: Texture2D = load("res://assets/gere_sprites/idle_right/spritesheet.png")
	t.check(sheet != null, "the spritesheet itself loads")
	if sheet != null:
		var inside := true
		for i in idle.get_frame_count("idle_right"):
			var atlas: AtlasTexture = idle.get_frame_texture("idle_right", i)
			var r := atlas.region
			if r.position.x < 0 or r.position.y < 0 \
					or r.end.x > sheet.get_width() or r.end.y > sheet.get_height():
				inside = false
		t.check(inside, "no frame region falls outside the sheet")

	t.describe("SpriteLibrary — draw offsets")
	var offsets := lib.offsets_for("gere", "idle_right")
	t.equal(offsets.size(), 25, "one offset per frame")

	t.describe("SpriteLibrary — a missing clip is not an error")
	t.check(lib.load_clip("gere", "no_such_clip") == null, "an absent clip returns null")
	t.check(lib.load_clip("nobody", "idle_right") == null, "an absent character returns null")

	t.describe("SpriteLibrary — loading a character's clips")
	var loaded := lib.load_character("minion", ["idle_right", "walk_right", "punch", "no_such"])
	t.check(loaded.has("idle_right"), "keeps the clips that exist")
	t.check(not loaded.has("no_such"), "drops the ones that do not")
	t.check(lib.has_clip("minion", "walk_right"), "reports what it holds")

	t.describe("SpriteLibrary — frame order is numeric, not lexical")
	# Frame 10 sorted lexically lands between 1 and 2, which would shuffle
	# the middle of every clip -- a walk that stutters for no visible reason.
	var walk := lib.load_clip("gere", "walk_right")
	if walk != null and walk.get_frame_count("walk_right") > 10:
		var a: AtlasTexture = walk.get_frame_texture("walk_right", 1)
		var b: AtlasTexture = walk.get_frame_texture("walk_right", 10)
		t.check(
			a.region.position != b.region.position,
			"frames 1 and 10 are different regions"
		)

	t.describe("SpriteLibrary — offsets are per frame, not one for the clip")
	# The trimmed boxes differ in height across a clip, so a single offset
	# cannot serve them all: applying frame 0's to every frame makes the
	# character rise and sink as it plays.
	#
	# Tested on the JUMP, not the idle. An idle is drawn at a constant
	# height (gere's is 101px on every frame), so its offsets are uniform
	# and prove nothing -- which is exactly what the first version of this
	# test got wrong. A jump rises through its clip: heights run 88-115 and
	# `lift` reaches 33, so if the offsets there were uniform the character
	# would never leave the ground.
	lib.load_clip("gere", "jump_right")
	var jump_offsets := lib.offsets_for("gere", "jump_right")
	t.check(jump_offsets.size() > 0, "the jump clip has offsets")
	var varied := false
	for i in range(1, jump_offsets.size()):
		if not is_equal_approx(jump_offsets[i].y, jump_offsets[0].y):
			varied = true
	t.check(varied, "the jump's frames sit at different heights, so it leaves the ground")

	# And the idle really is uniform, which is the other half of the claim.
	var idle_uniform := true
	for i in range(1, offsets.size()):
		if not is_equal_approx(offsets[i].y, offsets[0].y):
			idle_uniform = false
	t.check(idle_uniform, "the idle is drawn at a constant height, so it does not bob")

	t.describe("SpriteLibrary — clip name aliases")
	# The packs disagree about case: gere has "Punch", minion has "punch".
	# Callers use one canonical name and the library finds the folder.
	t.check(lib.load_clip("gere", "punch") != null, "gere's Punch resolves from 'punch'")
	t.check(lib.load_clip("minion", "punch") != null, "minion's punch resolves too")
	t.check(lib.load_clip("gere", "fall") != null, "gere's Fall resolves from 'fall'")
	t.check(lib.load_clip("gere", "heavy") != null, "gere's attack_right resolves from 'heavy'")

	t.describe("SpriteLibrary — the whole shipped cast loads")
	# The real check: every character the game uses, every gameplay clip,
	# against the actual files. A pack that stopped loading would otherwise
	# only show up as a character rendering as nothing.
	var cast := ["gere", "supergere", "minion", "bananana", "boss1"]
	var clips := ["idle_right", "walk_right", "punch", "fall"]
	for character in cast:
		var got := lib.load_character(character, clips)
		t.check(
			got.size() > 0,
			"%s loads at least one of its gameplay clips (%d of %d)"
				% [character, got.size(), clips.size()]
		)
