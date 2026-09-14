# What each enemy is: its numbers, its art, and how it fights.
#
# Data, not classes. The web version had one Enemy class reading a table
# exactly like this, and that was the part of it that worked well: a new
# enemy is a row here, not a subclass. What changes is kept to numbers a
# designer can reason about -- how hard it hits, how far it reaches, how
# long it waits before committing -- rather than behaviour scattered across
# files.
#
# `character` is the sprite pack; SpriteLibrary resolves the clip names, so
# a pack with capitalised folders needs nothing special here.
class_name EnemyTypes
extends RefCounted

const TYPES := {
	# The standard street minion. The baseline everything else is read
	# against: quick enough to close, weak enough to be fought in groups.
	"minion": {
		"character": "minion",
		"name": "Minion",
		"hp": 25,
		"speed": 42.0,
		"damage": 3,
		# How close it must be before it will swing.
		"reach": 46.0,
		# Where it tries to stand: close enough to hit, far enough not to
		# be standing inside the player.
		"preferred_gap": 96.0,
		# Seconds between attacks.
		"cooldown": 1.3,
		# Seconds it squares up before a swing lands, so a blow can be seen
		# coming and rolled away from.
		"windup": 0.23,
		"score": 100,
	},
	# The tougher half of the street pair: more health and a harder hit,
	# traded against speed, so a mixed pack has two rhythms in it rather
	# than one enemy repeated.
	"bananana": {
		"character": "bananana",
		"name": "Bananana",
		"hp": 40,
		"speed": 33.0,
		"damage": 5,
		"reach": 50.0,
		"preferred_gap": 100.0,
		"cooldown": 1.6,
		"windup": 0.28,
		"score": 150,
	},
	# The boss. Faster, harder, and with far more health -- it is meant to
	# be fought rather than waded through.
	"boss1": {
		"character": "boss1",
		"name": "The Hooded Villain",
		"hp": 170,
		"speed": 69.0,
		"damage": 16,
		"reach": 56.0,
		"preferred_gap": 110.0,
		"cooldown": 0.9,
		"windup": 0.17,
		"score": 2000,
		"boss": true,
	},
}


static func get_type(key: String) -> Dictionary:
	return TYPES.get(key, {})


static func exists(key: String) -> bool:
	return TYPES.has(key)


static func keys() -> Array:
	return TYPES.keys()
