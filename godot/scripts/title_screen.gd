# The title screen: the front door.
#
# A menu driven by the same input actions as the game, so a player who can
# play can navigate without learning a second scheme -- and so the touch pad
# will drive it for free when it arrives.
#
# The options are settings, not a run: changing the language or the
# difficulty here saves immediately and outlives the playthrough.
class_name TitleScreen
extends Node2D

enum Screen { MENU, OPTIONS }

const ITEMS := ["new_game", "options"]
const OPTION_ROWS := ["language", "difficulty"]

const COLOUR_BACKDROP := Color(0.05, 0.04, 0.10)
const COLOUR_TITLE := Color(1.0, 0.84, 0.30)
const COLOUR_SUBTITLE := Color(1.0, 0.16, 0.52)
const COLOUR_SELECTED := Color(0.0, 0.96, 0.83)
const COLOUR_ITEM := Color(0.81, 0.79, 0.88)
const COLOUR_HINT := Color(1.0, 1.0, 1.0, 0.5)

var screen: Screen = Screen.MENU
var index := 0
var option_index := 0

var _canvas: Control
var _tick := 0.0


func _ready() -> void:
	_canvas = Control.new()
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_title)
	add_child(_canvas)
	if TouchPad.wanted():
		add_child(TouchPad.new())


func _process(delta: float) -> void:
	_tick += delta
	_canvas.queue_redraw()


func _unhandled_input(event: InputEvent) -> void:
	if screen == Screen.MENU:
		_menu_input(event)
	else:
		_options_input(event)


func _menu_input(event: InputEvent) -> void:
	if event.is_action_pressed("move_up"):
		index = wrapi(index - 1, 0, ITEMS.size())
	elif event.is_action_pressed("move_down"):
		index = wrapi(index + 1, 0, ITEMS.size())
	elif event.is_action_pressed("confirm") or event.is_action_pressed("jump"):
		_select()


func _options_input(event: InputEvent) -> void:
	if event.is_action_pressed("move_up"):
		option_index = wrapi(option_index - 1, 0, OPTION_ROWS.size())
	elif event.is_action_pressed("move_down"):
		option_index = wrapi(option_index + 1, 0, OPTION_ROWS.size())
	elif event.is_action_pressed("move_left"):
		_cycle_option(-1)
	elif event.is_action_pressed("move_right"):
		_cycle_option(1)
	elif event.is_action_pressed("confirm") or event.is_action_pressed("cancel"):
		screen = Screen.MENU


func _select() -> void:
	var choice: String = ITEMS[index]
	match choice:
		"new_game":
			# A fresh run, so a previous playthrough cannot leak into it.
			GameState.reset_run()
			get_tree().change_scene_to_file("res://scenes/level.tscn")
		"options":
			screen = Screen.OPTIONS


func _cycle_option(direction: int) -> void:
	var row: String = OPTION_ROWS[option_index]
	match row:
		"language":
			var languages: Array = Strings.TABLE.keys()
			var at := languages.find(GameState.language)
			GameState.language = languages[wrapi(at + direction, 0, languages.size())]
		"difficulty":
			var levels: Array = Config.DIFFICULTIES.keys()
			var at := levels.find(GameState.difficulty)
			GameState.difficulty = levels[wrapi(at + direction, 0, levels.size())]
			# The lives a run starts with follow the difficulty, so the
			# change is visible immediately rather than only on the next run.
			GameState.reset_run()
	GameState.save_settings()


func _draw_title() -> void:
	var font := ThemeDB.fallback_font
	var width := float(Config.VIEW_WIDTH)
	var centre := width * 0.5
	_canvas.draw_rect(Rect2(0, 0, width, Config.VIEW_HEIGHT), COLOUR_BACKDROP, true)

	# A gentle bob, so the screen is alive rather than a still image.
	var bob := sin(_tick * 2.0) * 3.0
	_centred(font, "SUPER GERE", centre, 130.0 + bob, 46, COLOUR_TITLE)
	_centred(font, "PARISE RESCUE", centre, 162.0 + bob, 18, COLOUR_SUBTITLE)

	if screen == Screen.MENU:
		_draw_menu(font, centre)
	else:
		_draw_options(font, centre)


func _draw_menu(font: Font, centre: float) -> void:
	var y := 280.0
	for i in ITEMS.size():
		var selected := i == index
		var text: String = Strings.get_text(ITEMS[i])
		_centred(
			font, text, centre, y, 20 if selected else 17,
			COLOUR_SELECTED if selected else COLOUR_ITEM
		)
		if selected:
			# A blinking marker, so the selection reads at a glance.
			if fmod(_tick, 0.8) < 0.5:
				var half := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x * 0.5
				_canvas.draw_string(
					font, Vector2(centre - half - 26.0, y), "▶",
					HORIZONTAL_ALIGNMENT_LEFT, -1, 16, COLOUR_SUBTITLE
				)
		y += 40.0
	_centred(
		font, Strings.get_text("menu_hint"), centre,
		Config.VIEW_HEIGHT - 36.0, 11, COLOUR_HINT
	)


func _draw_options(font: Font, centre: float) -> void:
	var y := 290.0
	for i in OPTION_ROWS.size():
		var selected := i == option_index
		var row: String = OPTION_ROWS[i]
		var value := ""
		if row == "language":
			value = Strings.get_text("language_" + GameState.language)
		else:
			value = "%s (%d♥)" % [
				Strings.get_text("difficulty_" + GameState.difficulty),
				Config.lives_for(GameState.difficulty),
			]
		var text := "%s:  ◀  %s  ▶" % [Strings.get_text(row), value]
		_centred(
			font, text, centre, y, 16,
			COLOUR_SELECTED if selected else COLOUR_ITEM
		)
		y += 36.0
	_centred(
		font, Strings.get_text("options_hint"), centre,
		Config.VIEW_HEIGHT - 36.0, 11, COLOUR_HINT
	)


func _centred(
	font: Font, text: String, centre: float, y: float, size: int, colour: Color
) -> void:
	var width := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	_canvas.draw_string(
		font, Vector2(centre - width * 0.5, y), text,
		HORIZONTAL_ALIGNMENT_LEFT, -1, size, colour
	)
