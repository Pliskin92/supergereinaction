# Who hits whom.
#
# Kept out of both the player and the enemy on purpose. Neither should reach
# into the other: the player knows what damage its current swing carries,
# an enemy knows the same, and this decides whether either connects. That
# separation is what let the player and the enemy be tested without each
# other.
#
# The one rule worth stating: A SWING HITS ONE TARGET. A punch that overlaps
# a crowd connects with whoever is nearest, not with all of them. The web
# version got this right and it matters -- a sweep would make a crowd
# trivial, and a beat-em-up is about position, not area damage.
class_name Combat
extends RefCounted

# How far in front of a character its swing reaches, and how far to either
# side in depth it counts as lined up. Depth tolerance is generous: missing
# because you were three pixels off in a lane you cannot precisely see is
# not a skill test.
const PLAYER_REACH := 62.0
const DEPTH_TOLERANCE := 34.0


# Resolves the player's current swing, if any. Returns the enemy hit, or
# null. The caller banks the score and the FURY -- this only decides the
# hit, so the same function serves a scoring level and a training arena.
static func resolve_player_attack(player: Player, enemies: Array) -> Enemy:
	var damage := player.pending_attack_damage()
	if damage <= 0:
		return null

	var target := _nearest_in_front(player.position, player.facing, enemies)
	if target == null:
		return null

	player.mark_attack_spent()
	target.take_damage(damage, player.position.x)
	return target


# Resolves every enemy that is mid-swing against the player. Returns the
# total damage dealt, which is zero on most frames.
static func resolve_enemy_attacks(enemies: Array, player: Player) -> int:
	var total := 0
	for enemy in enemies:
		if not (enemy is Enemy) or not enemy.is_alive():
			continue
		var damage: int = enemy.pending_damage()
		if damage <= 0:
			continue
		if not _in_range(enemy.position, enemy.facing, player.position,
				enemy.def.get("reach", 50.0)):
			continue
		# Spent whether or not the player was hurt: a swing that reached the
		# player is used up even if they rolled through it, or the same blow
		# would keep trying every frame until it connected.
		enemy.mark_swing_spent()
		var before := player.hp
		player.take_damage(damage, enemy.position.x)
		total += before - player.hp
	return total


# The nearest living enemy inside the swing's arc. In front, within reach,
# and roughly in the same lane.
static func _nearest_in_front(from: Vector2, facing: int, enemies: Array) -> Enemy:
	var best: Enemy = null
	var best_distance := INF
	for enemy in enemies:
		if not (enemy is Enemy) or not enemy.is_alive():
			continue
		if not _in_range(from, facing, enemy.position, PLAYER_REACH):
			continue
		var distance: float = absf(enemy.position.x - from.x)
		if distance < best_distance:
			best_distance = distance
			best = enemy
	return best


# Whether `target` is in front of someone at `from` facing `facing`, within
# `reach`, and close enough in depth to count as the same lane.
static func _in_range(from: Vector2, facing: int, target: Vector2, reach: float) -> bool:
	var dx := target.x - from.x
	# Behind the swing: a punch does not connect with someone at your back.
	# A small tolerance either way, so a target standing almost exactly on
	# top of you is still hit rather than falling into a dead zone.
	if facing > 0 and dx < -8.0:
		return false
	if facing < 0 and dx > 8.0:
		return false
	if absf(dx) > reach:
		return false
	return absf(target.y - from.y) <= DEPTH_TOLERANCE
