# On-screen controls for phones and tablets.
#
# The buttons feed Godot's own input system with synthetic actions rather
# than talking to the player directly. That means everything already built
# works unchanged: the level reads `punch`, the title screen reads
# `move_up` and `confirm`, and neither needs to know a finger sent it.
#
# The web version learned this the hard way in reverse -- its pad wrote
# gameplay state directly, so the shop could be browsed on a phone but
# never bought from, because the confirm key was never sent.
class_name TouchPad
extends CanvasLayer

# Buttons that are HELD (directions) and buttons that FIRE once (attacks).
# The distinction matters: a held direction must keep moving the player,
# while a held attack must not throw a punch every frame.
const BUTTONS := [
	{"action": "move_left", "label": "◀", "hold": true, "slot": "dpad_left"},
	{"action": "move_right", "label": "▶", "hold": true, "slot": "dpad_right"},
	{"action": "move_up", "label": "▲", "hold": true, "slot": "dpad_up"},
	{"action": "move_down", "label": "▼", "hold": true, "slot": "dpad_down"},
	{"action": "punch", "label": "A", "hold": false, "slot": "action_a"},
	{"action": "roll", "label": "B", "hold": false, "slot": "action_b"},
	{"action": "heavy", "label": "C", "hold": false, "slot": "action_c"},
	{"action": "jump", "label": "⇑", "hold": false, "slot": "action_jump"},
]

# Where each button sits, as a fraction of the viewport, measured from the
# nearer edge. Fractions rather than pixels so the pad lands in the same
# place on any screen.
const LAYOUT := {
	"dpad_left": Vector2(0.055, 0.80),
	"dpad_right": Vector2(0.185, 0.80),
	"dpad_up": Vector2(0.12, 0.66),
	"dpad_down": Vector2(0.12, 0.93),
	# Pressed into the bottom-right corner in a tight diamond. The walkable
	# band runs across the middle of the lower half of the screen, so
	# anything spread up the right-hand side sits ON the fight -- which the
	# first two layouts both did. A corner cluster costs a little reach and
	# keeps the players visible, which is the better trade.
	"action_a": Vector2(0.945, 0.93),
	"action_b": Vector2(0.845, 0.955),
	"action_c": Vector2(0.965, 0.79),
	"action_jump": Vector2(0.745, 0.905),
}

const RADIUS := 34.0
const PRIMARY_RADIUS := 42.0
const COLOUR_IDLE := Color(0.08, 0.06, 0.13, 0.42)
const COLOUR_PRESSED := Color(1.0, 0.84, 0.30, 0.45)
const COLOUR_RIM := Color(1.0, 1.0, 1.0, 0.30)
const COLOUR_LABEL := Color(1.0, 1.0, 1.0, 0.82)

var _canvas: Control
# finger id -> the button it is on, so two thumbs work at once and a finger
# sliding off a button releases it.
var _touches: Dictionary = {}


# Whether this device should get a pad at all. A desktop with a keyboard
# should not lose a corner of its screen to thumb buttons.
static func wanted() -> bool:
	# SG_FORCE_TOUCH lets the pad be seen on a desktop, which is the only
	# way to check its layout without a phone in hand.
	if OS.get_environment("SG_FORCE_TOUCH") != "":
		return true
	return DisplayServer.is_touchscreen_available()


func _ready() -> void:
	layer = 10  # above the HUD
	_canvas = Control.new()
	_canvas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_canvas.draw.connect(_draw_pad)
	add_child(_canvas)


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_handle_touch(event)
	elif event is InputEventScreenDrag:
		_handle_drag(event)


func _handle_touch(event: InputEventScreenTouch) -> void:
	if event.pressed:
		var button := _button_at(event.position)
		if button.is_empty():
			return
		_touches[event.index] = button
		_press(button, true)
	else:
		_release_finger(event.index)
	_canvas.queue_redraw()


# A finger that slides off a button releases it and presses whatever it
# slid onto, so the pad does not stick when a thumb drifts.
func _handle_drag(event: InputEventScreenDrag) -> void:
	var was: Dictionary = _touches.get(event.index, {})
	var now := _button_at(event.position)
	if was == now:
		return
	_release_finger(event.index)
	if not now.is_empty():
		_touches[event.index] = now
		_press(now, true)
	_canvas.queue_redraw()


func _release_finger(index: int) -> void:
	if not _touches.has(index):
		return
	var button: Dictionary = _touches[index]
	# Only held buttons need releasing: a tap button already fired once.
	if button.get("hold", false):
		_press(button, false)
	_touches.erase(index)


# Feeds the action into Godot's input system, so everything downstream sees
# an ordinary action press.
func _press(button: Dictionary, pressed: bool) -> void:
	var action: String = button["action"]
	if pressed:
		Input.action_press(action)
		# A tap button is released on the same frame it is pressed, which is
		# what makes is_action_pressed() fire once rather than every frame
		# the thumb rests there.
		if not button.get("hold", false):
			_release_next_frame(action)
	else:
		Input.action_release(action)


func _release_next_frame(action: String) -> void:
	await get_tree().process_frame
	Input.action_release(action)


func _button_at(position: Vector2) -> Dictionary:
	for button in BUTTONS:
		var centre := _centre_of(button)
		var radius := PRIMARY_RADIUS if button["slot"] == "action_a" else RADIUS
		# A generous touch target: a finger is wider than the circle drawn,
		# and a miss on a game pad is worse than an overlap.
		if position.distance_to(centre) <= radius * 1.25:
			return button
	return {}


func _centre_of(button: Dictionary) -> Vector2:
	var fraction: Vector2 = LAYOUT[button["slot"]]
	var size := _canvas.size
	return Vector2(fraction.x * size.x, fraction.y * size.y)


func _draw_pad() -> void:
	var font := ThemeDB.fallback_font
	var held: Array = []
	for button in _touches.values():
		held.append(button["slot"])
	for button in BUTTONS:
		var centre := _centre_of(button)
		var radius := PRIMARY_RADIUS if button["slot"] == "action_a" else RADIUS
		var pressed: bool = held.has(button["slot"])
		_canvas.draw_circle(centre, radius, COLOUR_PRESSED if pressed else COLOUR_IDLE)
		_canvas.draw_arc(centre, radius, 0.0, TAU, 32, COLOUR_RIM, 2.0)
		var label: String = button["label"]
		var text_size := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 20)
		_canvas.draw_string(
			font, centre + Vector2(-text_size.x * 0.5, text_size.y * 0.32), label,
			HORIZONTAL_ALIGNMENT_LEFT, -1, 20, COLOUR_LABEL
		)
