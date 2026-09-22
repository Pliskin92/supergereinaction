# The heads-up display: health, lives, FURY, score, and the boss's bar.
#
# Drawn with _draw() rather than assembled from Control nodes. The HUD is a
# handful of bars and a row of hearts that change every frame, and a scene
# tree of Labels and TextureRects would be more machinery than the thing it
# draws -- plus every position would live in a .tscn where it cannot be
# read in a diff or checked by a test.
#
# It reads the player rather than being told: a HUD that has to be pushed
# updates is a HUD that goes stale when someone forgets to push one.
class_name Hud
extends CanvasLayer

const PAD := 12.0
const BAR_WIDTH := 190.0
const BAR_HEIGHT := 13.0
const HEART_SIZE := 13.0
const HEART_GAP := 17.0

# Colours, named so the palette is in one place rather than spread through
# the drawing code.
const COLOUR_PLATE := Color(0.03, 0.02, 0.06, 0.45)
const COLOUR_HEALTH := Color(0.35, 0.78, 0.35)
const COLOUR_HEALTH_LOW := Color(0.91, 0.30, 0.30)
const COLOUR_FURY := Color(0.76, 0.25, 0.05)
const COLOUR_FURY_FULL := Color(1.0, 0.84, 0.30)
const COLOUR_HEART := Color(1.0, 0.32, 0.38)
const COLOUR_HEART_SPENT := Color(1.0, 0.32, 0.38, 0.22)
const COLOUR_TEXT := Color(1.0, 1.0, 1.0, 0.92)
const COLOUR_LABEL := Color(1.0, 0.84, 0.30)
# Below this fraction the health bar turns red, as a warning that reads
# without having to measure the bar.
const HEALTH_WARN := 0.3

var player: Player
var boss: Enemy
var score := 0
var level_title := ""

var _canvas: Control


func _ready() -> void:
	# A Control child does the drawing: CanvasLayer itself has no _draw.
	_canvas = Control.new()
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_hud)
	add_child(_canvas)


func _process(_delta: float) -> void:
	# Redrawn every frame because almost everything on it changes every
	# frame. Queueing on change instead would mean tracking six values.
	_canvas.queue_redraw()


func _draw_hud() -> void:
	if player == null:
		return
	var font := ThemeDB.fallback_font
	_draw_player_panel(font)
	_draw_score(font)
	if boss != null and boss.is_alive():
		_draw_boss_bar(font)


func _draw_player_panel(font: Font) -> void:
	var x := PAD
	var y := PAD
	# A backing plate, so light patches of street do not swallow the bars.
	# Sized to what is actually drawn on it: the title, the hearts, both
	# bars, and the FURY caption written UNDER the second bar. Guessing at
	# this is how the web version ended up with a caption hanging off the
	# bottom of its own panel.
	var panel_height := 16.0 + HEART_SIZE + 6.0 + BAR_HEIGHT + 4.0 + BAR_HEIGHT + 22.0
	_canvas.draw_rect(
		Rect2(x - 4.0, y - 4.0, BAR_WIDTH + 16.0, panel_height), COLOUR_PLATE, true
	)

	if level_title != "":
		_canvas.draw_string(
			font, Vector2(x, y + 10.0), Strings.get_text(level_title),
			HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOUR_LABEL
		)
	y += 16.0

	# Lives, as hearts: one pip per life the run started with, so the count
	# reads against the chosen difficulty rather than a fixed number.
	var max_lives: int = maxi(player.lives, GameState.max_lives)
	for i in max_lives:
		var filled := i < player.lives
		_draw_heart(
			Vector2(x + HEART_SIZE * 0.5 + i * HEART_GAP, y + HEART_SIZE * 0.5),
			HEART_SIZE, COLOUR_HEART if filled else COLOUR_HEART_SPENT
		)
	y += HEART_SIZE + 6.0

	# Health.
	var health := clampf(float(player.hp) / float(player.max_hp), 0.0, 1.0)
	_draw_bar(
		Vector2(x, y), health,
		COLOUR_HEALTH if health > HEALTH_WARN else COLOUR_HEALTH_LOW
	)
	y += BAR_HEIGHT + 4.0

	# FURY, with its percentage beside it so the meter is readable at a
	# glance rather than by eyeballing the fill.
	var fury := clampf(player.fury / Config.FURY_MAX, 0.0, 1.0)
	var fury_colour := COLOUR_FURY_FULL if player.can_transform() else COLOUR_FURY
	_draw_bar(Vector2(x, y), fury, fury_colour)
	var fury_label := "%s %d%%" % [Strings.get_text("fury"), roundi(fury * 100.0)]
	if player.fury_active:
		fury_label = "%s!" % Strings.get_text("fury")
	_canvas.draw_string(
		font, Vector2(x + 2.0, y + BAR_HEIGHT + 11.0), fury_label,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 10, COLOUR_TEXT
	)


func _draw_score(font: Font) -> void:
	var text := str(score)
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_RIGHT, -1, 20).x
	var x := Config.VIEW_WIDTH - PAD - width
	_canvas.draw_rect(
		Rect2(x - 10.0, PAD - 4.0, width + 20.0, 38.0), COLOUR_PLATE, true
	)
	_canvas.draw_string(
		font, Vector2(x, PAD + 18.0), text,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 20, COLOUR_TEXT
	)
	_canvas.draw_string(
		font, Vector2(x, PAD + 30.0), Strings.get_text("score"),
		HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Color(1, 1, 1, 0.55)
	)


# The boss gets a bar of its own, centred, so a fight that matters looks
# different from a fight that does not.
func _draw_boss_bar(font: Font) -> void:
	var width := 300.0
	var x := (Config.VIEW_WIDTH - width) * 0.5
	var y := PAD + 4.0
	_canvas.draw_rect(Rect2(x, y, width, 11.0), Color(0, 0, 0, 0.6), true)
	var fraction := clampf(float(boss.hp) / float(boss.max_hp), 0.0, 1.0)
	_canvas.draw_rect(Rect2(x, y, width * fraction, 11.0), COLOUR_HEALTH_LOW, true)
	var name: String = boss.def.get("name", "BOSS")
	var text_width := font.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
	_canvas.draw_string(
		font, Vector2(Config.VIEW_WIDTH * 0.5 - text_width * 0.5, y + 26.0), name,
		HORIZONTAL_ALIGNMENT_LEFT, -1, 11, COLOUR_TEXT
	)


func _draw_bar(at: Vector2, fraction: float, colour: Color) -> void:
	_canvas.draw_rect(Rect2(at.x, at.y, BAR_WIDTH, BAR_HEIGHT), Color(0, 0, 0, 0.55), true)
	if fraction > 0.0:
		_canvas.draw_rect(
			Rect2(at.x, at.y, BAR_WIDTH * fraction, BAR_HEIGHT), colour, true
		)


# A heart, drawn as two arcs and a point. Cheaper than shipping an icon and
# it scales to any size without a second asset.
func _draw_heart(centre: Vector2, size: float, colour: Color) -> void:
	var r := size * 0.28
	_canvas.draw_circle(centre + Vector2(-r * 0.85, -r * 0.35), r, colour)
	_canvas.draw_circle(centre + Vector2(r * 0.85, -r * 0.35), r, colour)
	_canvas.draw_colored_polygon(
		PackedVector2Array([
			centre + Vector2(-r * 1.75, 0.0),
			centre + Vector2(r * 1.75, 0.0),
			centre + Vector2(0.0, size * 0.52),
		]),
		colour
	)
