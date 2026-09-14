# The six story levels, as data.
#
# One row per level. Everything that differs between them lives here --
# backdrop, how long the street is, how many enemies it spends, who is
# rescued at the end -- so adding a level is an entry rather than another
# copy of the level scene.
#
# The web version learned this the hard way: its level 1 was written as a
# one-off with its roster and its boss as constants, and turning it into six
# meant extracting all of it again. Starting from the table costs nothing
# now and saves that.
class_name Campaign
extends RefCounted

# Levels 2-6 still borrow level 1's street. That is deliberate and visible:
# a level whose art is not drawn yet says so, plays correctly, and becomes
# itself the moment the art exists.
const PLACEHOLDER_BACKGROUND := "res://assets/backgrounds/lv1/lv1-background.png"

const LEVELS := [
	{
		"id": "lv1",
		"title_key": "level1_title",
		"background": "res://assets/backgrounds/lv1/lv1-background.png",
		# How many times the strip is laid end to end to make the street.
		"loops": 6,
		# How many enemies the level spends, give or take the jitter.
		"roster": 24,
		# How many arrive in one encounter.
		"pack_min": 3,
		"pack_max": 5,
		# Share of each pack that is the tougher minion.
		"tough_share": 0.3,
		"minions": ["minion", "bananana"],
		"boss": "boss1",
		"rescue": "carla",
	},
	{
		"id": "lv2", "title_key": "level2_title",
		"background": PLACEHOLDER_BACKGROUND, "placeholder_art": true,
		"loops": 6, "roster": 28, "pack_min": 3, "pack_max": 5,
		"tough_share": 0.4, "minions": ["minion", "bananana"],
		"boss": "boss1", "rescue": "gastone",
	},
	{
		"id": "lv3", "title_key": "level3_title",
		"background": PLACEHOLDER_BACKGROUND, "placeholder_art": true,
		"loops": 7, "roster": 32, "pack_min": 4, "pack_max": 5,
		"tough_share": 0.5, "minions": ["minion", "bananana"],
		"boss": "boss1", "rescue": "mattia",
	},
	{
		"id": "lv4", "title_key": "level4_title",
		"background": PLACEHOLDER_BACKGROUND, "placeholder_art": true,
		"loops": 7, "roster": 36, "pack_min": 4, "pack_max": 5,
		"tough_share": 0.6, "minions": ["minion", "bananana"],
		"boss": "boss1", "rescue": "michele",
	},
	{
		"id": "lv5", "title_key": "level5_title",
		"background": PLACEHOLDER_BACKGROUND, "placeholder_art": true,
		"loops": 7, "roster": 40, "pack_min": 4, "pack_max": 5,
		"tough_share": 0.7, "minions": ["minion", "bananana"],
		"boss": "boss1", "rescue": "",
	},
	{
		"id": "lv6", "title_key": "level6_title",
		"background": PLACEHOLDER_BACKGROUND, "placeholder_art": true,
		"loops": 8, "roster": 44, "pack_min": 4, "pack_max": 5,
		"tough_share": 0.8, "minions": ["minion", "bananana"],
		"boss": "boss1", "rescue": "family",
	},
]


static func count() -> int:
	return LEVELS.size()


# Clamps to a real level whatever it is handed, so a corrupted save or a
# hand-edited index can never fall off the end of the table.
static func get_level(index: int) -> Dictionary:
	return LEVELS[clampi(index, 0, LEVELS.size() - 1)]


static func is_final(index: int) -> bool:
	return index >= LEVELS.size() - 1
