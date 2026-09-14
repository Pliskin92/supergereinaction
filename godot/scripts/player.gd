# The player character.
#
# A beat-em-up player moves in two dimensions but is drawn in one plane: x is
# along the street, y is depth through the lane, and the sprite is sorted by
# y so whoever stands further down draws in front. There is no platforming
# gravity -- a jump is an arc the sprite rises through while its ground
# position keeps moving.
#
# State lives in an explicit enum rather than in a scatter of booleans. The
# web version tracked `action`, `moveTimer`, `attackHit`, `punchBuffer` and
# `comboStep` separately, and most of its combat bugs were two of those
# disagreeing. Here a state is one value, and what is legal from it is
# decided in one place.
class_name Player
extends Node2D

signal health_changed(hp: int, max_hp: int)
signal died
signal fury_changed(fury: float)

enum State { IDLE, WALK, RUN, PUNCH, KICK, HEAVY, ROLL, JUMP, HURT, DEAD }

# The walkable band, in world coordinates. Set by the level; the player
# clamps itself into it rather than the level policing the player.
var bounds := Rect2(0, 0, 960, 540)

var state: State = State.IDLE
var facing := 1
var hp := Config.MAX_HP
var max_hp := Config.MAX_HP
var lives := Config.DEFAULT_LIVES
var fury := 0.0
var fury_active := false

# How long the current state has left. A state with a duration runs to its
# end before anything but a hit can interrupt it -- which is what makes a
# punch commit rather than being cancelled by a direction press.
var _state_timer := 0.0
# Seconds of invulnerability left after taking a hit.
var _invuln := 0.0
# A press made during an uninterruptible state, released when it ends. This
# is what turns a mashed button into a chain rather than a restart -- the
# bug that made the web version's roll replay its first frames forever.
var _buffered := ""
# Where the punch combo is: 0 none, 1-2 punches, 3 the kick that ends it.
var _combo_step := 0
var _combo_timer := 0.0
# Set when the current attack has already dealt its damage, so one swing
# lands once.
var _attack_spent := false

var _sprite: CharacterSprite
var _library: SpriteLibrary


func setup(library: SpriteLibrary, character := "gere") -> void:
	_library = library
	_sprite = CharacterSprite.new()
	_sprite.setup(library, character)
	for clip in ["idle_right", "walk_right", "run_right", "jump_right",
			"punch", "kick", "heavy", "roll", "hurt", "fall"]:
		_sprite.add_clip(clip)
	add_child(_sprite)
	_play("idle_right")


func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return
	_tick_state(delta)
	_apply_facing()


# Advances whatever the player is currently doing. Movement is per second,
# not per frame: the web version moved per frame, which tied its feel to the
# frame rate.
func _tick_state(delta: float) -> void:
	# The timers live here rather than in _physics_process so that anything
	# driving the player frame by frame -- a test, a replay, a simulated
	# fight -- advances them too. Keeping them in _physics_process meant the
	# combo window never lapsed under test, so the combo could never reach
	# its third step and the kick was unreachable outside a real run.
	if _invuln > 0.0:
		_invuln -= delta
	if _combo_timer > 0.0:
		_combo_timer -= delta
		if _combo_timer <= 0.0:
			_combo_step = 0

	match state:
		State.IDLE, State.WALK, State.RUN:
			_move_free(delta)
		State.ROLL:
			position.x += facing * Config.ROLL_SPEED * delta
			_advance_timed(delta)
		State.PUNCH, State.KICK, State.HEAVY:
			_advance_timed(delta)
		State.JUMP:
			_move_free(delta)  # a jump can still be steered
			_advance_timed(delta)
		State.HURT:
			_advance_timed(delta)
	_clamp_to_bounds()


# Counts a timed state down and hands over when it ends -- to a buffered
# press if one is waiting, or back to idle.
func _advance_timed(delta: float) -> void:
	_state_timer -= delta
	if _state_timer > 0.0:
		return
	var queued := _buffered
	_buffered = ""
	if queued != "":
		_begin(queued)
	else:
		_to_idle()


func _move_free(delta: float) -> void:
	var dir := Vector2(
		Input.get_axis("move_left", "move_right"),
		Input.get_axis("move_up", "move_down")
	)
	if dir.x != 0.0:
		facing = 1 if dir.x > 0.0 else -1
	var running := Input.is_action_pressed("run")
	var speed := Config.RUN_SPEED if running else Config.WALK_SPEED
	if fury_active:
		speed *= Config.FURY_RUN_MULTIPLIER
	position.x += dir.x * speed * delta
	# Depth is always fast, independent of the run key: a player has to be
	# able to sidestep an attack reliably.
	position.y += dir.y * Config.DODGE_SPEED * delta

	# Only free states re-pick their animation from movement; a jump keeps
	# its own clip while it steers.
	if state == State.JUMP:
		return
	if dir == Vector2.ZERO:
		if state != State.IDLE:
			state = State.IDLE
			_play("idle_right")
	elif running:
		if state != State.RUN:
			state = State.RUN
			_play("run_right")
	elif state != State.WALK:
		state = State.WALK
		_play("walk_right")


func _clamp_to_bounds() -> void:
	position.x = clampf(position.x, bounds.position.x, bounds.end.x)
	position.y = clampf(position.y, bounds.position.y, bounds.end.y)


func _apply_facing() -> void:
	if _sprite != null:
		# The packs are all authored facing right.
		_sprite.flip_h = facing < 0


# ---- Input ----
# Called by the level rather than read here, so the same player can be
# driven by a replay or a test without faking Input.
func handle_action(action: String) -> void:
	if state == State.DEAD:
		return
	if _is_interruptible():
		_begin(action)
	elif _accepts_buffer(action):
		# Remembered rather than dropped or applied now: pressing during a
		# swing should chain into the next one, not restart this one.
		_buffered = action


func _is_interruptible() -> bool:
	return state in [State.IDLE, State.WALK, State.RUN]


# Which presses are worth remembering. A direction is not: movement is read
# continuously, so buffering one would fire a stale step.
func _accepts_buffer(action: String) -> bool:
	return action in ["punch", "roll", "heavy", "jump"]


func _begin(action: String) -> void:
	match action:
		"punch":
			_begin_punch()
		"roll":
			state = State.ROLL
			_state_timer = Config.ROLL_DURATION
			_attack_spent = false
			_play("roll")
		"heavy":
			state = State.HEAVY
			_state_timer = 0.5
			_attack_spent = false
			_play("heavy")
		"jump":
			state = State.JUMP
			_state_timer = 0.6
			_play("jump_right")


# The three-step combo: punch, punch, kick. Each press inside the window
# advances it; letting the window lapse starts again from the first.
func _begin_punch() -> void:
	_combo_step += 1
	if _combo_step > 3:
		_combo_step = 1
	_combo_timer = Config.COMBO_WINDOW
	_attack_spent = false
	if _combo_step == 3:
		state = State.KICK
		_state_timer = 0.42
		_play("kick")
	else:
		state = State.PUNCH
		_state_timer = 0.33
		_play("punch")


func _to_idle() -> void:
	state = State.IDLE
	_play("idle_right")


func _play(clip: String) -> void:
	if _sprite == null or _sprite.sprite_frames == null:
		return
	if not _sprite.sprite_frames.has_animation(clip):
		return
	_sprite.animation = clip
	_sprite.frame = 0
	_sprite.play()


# ---- Damage ----
func take_damage(amount: int, from_x: float) -> void:
	if state == State.DEAD or _invuln > 0.0:
		return
	# A roll is the escape: it passes through blows, which is what makes it
	# worth using rather than just a faster walk. The buffered press is
	# still dropped, though -- being swung at mid-roll should not leave a
	# queued attack to fire out of the far side of it.
	if state == State.ROLL:
		_buffered = ""
		return
	var scaled := amount
	if fury_active:
		scaled = int(ceil(float(amount) / Config.FURY_DEFENCE_MULTIPLIER))
	hp = maxi(0, hp - scaled)
	_invuln = Config.INVULN_AFTER_HIT
	facing = 1 if from_x < position.x else -1
	health_changed.emit(hp, max_hp)
	if hp <= 0:
		_die()
		return
	state = State.HURT
	_state_timer = Config.HIT_STUN
	_buffered = ""  # a hit cancels whatever was queued
	_play("hurt")


func _die() -> void:
	state = State.DEAD
	lives -= 1
	_play("fall")
	died.emit()


# Puts the player back on their feet for another life.
func respawn() -> void:
	hp = max_hp
	state = State.IDLE
	_invuln = Config.INVULN_AFTER_HIT * 3.0
	_buffered = ""
	_combo_step = 0
	health_changed.emit(hp, max_hp)
	_play("idle_right")


# ---- FURY ----
func add_fury(amount: float) -> void:
	if fury_active:
		return
	fury = minf(Config.FURY_MAX, fury + amount)
	fury_changed.emit(fury)


func can_transform() -> bool:
	return not fury_active and is_equal_approx(fury, Config.FURY_MAX)


func attack_damage(base: int) -> int:
	if fury_active:
		return int(round(float(base) * Config.FURY_DAMAGE_MULTIPLIER))
	return base


# The damage the current attack deals, or 0 when the player is not in an
# attacking state or the swing has already landed.
func pending_attack_damage() -> int:
	if _attack_spent:
		return 0
	match state:
		State.PUNCH:
			return attack_damage(Config.PUNCH_DAMAGE)
		State.KICK:
			return attack_damage(Config.KICK_DAMAGE)
		State.HEAVY:
			return attack_damage(Config.HEAVY_DAMAGE)
		_:
			return 0


func mark_attack_spent() -> void:
	_attack_spent = true
