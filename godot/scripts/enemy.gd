# One enemy: approach, commit, swing, recover.
#
# The AI is deliberately small. A beat-em-up enemy is not meant to outthink
# the player -- it is meant to be readable, so a crowd of them makes a
# rhythm the player can learn. Every decision here is either "get to my
# preferred distance" or "I have waited long enough, swing".
#
# Two things matter more than cleverness, and both were bugs in the web
# version:
#
#   * A WINDUP before the blow lands, so an attack can be seen coming and
#     rolled away from. Without it a crowd is unfair rather than difficult.
#   * A per-enemy HESITATION, so a group does not all lunge on the same
#     frame. Six identical enemies deciding identically is one big enemy.
class_name Enemy
extends Node2D

signal died(enemy: Enemy)

enum State { IDLE, APPROACH, WINDUP, ATTACK, HURT, DEAD }

var type_key := ""
var def: Dictionary = {}
var hp := 1
var max_hp := 1
var facing := -1
var state: State = State.IDLE
# Set once the death animation has played out, so the level can drop it.
var gone := false

var bounds := Rect2(0, 0, 960, 540)

var _state_timer := 0.0
var _cooldown := 0.0
# A small random delay before this one commits, so a pack does not move as
# a single organism.
var _hesitation := 0.0
# True once this swing has dealt its damage: one swing lands once.
var _swing_spent := false
var _sprite: CharacterSprite


func setup(library: SpriteLibrary, key: String) -> void:
	type_key = key
	def = EnemyTypes.get_type(key)
	hp = def.get("hp", 1)
	max_hp = hp
	_cooldown = randf() * def.get("cooldown", 1.0)
	_hesitation = randf() * 0.6
	if library != null:
		_sprite = CharacterSprite.new()
		_sprite.setup(library, def.get("character", key))
		for clip in ["idle_right", "walk_right", "punch", "hurt", "fall"]:
			_sprite.add_clip(clip)
		add_child(_sprite)
		_play("idle_right")


func is_boss() -> bool:
	return def.get("boss", false)


func is_alive() -> bool:
	return state != State.DEAD


# `player_pos` rather than the player object: an enemy needs to know where
# the player is, not to be able to reach into them. That also lets a test
# drive the AI with a plain Vector2.
func tick(delta: float, player_pos: Vector2) -> void:
	if state == State.DEAD:
		_state_timer -= delta
		if _state_timer <= 0.0:
			gone = true
		return

	if _cooldown > 0.0:
		_cooldown -= delta

	match state:
		State.IDLE, State.APPROACH:
			_think(delta, player_pos)
		State.WINDUP:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = State.ATTACK
				_state_timer = 0.3
				_swing_spent = false
				_play("punch")
		State.ATTACK:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = State.IDLE
				_cooldown = def.get("cooldown", 1.0)
				_play("idle_right")
		State.HURT:
			_state_timer -= delta
			if _state_timer <= 0.0:
				state = State.IDLE
				_play("idle_right")

	_clamp_to_bounds()
	if _sprite != null:
		_sprite.flip_h = facing > 0


# Close to the preferred distance, then swing once the cooldown allows.
func _think(delta: float, player_pos: Vector2) -> void:
	var to_player := player_pos - position
	facing = 1 if to_player.x > 0.0 else -1
	var gap := absf(to_player.x)
	var depth := absf(to_player.y)

	if _hesitation > 0.0:
		_hesitation -= delta
		return

	var speed: float = def.get("speed", 40.0)
	var reach: float = def.get("reach", 50.0)
	var preferred: float = def.get("preferred_gap", 90.0)
	# Off cooldown it is COMMITTING: it closes all the way to its reach and
	# swings. Otherwise it hangs back at its preferred distance.
	#
	# This distinction is the whole AI, and getting it wrong deadlocks the
	# fight: preferred_gap (96) is outside reach (46), so an enemy that only
	# ever walked to its preferred distance would park fifty pixels short of
	# its own swing and wait there forever. Measured in a simulated fight --
	# three minions, thirty seconds, not one blow thrown.
	var target_gap := reach * 0.8 if _cooldown <= 0.0 else preferred

	# In range, lined up, and off cooldown: swing.
	if gap <= reach and depth < 30.0 and _cooldown <= 0.0:
		state = State.WINDUP
		_state_timer = def.get("windup", 0.2)
		_play("idle_right")
		return

	var moved := false
	if gap > target_gap:
		position.x += signf(to_player.x) * speed * delta
		moved = true
	elif gap < target_gap * 0.6:
		# Too close: back off, rather than jittering on the spot.
		position.x -= signf(to_player.x) * speed * delta
		moved = true
	# Line up in depth as well, or blows are thrown at someone a lane away.
	if depth > 8.0:
		position.y += signf(to_player.y) * minf(speed, depth / delta) * delta
		moved = true

	if moved and state != State.APPROACH:
		state = State.APPROACH
		_play("walk_right")
	elif not moved and state != State.IDLE:
		state = State.IDLE
		_play("idle_right")


func _clamp_to_bounds() -> void:
	position.x = clampf(position.x, bounds.position.x, bounds.end.x)
	position.y = clampf(position.y, bounds.position.y, bounds.end.y)


# The damage this enemy's current swing deals, or 0 if it is not at the
# point of connecting. The level asks; the enemy does not reach into the
# player.
func pending_damage() -> int:
	if state != State.ATTACK or _swing_spent:
		return 0
	return def.get("damage", 0)


func mark_swing_spent() -> void:
	_swing_spent = true


func take_damage(amount: int, from_x: float) -> void:
	if state == State.DEAD:
		return
	hp = maxi(0, hp - amount)
	facing = 1 if from_x > position.x else -1
	if hp <= 0:
		state = State.DEAD
		# Long enough for the fall to play before the body is retired.
		_state_timer = 0.8
		_play("fall")
		died.emit(self)
		return
	# Being hit interrupts a swing, so trading blows favours whoever lands
	# first rather than both connecting.
	state = State.HURT
	_state_timer = Config.HIT_STUN
	_play("hurt")


func _play(clip: String) -> void:
	if _sprite == null or _sprite.sprite_frames == null:
		return
	if not _sprite.sprite_frames.has_animation(clip):
		return
	_sprite.animation = clip
	_sprite.frame = 0
	_sprite.play()
