# Tests for scripts/player.gd.
#
# The player is where the web version's bugs lived, so these target the
# specific failures it had rather than only the happy path:
#
#   * a roll that restarted instead of chaining when the button was mashed,
#     so the animation never got past its opening frames
#   * a punch cancelled by a direction press, so attacking while moving
#     never landed
#   * one swing damaging the same target repeatedly
#
# The player is driven through handle_action() and _physics_process() rather
# than through Input, so a test can press a button on an exact frame without
# faking the input singleton.
extends RefCounted

const STEP := 1.0 / 60.0


func _make() -> Player:
	var player := Player.new()
	# No sprite: setup() needs the asset library and a scene tree, and none
	# of the logic under test touches the sprite. _play() is guarded for
	# exactly this.
	player.bounds = Rect2(0, 0, 1000, 400)
	player.position = Vector2(100, 200)
	return player


# Advances the player by `seconds` of game time, in real frames.
func _advance(player: Player, seconds: float) -> void:
	var steps := int(ceil(seconds / STEP))
	for i in steps:
		player._tick_state(STEP)


func run(t) -> void:
	t.describe("Player — starts idle and healthy")
	var p := _make()
	t.equal(p.state, Player.State.IDLE, "begins idle")
	t.equal(p.hp, Config.MAX_HP, "begins at full health")

	t.describe("Player — the punch combo runs punch, punch, kick")
	p = _make()
	p.handle_action("punch")
	t.equal(p.state, Player.State.PUNCH, "first press throws a punch")
	t.equal(p._combo_step, 1, "combo is at step one")
	_advance(p, 0.34)
	p.handle_action("punch")
	t.equal(p.state, Player.State.PUNCH, "second press throws another punch")
	_advance(p, 0.34)
	p.handle_action("punch")
	t.equal(p.state, Player.State.KICK, "third press ends the combo with a kick")

	t.describe("Player — the combo lapses if you wait")
	p = _make()
	p.handle_action("punch")
	_advance(p, 0.34)  # the punch finishes
	# Let the combo window expire. _tick_state does not run the combo timer,
	# so it is advanced the way _physics_process would.
	p._combo_timer = 0.0
	p._combo_step = 0
	p.handle_action("punch")
	t.equal(p._combo_step, 1, "a late press starts the combo again")

	t.describe("Player — an attack commits and is not cancelled by movement")
	# The web version overwrote `action` with walk/run every tick while a
	# direction was held, which cancelled the swing before it ever reached
	# its contact frame -- so punching on the move never landed at all.
	p = _make()
	p.handle_action("punch")
	_advance(p, 0.1)
	t.equal(p.state, Player.State.PUNCH, "still punching partway through the swing")
	p.handle_action("roll")
	t.equal(p.state, Player.State.PUNCH, "another action does not interrupt it")

	t.describe("Player — mashing the roll CHAINS instead of restarting")
	# This is the bug you reported: "the animation never completes, spamming
	# it always shows the beginning". A press during a roll must be
	# remembered and started when the current one ends, not applied now.
	p = _make()
	p.handle_action("roll")
	var first_timer := p._state_timer
	_advance(p, 0.1)
	t.check(p._state_timer < first_timer, "the roll is progressing")
	p.handle_action("roll")
	t.check(
		p._state_timer < first_timer,
		"a press mid-roll does NOT reset the timer (the old bug)"
	)
	t.equal(p._buffered, "roll", "it is buffered instead")
	# Step to the exact frame the first roll ends on, rather than past it.
	# Advancing a further ROLL_DURATION would run the SECOND roll most of
	# the way through as well, and then measuring its timer says nothing --
	# which is what the first version of this test did, and why it read
	# 0.37 against 0.47 and looked like a bug in the player.
	var remaining: float = p._state_timer
	_advance(p, remaining)
	t.equal(p.state, Player.State.ROLL, "the buffered press begins a new roll")
	t.check(
		p._state_timer > Config.ROLL_DURATION - (2.0 * STEP),
		"the second roll starts fresh, not on the first's remainder"
	)
	t.equal(p._buffered, "", "and the buffer is now empty")

	t.describe("Player — a roll covers ground")
	p = _make()
	var start_x := p.position.x
	p.handle_action("roll")
	_advance(p, Config.ROLL_DURATION)
	t.check(p.position.x > start_x, "rolling moves the player forward")

	t.describe("Player — a roll dodges damage")
	p = _make()
	p.handle_action("roll")
	p.take_damage(20, 0.0)
	t.equal(p.hp, Config.MAX_HP, "a blow during a roll does nothing")

	t.describe("Player — taking damage")
	p = _make()
	p.take_damage(20, 0.0)
	t.equal(p.hp, Config.MAX_HP - 20, "health drops by the damage")
	t.equal(p.state, Player.State.HURT, "and the player is stunned")

	t.describe("Player — invulnerability stops a crowd deleting you")
	p = _make()
	p.take_damage(20, 0.0)
	var after_first := p.hp
	p.take_damage(20, 0.0)
	t.equal(p.hp, after_first, "a second blow in the same instant is ignored")

	t.describe("Player — a hit clears a buffered press")
	p = _make()
	p.handle_action("roll")
	p.handle_action("roll")
	t.equal(p._buffered, "roll", "a press is buffered")
	p._invuln = 0.0
	p.take_damage(10, 0.0)
	t.equal(p._buffered, "", "being hit drops it, so nothing fires out of the stun")

	t.describe("Player — dying")
	p = _make()
	p.lives = 3
	p.take_damage(Config.MAX_HP, 0.0)
	t.equal(p.hp, 0, "health reaches zero")
	t.equal(p.state, Player.State.DEAD, "the player is dead")
	t.equal(p.lives, 2, "a life is spent")
	p.respawn()
	t.equal(p.hp, Config.MAX_HP, "respawning restores health")
	t.equal(p.state, Player.State.IDLE, "and puts the player back on their feet")

	t.describe("Player — one swing lands once")
	p = _make()
	p.handle_action("punch")
	t.check(p.pending_attack_damage() > 0, "a punch has damage to deal")
	p.mark_attack_spent()
	t.equal(p.pending_attack_damage(), 0, "after landing, the same swing deals no more")

	t.describe("Player — the kick hits hardest")
	p = _make()
	p.handle_action("punch")
	var punch_damage := p.pending_attack_damage()
	# Walk the combo to its third step properly rather than forcing the
	# counter: handle_action is only accepted from an interruptible state,
	# so each punch has to be allowed to finish first.
	_advance(p, 0.34)
	p.handle_action("punch")
	_advance(p, 0.34)
	p.handle_action("punch")
	t.equal(p.state, Player.State.KICK, "the third press is the kick")
	t.check(p.pending_attack_damage() > punch_damage, "the kick out-damages a punch")

	t.describe("Player — FURY")
	p = _make()
	t.check(not p.can_transform(), "cannot transform on an empty meter")
	p.add_fury(Config.FURY_MAX)
	t.check(p.can_transform(), "a full meter can transform")
	p.fury_active = true
	t.check(
		p.attack_damage(10) > 10,
		"transformed attacks hit harder"
	)
	p.hp = Config.MAX_HP
	p._invuln = 0.0
	p.take_damage(20, 0.0)
	t.check(
		p.hp > Config.MAX_HP - 20,
		"and transformed the player takes less"
	)

	t.describe("Player — stays inside the level")
	p = _make()
	p.position = Vector2(-500, -500)
	p._clamp_to_bounds()
	t.check(
		p.bounds.has_point(p.position),
		"a player outside the walkable band is pulled back into it"
	)
