# Every tunable number in the game, in one readable place.
#
# The previous version scattered these across the files that used them, and
# the result was that balance could only be found by grepping and could not
# be tested at all. Here they are data: a test can assert that lives are
# positive and that the roll is shorter than its cooldown, and a change to
# feel is a change to one line in one file.
#
# Nothing here reaches into the engine, so this loads and runs headless --
# which is what makes it testable.
class_name Config
extends RefCounted

# ---- The design resolution ----
# Every coordinate in the game is written against this. The window may be
# any size; the viewport is stretched to fit (see project.godot), so no
# gameplay code ever deals in physical pixels.
const VIEW_WIDTH := 960
const VIEW_HEIGHT := 540

# ---- Player movement ----
# Pixels per second, not per frame. The old game moved per-frame, which tied
# its feel to the frame rate; anything here is multiplied by delta.
const WALK_SPEED := 66.0
const RUN_SPEED := 204.0
# Sidestepping through the lane's depth is always fast, independent of the
# run button -- a beat-em-up player has to be able to dodge reliably.
const DODGE_SPEED := 156.0
const ROLL_SPEED := 252.0
const ROLL_DURATION := 0.47

# ---- Combat ----
const PUNCH_DAMAGE := 3
const KICK_DAMAGE := 6
const HEAVY_DAMAGE := 6
# How long a landed blow stuns the receiver, in seconds.
const HIT_STUN := 0.43
# Invulnerability after taking a hit, so a crowd cannot delete the player in
# a single frame.
const INVULN_AFTER_HIT := 0.33
# A punch only counts once its clip reaches the contact frame, so the hitbox
# matches what is on screen rather than connecting during the wind-up.
const PUNCH_STRIKE_AT := 0.6
# How long after a punch another press still chains into the combo.
const COMBO_WINDOW := 0.47

# ---- The player ----
const MAX_HP := 100
const DEFAULT_LIVES := 5

# ---- FURY ----
const FURY_MAX := 100.0
const FURY_PER_HIT := 1.0
const FURY_DURATION := 20.0
const FURY_DAMAGE_MULTIPLIER := 2.0
const FURY_DEFENCE_MULTIPLIER := 2.0
const FURY_RUN_MULTIPLIER := 2.0

# ---- Assists ----
const ASSIST_DURATION := 20.0
const ASSIST_COOLDOWN := 45.0

# ---- Scoring ----
const SCORE_COMBO_WINDOW := 2.0
const SCORE_COMBO_MAX := 8
const SCORE_LIFE_BONUS := 500
const SCORE_TIME_BONUS_PER_S := 25
const SCORE_PAR_SECONDS := 240

# ---- Difficulty ----
# Lives per difficulty. The keys are what a saved setting stores, so they
# must stay stable even if the labels change.
const DIFFICULTIES := {
	"easy": {"lives": 9, "damage_taken": 0.6},
	"medium": {"lives": 5, "damage_taken": 1.0},
	"hard": {"lives": 3, "damage_taken": 1.4},
	"hell": {"lives": 1, "damage_taken": 2.0},
}
const DEFAULT_DIFFICULTY := "medium"


# Lives the run starts with, for a difficulty key. Unknown keys fall back to
# the default rather than erroring: a save from an older build, or a
# hand-edited settings file, must not break the game.
static func lives_for(difficulty: String) -> int:
	var entry: Dictionary = DIFFICULTIES.get(difficulty, DIFFICULTIES[DEFAULT_DIFFICULTY])
	return entry["lives"]


# How much damage the player takes, scaled by difficulty.
static func damage_scale_for(difficulty: String) -> float:
	var entry: Dictionary = DIFFICULTIES.get(difficulty, DIFFICULTIES[DEFAULT_DIFFICULTY])
	return entry["damage_taken"]
