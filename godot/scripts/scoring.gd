# Scoring: what a kill is worth, and what a finished level is worth.
#
# Pure functions over plain numbers, deliberately: scoring is the kind of
# thing that is easy to get subtly wrong and impossible to notice, so it is
# written where a test can assert the arithmetic rather than being scattered
# through the level.
#
# The chain is the point. Killing a pack without pausing is worth several
# times picking them off one at a time, which is what makes pressing forward
# into a crowd the interesting choice rather than retreating and plinking.
class_name Scoring
extends RefCounted


# What a kill pays, given how long the chain already is. The Nth kill in a
# chain is worth N times the enemy's base value, capped so a very long chain
# does not run away with the score.
static func kill_value(base: int, chain: int) -> int:
	var multiplier := clampi(chain, 1, Config.SCORE_COMBO_MAX)
	return base * multiplier


# The end-of-level bonuses.
#
# Time tapers to nothing at par and never goes negative: there is a reward
# for being quick and no punishment for being slow, because a player who is
# struggling should not also be losing points for it.
static func time_bonus(seconds: float) -> int:
	var spare := Config.SCORE_PAR_SECONDS - seconds
	if spare <= 0.0:
		return 0
	return int(spare) * Config.SCORE_TIME_BONUS_PER_S


# Lives are only paid at the END of a run, not per level -- paying per level
# would pay for the same surviving lives six times over, and would mean
# dying late scored better than never dying at all. The level passes
# `is_final` so the rule lives here rather than in the caller.
static func lives_bonus(lives: int, is_final: bool) -> int:
	if not is_final:
		return 0
	return maxi(0, lives) * Config.SCORE_LIFE_BONUS


# The whole summary for a finished level, as data the end screen can draw
# without recomputing anything.
static func summarise(
	earned: int, seconds: float, lives: int, is_final: bool
) -> Dictionary:
	var time := time_bonus(seconds)
	var life := lives_bonus(lives, is_final)
	return {
		"earned": earned,
		"seconds": seconds,
		"time_bonus": time,
		"lives_bonus": life,
		"total": earned + time + life,
		"is_final": is_final,
	}


# Minutes and seconds, for display. Returned rather than formatted into a
# string so a caller can lay it out however it likes.
static func clock(seconds: float) -> Array:
	var whole := maxi(0, int(seconds))
	return [whole / 60, whole % 60]
