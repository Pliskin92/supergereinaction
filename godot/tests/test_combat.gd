# Tests for scripts/combat.gd.
#
# This is where the player and the enemy finally meet, so these assert the
# rules that make a crowd fair: that a swing hits ONE target rather than
# sweeping a group, that you cannot punch someone behind you, that a roll
# passes through a blow, and that one swing is used up once it has reached
# its target whether or not it hurt anyone.
extends RefCounted

const STEP := 1.0 / 60.0


func _player() -> Player:
	var p := Player.new()
	p.bounds = Rect2(0, 0, 1000, 400)
	p.position = Vector2(300, 200)
	p.facing = 1
	return p


func _enemy(at: Vector2, key := "minion") -> Enemy:
	var e := Enemy.new()
	e.setup(null, key)
	e.bounds = Rect2(0, 0, 1000, 400)
	e.position = at
	e._hesitation = 0.0
	e._cooldown = 0.0
	return e


func run(t) -> void:
	t.describe("Combat — a punch connects with someone in front")
	var p := _player()
	var e := _enemy(Vector2(340, 200))
	p.handle_action("punch")
	var hit := Combat.resolve_player_attack(p, [e])
	t.check(hit == e, "the enemy in front is hit")
	t.check(e.hp < e.max_hp, "and loses health")

	t.describe("Combat — nothing happens when not attacking")
	p = _player()
	e = _enemy(Vector2(340, 200))
	t.check(Combat.resolve_player_attack(p, [e]) == null, "an idle player hits nobody")
	t.equal(e.hp, e.max_hp, "and the enemy is untouched")

	t.describe("Combat — you cannot punch behind you")
	p = _player()
	p.facing = 1
	e = _enemy(Vector2(240, 200))  # behind a right-facing player
	p.handle_action("punch")
	t.check(Combat.resolve_player_attack(p, [e]) == null, "a target at your back is missed")
	t.equal(e.hp, e.max_hp, "and takes nothing")

	t.describe("Combat — out of reach is a miss")
	p = _player()
	e = _enemy(Vector2(600, 200))
	p.handle_action("punch")
	t.check(Combat.resolve_player_attack(p, [e]) == null, "a distant enemy is missed")

	t.describe("Combat — a different lane is a miss")
	p = _player()
	e = _enemy(Vector2(340, 200 + Combat.DEPTH_TOLERANCE + 20.0))
	p.handle_action("punch")
	t.check(Combat.resolve_player_attack(p, [e]) == null, "an enemy in another lane is missed")

	t.describe("Combat — one swing hits ONE target, not the crowd")
	# A sweep would make a crowd trivial. This is the rule the whole
	# fighting rhythm rests on.
	p = _player()
	var near := _enemy(Vector2(330, 200))
	var far := _enemy(Vector2(350, 200))
	p.handle_action("punch")
	var struck := Combat.resolve_player_attack(p, [near, far])
	t.check(struck == near, "the nearest of two in range is the one hit")
	t.equal(far.hp, far.max_hp, "the other is untouched")

	t.describe("Combat — one swing lands once")
	p = _player()
	e = _enemy(Vector2(340, 200))
	p.handle_action("punch")
	Combat.resolve_player_attack(p, [e])
	var after_first := e.hp
	Combat.resolve_player_attack(p, [e])
	t.equal(e.hp, after_first, "resolving the same swing again does nothing")

	t.describe("Combat — a dead enemy cannot be hit again")
	p = _player()
	e = _enemy(Vector2(340, 200))
	e.take_damage(999, 0.0)
	p.handle_action("punch")
	t.check(Combat.resolve_player_attack(p, [e]) == null, "a corpse is not a target")

	t.describe("Combat — enemies hit the player")
	p = _player()
	e = _enemy(Vector2(340, 200))
	# Drive it to the point of swinging.
	for i in int(ceil((e.def["windup"] + 0.05) / STEP)):
		e.tick(STEP, p.position)
	t.check(e.pending_damage() > 0, "the enemy is mid-swing")
	var dealt := Combat.resolve_enemy_attacks([e], p)
	t.check(dealt > 0, "and the player is hurt")
	t.check(p.hp < Config.MAX_HP, "health drops")

	t.describe("Combat — a roll passes through a blow")
	p = _player()
	p.handle_action("roll")
	e = _enemy(Vector2(340, 200))
	for i in int(ceil((e.def["windup"] + 0.05) / STEP)):
		e.tick(STEP, p.position)
	Combat.resolve_enemy_attacks([e], p)
	t.equal(p.hp, Config.MAX_HP, "a rolling player takes nothing")
	t.equal(
		e.pending_damage(), 0,
		"and the swing is still spent, so it does not keep trying every frame"
	)

	t.describe("Combat — an enemy out of range misses")
	p = _player()
	e = _enemy(Vector2(700, 200))
	# Force it into a swing despite the distance.
	e.state = Enemy.State.ATTACK
	e._state_timer = 0.3
	e._swing_spent = false
	Combat.resolve_enemy_attacks([e], p)
	t.equal(p.hp, Config.MAX_HP, "a swing thrown from too far away does not connect")

	t.describe("Combat — FURY raises the damage a swing carries")
	p = _player()
	e = _enemy(Vector2(340, 200), "boss1")
	p.handle_action("punch")
	Combat.resolve_player_attack(p, [e])
	var normal_damage := e.max_hp - e.hp

	p = _player()
	p.fury_active = true
	var e2 := _enemy(Vector2(340, 200), "boss1")
	p.handle_action("punch")
	Combat.resolve_player_attack(p, [e2])
	t.check(
		(e2.max_hp - e2.hp) > normal_damage,
		"a transformed punch takes more off the boss"
	)

	t.finished()
