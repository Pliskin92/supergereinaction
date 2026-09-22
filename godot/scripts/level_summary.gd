# The screen at the end of a level: what you scored, and where you go next.
#
# Drawn the same way the HUD is, and for the same reason -- it is a heading
# and four rows of numbers, and a scene tree of Labels would put every
# position in a .tscn where it cannot be read in a diff.
#
# It owns no scoring logic. Scoring.summarise() has already worked out the
# bonuses; this draws them and waits for a key.
class_name LevelSummary
extends CanvasLayer

signal continued

const COLOUR_DIM := Color(0.04, 0.03, 0.06, 0.86)
const COLOUR_HEADING := Color(1.0, 0.84, 0.30)
const COLOUR_TEXT := Color(0.85, 0.83, 0.90)
const COLOUR_VALUE := Color(1.0, 1.0, 1.0)
const COLOUR_TOTAL := Color(0.0, 0.96, 0.83)
const COLOUR_RESCUE := Color(0.0, 0.96, 0.83)
const COLOUR_HINT := Color(1.0, 1.0, 1.0, 0.65)

var summary: Dictionary = {}
var rescue := ""
var next_title := ""
var is_game_over := false

var _canvas: Control
# The screen ignores input for a moment after it appears, so the keypress
# that ended the fight cannot also dismiss the screen it produced.
var _accepting := false


func _ready() -> void:
	_canvas = Control.new()
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_summary)
	add_child(_canvas)
	_canvas.queue_redraw()
	var timer := get_tree().create_timer(0.4)
	timer.timeout.connect(func(): _accepting = true)


func _unhandled_input(event: InputEvent) -> void:
	if not _accepting:
		return
	if event.is_action_pressed("confirm") or event.is_action_pressed("jump"):
		_accepting = false
		continued.emit()


func _draw_summary() -> void:
	var font := ThemeDB.fallback_font
	var width := float(Config.VIEW_WIDTH)
	var centre := width * 0.5
	_canvas.draw_rect(Rect2(0, 0, width, Config.VIEW_HEIGHT), COLOUR_DIM, true)

	var heading := Strings.get_text("game_over")
	if not is_game_over:
		heading = Strings.get_text(
			"campaign_clear" if summary.get("is_final", false) else "level_clear"
		)
	_draw_centred(font, heading, centre, 90.0, 34, COLOUR_HEADING)

	if is_game_over:
		_draw_centred(
			font, "%s  %d" % [Strings.get_text("score"), summary.get("total", 0)],
			centre, 150.0, 18, COLOUR_VALUE
		)
		_draw_centred(font, Strings.get_text("retry_hint"), centre, 220.0, 12, COLOUR_HINT)
		return

	# Who was pulled out of this level -- the story reason the street was
	# fought down in the first place.
	if rescue != "":
		_draw_centred(
			font,
			"%s: %s" % [Strings.get_text("rescued"), Strings.get_text("rescue_" + rescue)],
			centre, 120.0, 14, COLOUR_RESCUE
		)

	# The breakdown, as label/value columns so the numbers line up.
	var clock: Array = Scoring.clock(summary.get("seconds", 0.0))
	var rows := [
		[
			"%s  %02d:%02d" % [Strings.get_text("time_bonus"), clock[0], clock[1]],
			"+%d" % summary.get("time_bonus", 0),
		],
	]
	if summary.get("is_final", false):
		rows.append([Strings.get_text("lives_bonus"), "+%d" % summary.get("lives_bonus", 0)])
	else:
		rows.append([Strings.get_text("lives_left"), "%d" % GameState.lives])

	var y := 165.0
	for row in rows:
		var label_width := font.get_string_size(row[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		_canvas.draw_string(
			font, Vector2(centre - 14.0 - label_width, y), row[0],
			HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COLOUR_TEXT
		)
		_canvas.draw_string(
			font, Vector2(centre + 14.0, y), row[1],
			HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COLOUR_VALUE
		)
		y += 24.0

	_draw_centred(
		font, "%s  %d" % [Strings.get_text("total"), summary.get("total", 0)],
		centre, y + 22.0, 20, COLOUR_TOTAL
	)

	var hint := Strings.get_text("continue_hint")
	if next_title != "":
		hint = "%s: %s" % [Strings.get_text("next_level"), Strings.get_text(next_title)]
	_draw_centred(font, hint, centre, Config.VIEW_HEIGHT - 60.0, 12, COLOUR_HINT)
	if next_title != "":
		_draw_centred(
			font, Strings.get_text("continue_hint"),
			centre, Config.VIEW_HEIGHT - 40.0, 11, Color(1, 1, 1, 0.45)
		)


func _draw_centred(
	font: Font, text: String, centre: float, y: float, size: int, colour: Color
) -> void:
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	_canvas.draw_string(
		font, Vector2(centre - width * 0.5, y), text,
		HORIZONTAL_ALIGNMENT_LEFT, -1, size, colour
	)
