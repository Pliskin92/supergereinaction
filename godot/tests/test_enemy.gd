# Tests for scripts/enemy.gd and scripts/enemy_types.gd.
#
# The AI is driven with a plain Vector2 for the player's position, which is
# why tick() takes one rather than a Player: the whole behaviour can be
# tested without a scene tree, a sprite, or a real player.
#
# What is worth asserting is the things that make a crowd fair rather than
# merely difficult -- that a blow is telegraphed, that a pack does not move
# as one organism, that one swing lands once.
extends RefCounted

const STEP := 1.0 / 60.0


func _make(key := "minion") -> Enemy:
	var enemy := Enemy.new()
	enemy.setup(null, key)  # null library: no sprite needed for logic
	enemy.bounds = Rect2(0, 0, 1000, 400)
	enemy.position = Vector2(500, 200)
	# Tests drive the AI deterministically, so the random start is cleared.
	enemy._hesitation = 0.0
	enemy._cooldown = 0.0
	return enemy


func _tick(enemy: Enemy, seconds: float, player_pos: Vector2) -> void:
	for i in int(ceil(seconds / STEP)):
		enemy.tick(STEP, player_pos)


func run(t) -> void:
	t.describe("EnemyTypes — the table is coherent")
	for key in EnemyTypes.keys():
		var def := EnemyTypes.get_type(key)
		t.check(def.get("hp", 0) > 0, "%s has health" % key)
		t.check(def.get("damage", 0) > 0, "%s deals damage" % key)
		t.check(def.get("score", 0) > 0, "%s is worth points" % key)
		t.check(
			def.get("windup", 0.0) > 0.0,
			"%s telegraphs its blow, so it can be dodged" % key
		)
		t.check(
			def.get("preferred_gap", 0.0) > def.get("reach", 0.0),
			"%s stands further off than its reach, so it steps in to hit" % key
		)
	t.check(EnemyTypes.get_type("nonexistent").is_empty(), "an unknown type is empty")

	t.describe("EnemyTypes — the boss out-matches the street")
	var minion := EnemyTypes.get_type("minion")
	var boss := EnemyTypes.get_type("boss1")
	t.check(boss["hp"] > minion["hp"] * 4, "the boss takes far more punishment")
	t.check(boss["damage"] > minion["damage"], "and hits harder")
	t.check(boss["score"] > minion["score"], "and is worth more")

	t.describe("Enemy — spawns alive and idle")
	var e := _make()
	t.equal(e.state, Enemy.State.IDLE, "starts idle")
	t.check(e.is_alive(), "starts alive")
	t.equal(e.hp, minion["hp"], "starts at its type's health")

	t.describe("Enemy — approaches a distant player")
	e = _make()
	var start_x := e.position.x
	_tick(e, 0.5, Vector2(100, 200))  # player far to the left
	t.check(e.position.x < start_x, "moves toward the player")
	t.equal(e.facing, -1, "and turns to face them")

	t.describe("Enemy — stops at its preferred distance instead of overlapping")
	e = _make()
	var player_at := Vector2(100, 200)
	_tick(e, 20.0, player_at)
	var gap: float = absf(e.position.x - player_at.x)
	t.check(
		gap > minion["preferred_gap"] * 0.5,
		"it does not end up standing inside the player (gap %.0f)" % gap
	)

	t.describe("Enemy — a blow is telegraphed before it lands")
	e = _make()
	e.position = Vector2(140, 200)  # already in reach
	e.tick(STEP, Vector2(100, 200))
	t.equal(e.state, Enemy.State.WINDUP, "it squares up first")
	t.equal(e.pending_damage(), 0, "and deals nothing during the wind-up")
	_tick(e, minion["windup"] + 0.02, Vector2(100, 200))
	t.equal(e.state, Enemy.State.ATTACK, "then the swing comes")
	t.check(e.pending_damage() > 0, "which is when it can connect")

	t.describe("Enemy — one swing lands once")
	e = _make()
	e.position = Vector2(140, 200)
	_tick(e, minion["windup"] + 0.05, Vector2(100, 200))
	t.check(e.pending_damage() > 0, "the swing has damage to deal")
	e.mark_swing_spent()
	t.equal(e.pending_damage(), 0, "after landing it deals no more")

	t.describe("Enemy — it waits between attacks")
	e = _make()
	e.position = Vector2(140, 200)
	_tick(e, minion["windup"] + 0.4, Vector2(100, 200))
	t.check(e.state != Enemy.State.ATTACK, "the swing ends")
	t.check(e._cooldown > 0.0, "and a cooldown starts, so it cannot chain-swing")

	t.describe("Enemy — taking damage")
	e = _make()
	e.take_damage(10, 0.0)
	t.equal(e.hp, minion["hp"] - 10, "health drops")
	t.equal(e.state, Enemy.State.HURT, "and it is staggered")

	t.describe("Enemy — being hit interrupts its swing")
	e = _make()
	e.position = Vector2(140, 200)
	_tick(e, minion["windup"] + 0.05, Vector2(100, 200))
	t.equal(e.state, Enemy.State.ATTACK, "mid-swing")
	e.take_damage(5, 0.0)
	t.equal(e.state, Enemy.State.HURT, "a hit cuts the swing short")
	t.equal(e.pending_damage(), 0, "so the interrupted blow never lands")

	t.describe("Enemy — dying")
	e = _make()
	e.take_damage(minion["hp"], 0.0)
	t.equal(e.hp, 0, "health reaches zero")
	t.equal(e.state, Enemy.State.DEAD, "it is dead")
	t.check(not e.gone, "but the body is still on screen for its fall")
	_tick(e, 1.0, Vector2(100, 200))
	t.check(e.gone, "and is retired once the fall has played")

	t.describe("Enemy — a dead enemy stops fighting")
	e = _make()
	e.position = Vector2(140, 200)
	e.take_damage(999, 0.0)
	_tick(e, 0.5, Vector2(100, 200))
	t.equal(e.pending_damage(), 0, "it cannot land a blow after dying")

	t.describe("Enemy — a pack does not lunge as one")
	# Every enemy takes a random hesitation, so six of them spawned together
	# do not all decide identically on the same frame.
	var hesitations := {}
	for i in 12:
		var member := Enemy.new()
		member.setup(null, "minion")
		hesitations[snappedf(member._hesitation, 0.01)] = true
	t.check(hesitations.size() > 1, "spawned enemies get differing hesitations")

	t.describe("Enemy — it closes to strike, rather than parking out of reach")
	# The deadlock this caught: preferred_gap (96) is OUTSIDE reach (46), so
	# an enemy that only ever walked to its preferred distance stopped fifty
	# pixels short of its own swing and waited there forever. Three minions,
	# thirty simulated seconds, not one blow thrown.
	e = _make()
	e.position = Vector2(500, 200)
	var target := Vector2(100, 200)
	var swung := false
	for i in int(20.0 / STEP):
		e.tick(STEP, target)
		if e.state == Enemy.State.WINDUP or e.state == Enemy.State.ATTACK:
			swung = true
			break
	t.check(swung, "an enemy given time actually reaches the player and swings")

	t.describe("Enemy — and it can finish the job")
	# The other half: a fight that starts must be able to end. An enemy that
	# swings but whose blows never reach is the same deadlock wearing a
	# different face.
	e = _make()
	e.position = Vector2(300, 200)
	var landed := false
	for i in int(20.0 / STEP):
		e.tick(STEP, target)
		if e.pending_damage() > 0:
			landed = true
			break
	t.check(landed, "its swing reaches the point of dealing damage")

	t.describe("Enemy — stays inside the level")
	e = _make()
	e.position = Vector2(-500, -500)
	e._clamp_to_bounds()
	t.check(e.bounds.has_point(e.position), "an enemy outside the band is pulled back in")

	t.describe("Enemy — the boss is a different fight")
	var b := _make("boss1")
	t.check(b.is_boss(), "it knows it is a boss")
	t.check(b.hp > _make("minion").hp, "and has the health to prove it")
