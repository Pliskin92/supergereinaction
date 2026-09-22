# Tests for scripts/scoring.gd.
#
# Scoring is arithmetic nobody watches: a wrong multiplier or a bonus paid
# at the wrong moment is invisible in play and only shows up as a highscore
# table that makes no sense. So the rules are asserted rather than trusted.
extends RefCounted


func run(t) -> void:
	t.describe("Scoring — a kill is worth more in a chain")
	t.equal(Scoring.kill_value(100, 1), 100, "the first kill pays its base value")
	t.equal(Scoring.kill_value(100, 2), 200, "the second in a chain pays double")
	t.equal(Scoring.kill_value(100, 3), 300, "and the third, triple")

	t.describe("Scoring — the chain is capped")
	var capped := Scoring.kill_value(100, Config.SCORE_COMBO_MAX + 5)
	t.equal(
		capped, 100 * Config.SCORE_COMBO_MAX,
		"a very long chain stops multiplying, so the score cannot run away"
	)

	t.describe("Scoring — a chain of zero or less still pays")
	t.equal(Scoring.kill_value(100, 0), 100, "a zero chain pays the base, not nothing")
	t.equal(Scoring.kill_value(100, -3), 100, "and a negative one cannot zero a kill")

	t.describe("Scoring — the time bonus rewards speed but never punishes")
	var quick := Scoring.time_bonus(10.0)
	var slow := Scoring.time_bonus(Config.SCORE_PAR_SECONDS - 10.0)
	t.check(quick > slow, "finishing sooner is worth more")
	t.equal(Scoring.time_bonus(Config.SCORE_PAR_SECONDS), 0, "at par it is nothing")
	t.equal(
		Scoring.time_bonus(Config.SCORE_PAR_SECONDS + 500.0), 0,
		"and past par it is still nothing, never negative"
	)

	t.describe("Scoring — lives are paid once, at the end of the run")
	# Paying per level would pay for the same surviving lives six times over,
	# and would mean dying late scored better than never dying at all.
	t.equal(
		Scoring.lives_bonus(5, false), 0,
		"a mid-campaign level pays no lives bonus"
	)
	t.check(
		Scoring.lives_bonus(5, true) > 0,
		"the final level does"
	)
	t.check(
		Scoring.lives_bonus(5, true) > Scoring.lives_bonus(2, true),
		"and more lives are worth more"
	)
	t.equal(Scoring.lives_bonus(-2, true), 0, "a negative life count pays nothing")

	t.describe("Scoring — the level summary")
	var mid := Scoring.summarise(8000, 100.0, 4, false)
	t.equal(mid["earned"], 8000, "it reports what was earned in the level")
	t.check(mid["time_bonus"] > 0, "a quick level earns a time bonus")
	t.equal(mid["lives_bonus"], 0, "but no lives bonus mid-campaign")
	t.equal(
		mid["total"], mid["earned"] + mid["time_bonus"],
		"and the total is exactly its parts"
	)

	var last := Scoring.summarise(8000, 100.0, 4, true)
	t.check(last["lives_bonus"] > 0, "the final level pays for surviving lives")
	t.equal(
		last["total"], last["earned"] + last["time_bonus"] + last["lives_bonus"],
		"and its total is its parts too"
	)
	t.check(last["total"] > mid["total"], "so the same run scores more when it ends")

	t.describe("Scoring — a slow run still scores what it earned")
	var slow_run := Scoring.summarise(5000, Config.SCORE_PAR_SECONDS * 3.0, 1, true)
	t.equal(slow_run["time_bonus"], 0, "no time bonus")
	t.check(
		slow_run["total"] >= 5000,
		"but the points earned by fighting are never taken away"
	)

	t.describe("Scoring — the clock")
	t.equal(Scoring.clock(0.0), [0, 0], "zero reads as 0:00")
	t.equal(Scoring.clock(65.0), [1, 5], "65 seconds is 1:05")
	t.equal(Scoring.clock(600.0), [10, 0], "600 is 10:00")
	t.equal(Scoring.clock(-5.0), [0, 0], "a negative time cannot show a negative clock")

	t.finished()
