# Tests for scripts/config.gd.
#
# These look almost too simple to be worth writing, and they are not. They
# are what makes the balance table something the engine can check rather
# than something a reader has to hold in their head: that the roll is
# shorter than the window it has to fit inside, that harder difficulties
# really are harder, that a corrupt setting cannot produce a run with zero
# lives.
extends RefCounted


func run(t) -> void:
	t.describe("Config — the design resolution")
	t.check(Config.VIEW_WIDTH > 0 and Config.VIEW_HEIGHT > 0, "viewport has a positive size")
	t.check(
		float(Config.VIEW_WIDTH) / float(Config.VIEW_HEIGHT) > 1.0,
		"viewport is landscape, which is the shape the game is played in"
	)

	t.describe("Config — movement")
	t.check(Config.RUN_SPEED > Config.WALK_SPEED, "running is faster than walking")
	t.check(Config.ROLL_SPEED > Config.RUN_SPEED, "a roll outruns a run, or it is not an escape")
	t.check(Config.ROLL_DURATION > 0.0, "the roll lasts a real amount of time")
	t.check(
		Config.DODGE_SPEED > Config.WALK_SPEED,
		"sidestepping is faster than walking, so dodging works without the run key"
	)

	t.describe("Config — combat")
	t.check(Config.KICK_DAMAGE > Config.PUNCH_DAMAGE, "the kick that ends the combo hits hardest")
	t.check(
		Config.PUNCH_STRIKE_AT > 0.0 and Config.PUNCH_STRIKE_AT < 1.0,
		"a punch connects partway through its clip, not at either end"
	)
	t.check(
		Config.INVULN_AFTER_HIT < Config.HIT_STUN,
		"invulnerability ends before the stun does, so a hit cannot be free"
	)

	t.describe("Config — FURY")
	t.check(Config.FURY_MAX > 0.0, "the meter has a top")
	t.check(
		Config.FURY_PER_HIT > 0.0 and Config.FURY_PER_HIT < Config.FURY_MAX,
		"a single hit fills some of the meter but not all of it"
	)
	t.check(Config.FURY_DAMAGE_MULTIPLIER > 1.0, "transforming actually hits harder")
	t.check(Config.FURY_DURATION > 0.0, "the transformation ends")

	t.describe("Config — assists")
	t.check(
		Config.ASSIST_COOLDOWN > Config.ASSIST_DURATION,
		"an assist cannot be permanently summoned"
	)

	t.describe("Config — difficulty")
	t.check(
		Config.DIFFICULTIES.has(Config.DEFAULT_DIFFICULTY),
		"the default difficulty is one that exists"
	)
	for key in Config.DIFFICULTIES:
		t.check(Config.lives_for(key) > 0, "%s starts with at least one life" % key)
	t.check(
		Config.lives_for("easy") > Config.lives_for("hell"),
		"easy grants more lives than hell"
	)
	t.check(
		Config.damage_scale_for("hell") > Config.damage_scale_for("easy"),
		"hell hurts more than easy"
	)

	t.describe("Config — bad input cannot break a run")
	t.equal(
		Config.lives_for("nonsense"),
		Config.lives_for(Config.DEFAULT_DIFFICULTY),
		"an unknown difficulty falls back to the default rather than erroring"
	)
	t.equal(
		Config.lives_for(""),
		Config.lives_for(Config.DEFAULT_DIFFICULTY),
		"an empty difficulty falls back too"
	)

	t.finished()
