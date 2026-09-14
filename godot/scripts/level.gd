# A story level: a street you fight down.
#
# This is the scene that ties the pieces together -- the background, the
# player, the enemies, the encounter director and the camera. It owns almost
# no logic of its own on purpose: the pacing is the director's, the fighting
# is Combat's, and what an enemy does is the enemy's. What is left here is
# arrangement, which is the part that has to be a scene.
#
# The world is the background strip laid down `loops` times. Entities live
# in world coordinates and the camera moves over them, so nothing needs to
# know it is being scrolled.
class_name Level
extends Node2D

signal level_cleared(seconds: float)
signal player_died

# The walkable band inside the background art, as fractions of its height.
# Measured off lv1-background.png: the pavement runs from its kerb edge to
# its front lip, and only that band is standable -- the road above it is
# backdrop, not playfield.
const WALK_TOP := 0.731
const WALK_BOTTOM := 0.907
# Keep actors clear of both edges of that band, so nobody stands half in a
# wall or clipped through the front.
const EDGE_INSET := 0.18

var level_index := 0
var level_def: Dictionary = {}
var world_width := 0.0
var bounds := Rect2()
var elapsed := 0.0
var cleared := false

var _library := SpriteLibrary.new()
var _director := EncounterDirector.new()
var _player: Player
var _enemies: Array[Enemy] = []
var _boss: Enemy
var _camera: Camera2D
var _background_layer: Node2D
var _texture: Texture2D
var _strip_width := 0.0


func _ready() -> void:
	level_index = GameState.level
	level_def = Campaign.get_level(level_index)
	_build_background()
	_build_player()
	_director.setup(level_def, world_width, Config.VIEW_WIDTH)
	_build_camera()
	if OS.get_environment("SG_CAPTURE") != "":
		_capture()


# Lays the strip down `loops` times and works out the world from the art's
# own proportions, so changing the background changes the level.
func _build_background() -> void:
	_background_layer = Node2D.new()
	add_child(_background_layer)
	var path: String = level_def.get("background", "")
	if not ResourceLoader.exists(path):
		push_warning("level %s has no background at %s" % [level_def.get("id"), path])
		world_width = Config.VIEW_WIDTH * 6
		bounds = Rect2(40, 360, world_width - 80, 100)
		return
	_texture = load(path)

	# Scale the strip to fill the viewport height; the world is then however
	# wide that makes it, times the loop count.
	var scale_factor := float(Config.VIEW_HEIGHT) / float(_texture.get_height())
	_strip_width = _texture.get_width() * scale_factor
	var loops: int = level_def.get("loops", 6)
	world_width = _strip_width * loops

	for i in loops:
		var sprite := Sprite2D.new()
		sprite.texture = _texture
		sprite.centered = false
		sprite.scale = Vector2(scale_factor, scale_factor)
		sprite.position = Vector2(i * _strip_width, 0)
		sprite.z_index = -100
		_background_layer.add_child(sprite)

	var top := WALK_TOP * Config.VIEW_HEIGHT
	var bottom := WALK_BOTTOM * Config.VIEW_HEIGHT
	var inset := (bottom - top) * EDGE_INSET
	bounds = Rect2(40, top + inset, world_width - 80, (bottom - top) - inset * 2.0)


func _build_player() -> void:
	_player = Player.new()
	_player.setup(_library, "gere")
	_player.bounds = bounds
	_player.position = Vector2(140, bounds.get_center().y)
	# The run carries these; a fresh run starts at the difficulty's defaults.
	_player.lives = GameState.lives
	_player.max_hp = GameState.max_hp
	_player.hp = GameState.max_hp
	add_child(_player)


# Follows the player but never scrolls past either end of the world, and
# freezes at the lock while a fight is on -- the arena a fight happens in
# should stay put rather than sliding as the player moves within it.
func _build_camera() -> void:
	_camera = Camera2D.new()
	_camera.position = Vector2(Config.VIEW_WIDTH / 2.0, Config.VIEW_HEIGHT / 2.0)
	add_child(_camera)
	_camera.make_current()


# Walks the player and captures frames, so a headless run can show whether
# the street actually works. Scaffolding; removed once there is a HUD and a
# person can just play it.
func _capture() -> void:
	var base: String = OS.get_environment("SG_CAPTURE")
	var shot := 0
	for step in 12:
		# Walk right for a while, punching.
		for i in 90:
			_player.position.x += Config.RUN_SPEED * (1.0 / 60.0)
			await get_tree().physics_frame
		if _enemies.size() > 0:
			_player.handle_action("punch")
			for i in 30:
				await get_tree().physics_frame
			await get_tree().process_frame
			get_viewport().get_texture().get_image().save_png(
				"%s-%02d.png" % [base, shot])
			print("  shot %d: x=%.0f enemies=%d locked=%s" % [
				shot, _player.position.x, _enemies.size(),
				str(_director.lock_x > 0.0)])
			shot += 1
			if shot >= 3:
				break
	print("  spawned=%d of roster=%d, encounters=%d" % [
		_director.spawned, _director.roster, _director.encounters])
	get_tree().quit()


func _unhandled_input(event: InputEvent) -> void:
	if _player == null or cleared:
		return
	for action in ["punch", "roll", "heavy", "jump"]:
		if event.is_action_pressed(action):
			_player.handle_action(action)


func _physics_process(delta: float) -> void:
	if _player == null or cleared:
		return
	elapsed += delta

	var alive := _living_enemies()
	_apply_lock(alive)

	for enemy in _enemies:
		enemy.tick(delta, _player.position)

	Combat.resolve_player_attack(_player, _enemies)
	Combat.resolve_enemy_attacks(_enemies, _player)

	_retire_dead()
	_run_director()
	_update_camera()
	_sort_by_depth()
	_check_clear()


func _living_enemies() -> bool:
	for enemy in _enemies:
		if enemy.is_alive() and not enemy.is_boss():
			return true
	return false


# While a fight is on, the player is walled in at the lock. Tightening the
# bounds is enough -- Player clamps against them already -- so nothing in
# the player needs to know a lock exists.
func _apply_lock(alive: bool) -> void:
	if _director.is_locked(alive):
		var right := _director.lock_x
		_player.bounds = Rect2(
			bounds.position, Vector2(right - bounds.position.x, bounds.size.y)
		)
	else:
		_player.bounds = bounds


func _retire_dead() -> void:
	var still_standing := false
	for enemy in _enemies.duplicate():
		if enemy.gone:
			_enemies.erase(enemy)
			enemy.queue_free()
		elif enemy.is_alive() and not enemy.is_boss():
			still_standing = true
	# The moment the last of a pack goes down, the street opens and the next
	# mark is set from where the player actually is.
	if _director.lock_x > 0.0 and not still_standing:
		_director.unlock_street(_player.position.x)


func _run_director() -> void:
	if _director.should_trigger(_player.position.x, _living_enemies()):
		_spawn_pack()
	if _director.should_spawn_boss(_player.position.x):
		_spawn_boss()


func _spawn_pack() -> void:
	var pack := _director.build_pack(_player.facing)
	for member in pack:
		var enemy := Enemy.new()
		enemy.setup(_library, member["type"])
		enemy.bounds = bounds
		# Kept on screen: a slot can fall outside it near an end of the
		# street, and an enemy arriving off-camera is not seen arriving.
		var x: float = clampf(
			_player.position.x + member["offset_x"],
			_camera.position.x - Config.VIEW_WIDTH / 2.0 + 40.0,
			_camera.position.x + Config.VIEW_WIDTH / 2.0 - 40.0
		)
		enemy.position = Vector2(
			clampf(x, bounds.position.x, bounds.end.x),
			bounds.position.y + bounds.size.y * member["depth"]
		)
		add_child(enemy)
		_enemies.append(enemy)
	_director.lock_street(_camera.position.x - Config.VIEW_WIDTH / 2.0)


func _spawn_boss() -> void:
	_director.boss_spawned = true
	_boss = Enemy.new()
	_boss.setup(_library, level_def.get("boss", "boss1"))
	_boss.bounds = bounds
	_boss.position = Vector2(_director.boss_x(), bounds.get_center().y)
	add_child(_boss)
	_enemies.append(_boss)


func _update_camera() -> void:
	var half := Config.VIEW_WIDTH / 2.0
	var target := _player.position.x
	var limit := maxf(half, world_width - half)
	# Freeze on the locked screen so the fight's arena stays put.
	if _director.lock_x > 0.0:
		limit = minf(limit, _director.lock_x + 40.0 - half)
	_camera.position.x = clampf(target, half, limit)


# Whoever stands further down the lane draws in front.
func _sort_by_depth() -> void:
	var actors: Array[Node2D] = [_player]
	for enemy in _enemies:
		actors.append(enemy)
	actors.sort_custom(func(a, b): return a.position.y < b.position.y)
	for i in actors.size():
		actors[i].z_index = i


func _check_clear() -> void:
	if _player.state == Player.State.DEAD and _player.lives <= 0:
		cleared = true
		player_died.emit()
		return
	# The level ends when the boss is down -- not when the roster is spent,
	# so a player who runs past a fight still has to beat him.
	if _boss != null and not _boss.is_alive() and _boss.gone:
		cleared = true
		level_cleared.emit(elapsed)
