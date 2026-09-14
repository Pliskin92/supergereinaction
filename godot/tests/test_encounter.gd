# Tests for scripts/campaign.gd and scripts/encounter_director.gd.
#
# The important one is at the bottom: a SIMULATED WALK down a whole level,
# asserting the fights come at a sensible rhythm and the roster is actually
# spent. Unit tests all passed while the enemy AI was deadlocked; only
# simulating the whole thing caught it. Pacing has the same shape of failure
# -- every piece correct, the combination unplayable -- so it gets the same
# treatment.
extends RefCounted


func _director(level_index := 0, seed_value := 12345) -> EncounterDirector:
	var d := EncounterDirector.new()
	var level := Campaign.get_level(level_index)
	# A level's world is its strip laid down `loops` times. 1855 is the
	# width of lv1-background.png.
	var world: float = 1855.0 * float(level.get("loops", 6))
	d.setup(level, world, 960.0, seed_value)
	return d


func run(t) -> void:
	t.describe("Campaign — the table is coherent")
	t.equal(Campaign.count(), 6, "there are six levels")
	for i in Campaign.count():
		var level := Campaign.get_level(i)
		t.check(level.has("id"), "level %d has an id" % (i + 1))
		t.check(level.get("roster", 0) > 0, "level %d spends enemies" % (i + 1))
		t.check(
			level.get("pack_max", 0) >= level.get("pack_min", 0),
			"level %d's pack range is the right way round" % (i + 1)
		)
		t.check(
			EnemyTypes.exists(level.get("boss", "")),
			"level %d's boss is a real enemy type" % (i + 1)
		)
		for minion in level.get("minions", []):
			t.check(
				EnemyTypes.exists(minion),
				"level %d's %s is a real enemy type" % [i + 1, minion]
			)

	t.describe("Campaign — difficulty rises across the run")
	t.check(
		Campaign.get_level(5)["roster"] > Campaign.get_level(0)["roster"],
		"the last level spends more enemies than the first"
	)
	t.check(
		Campaign.get_level(5)["tough_share"] > Campaign.get_level(0)["tough_share"],
		"and a larger share of them are the tougher type"
	)

	t.describe("Campaign — a bad index cannot fall off the table")
	t.equal(Campaign.get_level(-5)["id"], "lv1", "a negative index clamps to the first")
	t.equal(Campaign.get_level(99)["id"], "lv6", "a huge index clamps to the last")
	t.check(Campaign.is_final(5), "level 6 is the last")
	t.check(not Campaign.is_final(0), "level 1 is not")

	t.describe("EncounterDirector — setup")
	var d := _director()
	t.check(d.roster > 0, "a roster is rolled")
	t.equal(d.spawned, 0, "nothing has spawned yet")
	t.check(d.next_at > 0.0, "the first pack is placed along the street")
	t.check(
		d.next_at < d.world_width * 0.2,
		"and it is near the start, not halfway down"
	)

	t.describe("EncounterDirector — the street locks and unlocks")
	d = _director()
	t.check(not d.is_locked(true), "the street starts open")
	d.lock_street(0.0)
	t.check(d.is_locked(true), "it locks while enemies are standing")
	t.check(not d.is_locked(false), "and opens the moment the last one is down")

	t.describe("EncounterDirector — a pack arrives split around the player")
	d = _director()
	var pack := d.build_pack(1)
	t.check(pack.size() >= 3, "a pack is several enemies (%d)" % pack.size())
	var ahead := 0
	var behind := 0
	for member in pack:
		if member["offset_x"] > 0.0:
			ahead += 1
		else:
			behind += 1
	t.check(ahead > 0 and behind > 0, "some come from in front and some from behind")

	t.describe("EncounterDirector — a pack is spread, not stacked")
	var offsets := {}
	for member in pack:
		offsets[member["offset_x"]] = true
	t.equal(offsets.size(), pack.size(), "no two arrive on the same spot")
	var depths := {}
	for member in pack:
		depths[snappedf(member["depth"], 0.01)] = true
	t.check(depths.size() > 1, "and they are spread through the lane's depth")

	t.describe("EncounterDirector — a big pack contains both enemy types")
	d = _director()
	var mixed := false
	for i in 8:
		var p := d.build_pack(1)
		var kinds := {}
		for member in p:
			kinds[member["type"]] = true
		if kinds.size() > 1:
			mixed = true
			break
	t.check(mixed, "packs are not all one type")

	t.describe("EncounterDirector — nothing fires while the street is locked")
	d = _director()
	d.lock_street(0.0)
	t.check(
		not d.should_trigger(d.world_width, true),
		"walking during a fight does not summon another pack"
	)

	t.describe("EncounterDirector — the gap is measured from where you END a fight")
	# The web version measured from where a fight was TRIGGERED, which made
	# the real walk anything from a few seconds to twenty depending on where
	# in the locked screen the player happened to finish.
	d = _director()
	d.lock_street(0.0)
	d.unlock_street(5000.0)
	t.check(d.next_at > 5000.0, "the next mark is ahead of where the player stands")
	t.check(
		d.next_at - 5000.0 < d.spacing() * 1.5,
		"and within one spacing of it, not a trek"
	)

	t.describe("EncounterDirector — the roster is a budget, not a ceiling")
	d = _director()
	var total := 0
	for i in 40:
		if d.spawned >= d.roster:
			break
		total += d.build_pack(1).size()
	t.equal(total, d.roster, "packs spend exactly the roster, never more")
	t.check(
		not d.should_trigger(d.world_width, false),
		"and once spent, no more fights are called"
	)

	t.describe("EncounterDirector — a full walk down the level")
	# The real check. Walk a virtual player from one end to the other,
	# fighting each pack as it arrives, and assert the level is playable:
	# the fights happen, they are spread out, the roster is spent, and the
	# boss is reached.
	d = _director()
	var player_x := 0.0
	var alive := false
	var fight_positions: Array[float] = []
	var guard := 0
	while player_x < d.boss_x() and guard < 200000:
		guard += 1
		# Walk, unless a fight is holding the street.
		if not d.is_locked(alive):
			player_x += 4.0
		if d.should_trigger(player_x, alive):
			d.build_pack(1)
			d.lock_street(player_x - 480.0)
			alive = true
			fight_positions.append(player_x)
			continue
		# Fighting: a pack takes a while to clear.
		if alive and guard % 120 == 0:
			alive = false
			d.unlock_street(player_x)
		if d.should_spawn_boss(player_x):
			d.boss_spawned = true

	t.check(guard < 200000, "the walk completes rather than deadlocking")
	t.check(fight_positions.size() >= 4, "several fights happen (%d)" % fight_positions.size())
	t.equal(d.spawned, d.roster, "the whole roster is spent across the level")
	t.check(d.boss_spawned, "and the boss is reached")

	t.describe("EncounterDirector — the fights are spread along the street")
	var min_gap := INF
	for i in range(1, fight_positions.size()):
		min_gap = minf(min_gap, fight_positions[i] - fight_positions[i - 1])
	t.check(
		min_gap > 100.0,
		"no two fights are on top of each other (closest %.0f apart)" % min_gap
	)
	t.check(
		fight_positions[fight_positions.size() - 1] < d.boss_x(),
		"and the last one is before the boss, not on his doorstep"
	)

	t.finished()
