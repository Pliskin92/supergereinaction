# The entry scene — a fight, for now.
#
# Scaffolding while the game is built: the player against a few minions on a
# floor line, so movement, combat and the AI can be seen working together.
# It becomes the level once the camera and encounters are in.
extends Node2D

const FLOOR_Y := 400
const LANE_DEPTH := 90

var _library := SpriteLibrary.new()
var _player: Player
var _enemies: Array[Enemy] = []


func _ready() -> void:
	print("Super Gere — Godot %s" % Engine.get_version_info()["string"])
	var bounds := Rect2(40, FLOOR_Y - LANE_DEPTH, Config.VIEW_WIDTH - 80, LANE_DEPTH)

	_player = Player.new()
	_player.setup(_library, "gere")
	_player.position = Vector2(180, FLOOR_Y)
	_player.bounds = bounds
	add_child(_player)

	for entry in [["minion", 520.0, 0.0], ["bananana", 680.0, -40.0],
			["minion", 820.0, 30.0]]:
		var enemy := Enemy.new()
		enemy.setup(_library, entry[0])
		enemy.position = Vector2(entry[1], FLOOR_Y + entry[2])
		enemy.bounds = bounds
		add_child(enemy)
		_enemies.append(enemy)

	print("  %d enemies against the player" % _enemies.size())
	if OS.get_environment("SG_CAPTURE") != "":
		_capture()


func _unhandled_input(event: InputEvent) -> void:
	if _player == null:
		return
	for action in ["punch", "roll", "heavy", "jump"]:
		if event.is_action_pressed(action):
			_player.handle_action(action)


func _physics_process(delta: float) -> void:
	if _player == null:
		return
	for enemy in _enemies:
		enemy.tick(delta, _player.position)
	Combat.resolve_player_attack(_player, _enemies)
	Combat.resolve_enemy_attacks(_enemies, _player)
	# Retire bodies once their fall has played.
	for enemy in _enemies.duplicate():
		if enemy.gone:
			_enemies.erase(enemy)
			enemy.queue_free()
	# Depth sort: whoever stands further down the lane draws in front.
	_sort_by_depth()


func _sort_by_depth() -> void:
	var actors: Array[Node2D] = [_player]
	for enemy in _enemies:
		actors.append(enemy)
	actors.sort_custom(func(a, b): return a.position.y < b.position.y)
	for i in actors.size():
		actors[i].z_index = i


# Plays a scripted fight and saves frames, so the whole thing can be checked
# by eye from a headless run.
func _capture() -> void:
	var base: String = OS.get_environment("SG_CAPTURE")
	# Let the enemies close in.
	for i in 180:
		await get_tree().physics_frame
	await _shot("%s-approach.png" % base)
	_player.handle_action("punch")
	for i in 10:
		await get_tree().physics_frame
	await _shot("%s-fight.png" % base)
	# Beat one down.
	for enemy in _enemies:
		enemy.take_damage(999, _player.position.x)
		break
	for i in 20:
		await get_tree().physics_frame
	await _shot("%s-down.png" % base)
	get_tree().quit()


func _shot(path: String) -> void:
	await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(path)
	print("  captured %s" % path.get_file())
