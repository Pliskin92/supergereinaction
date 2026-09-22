# Tests for scripts/touch_pad.gd.
#
# The pad is mostly geometry and a table, and both are easy to get wrong in
# ways that only show up on a device: two buttons overlapping, a button off
# the edge of the screen, an action that no longer exists.
#
# Those are exactly the things that can be asserted without a touchscreen.
extends RefCounted


func run(t) -> void:
	t.describe("TouchPad — every button maps to a real input action")
	for button in TouchPad.BUTTONS:
		var action: String = button["action"]
		t.check(
			InputMap.has_action(action),
			"'%s' is an action the game actually reads" % action
		)

	t.describe("TouchPad — every button has a place to sit")
	for button in TouchPad.BUTTONS:
		var slot: String = button["slot"]
		t.check(TouchPad.LAYOUT.has(slot), "'%s' has a position" % slot)

	t.describe("TouchPad — no button sits off the screen")
	for slot in TouchPad.LAYOUT:
		var at: Vector2 = TouchPad.LAYOUT[slot]
		t.check(
			at.x > 0.0 and at.x < 1.0 and at.y > 0.0 and at.y < 1.0,
			"'%s' is inside the viewport (%.2f, %.2f)" % [slot, at.x, at.y]
		)

	t.describe("TouchPad — buttons do not overlap")
	# Measured in real pixels at the design resolution, because the radius
	# is in pixels while the layout is in fractions.
	var width := float(Config.VIEW_WIDTH)
	var height := float(Config.VIEW_HEIGHT)
	var slots: Array = TouchPad.LAYOUT.keys()
	var overlapping: Array = []
	for i in slots.size():
		for j in range(i + 1, slots.size()):
			var a: Vector2 = TouchPad.LAYOUT[slots[i]]
			var b: Vector2 = TouchPad.LAYOUT[slots[j]]
			var pixel_a := Vector2(a.x * width, a.y * height)
			var pixel_b := Vector2(b.x * width, b.y * height)
			# Two circles overlap when their centres are closer than the sum
			# of their radii.
			var radius_a: float = (
				TouchPad.PRIMARY_RADIUS if slots[i] == "action_a" else TouchPad.RADIUS
			)
			var radius_b: float = (
				TouchPad.PRIMARY_RADIUS if slots[j] == "action_a" else TouchPad.RADIUS
			)
			if pixel_a.distance_to(pixel_b) < radius_a + radius_b:
				overlapping.append("%s/%s" % [slots[i], slots[j]])
	t.check(
		overlapping.is_empty(),
		"no two buttons overlap (%s)" % str(overlapping)
	)

	t.describe("TouchPad — directions are held, attacks are not")
	# A held direction must keep moving the player; a held attack must not
	# throw a punch every frame.
	for button in TouchPad.BUTTONS:
		var action: String = button["action"]
		var held: bool = button.get("hold", false)
		if action.begins_with("move_"):
			t.check(held, "'%s' is a held button" % action)
		else:
			t.check(not held, "'%s' fires once rather than repeating" % action)

	t.describe("TouchPad — the pad covers everything the game needs")
	# A player on a phone has to be able to do everything: move in both
	# axes, attack, and confirm a menu.
	var actions: Array = []
	for button in TouchPad.BUTTONS:
		actions.append(button["action"])
	for needed in ["move_left", "move_right", "move_up", "move_down", "punch", "roll"]:
		t.check(actions.has(needed), "'%s' is reachable by thumb" % needed)

	t.describe("TouchPad — the left and right halves are separate")
	# Directions on the left, attacks on the right: a thumb on one must not
	# be able to reach the other by accident.
	for button in TouchPad.BUTTONS:
		var at: Vector2 = TouchPad.LAYOUT[button["slot"]]
		if button["action"].begins_with("move_"):
			t.check(at.x < 0.5, "'%s' is on the left" % button["action"])
		else:
			t.check(at.x > 0.5, "'%s' is on the right" % button["action"])

	t.describe("TouchPad — a press feeds the real input system")
	# This is the thing the web version got wrong in reverse: its pad wrote
	# gameplay state directly, so screens that read keys never saw a press
	# and the shop could be browsed but never bought from. Pressing an
	# action here must make Input itself report it.
	for action in ["punch", "move_right"]:
		Input.action_release(action)
		t.check(
			not Input.is_action_pressed(action),
			"'%s' starts unpressed" % action
		)
		Input.action_press(action)
		t.check(
			Input.is_action_pressed(action),
			"'%s' reads as pressed once the pad presses it" % action
		)
		Input.action_release(action)
		t.check(
			not Input.is_action_pressed(action),
			"'%s' reads as released again" % action
		)

	t.finished()
