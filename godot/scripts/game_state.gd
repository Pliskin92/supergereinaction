# The run: what carries across levels, and the settings that outlive a run.
#
# Registered as an autoload (see project.godot), so it is one object with one
# lifetime rather than state threaded through scenes. The previous version
# kept this in browser storage and rebuilt it by hand on every page load,
# which is where a whole class of bugs lived -- a field added in one place
# and silently dropped in another.
#
# Two distinct lifetimes, deliberately separate:
#
#   * SETTINGS (language, difficulty) outlive everything and are saved to
#     disk. Changing them is not part of a run.
#   * THE RUN (level, score, lives, rescues, upgrades) is one playthrough. It
#     is held in memory and deliberately NOT saved: a run is a sitting, and
#     the permanent record is the highscore table.
extends Node

signal run_changed
signal settings_changed

const SETTINGS_PATH := "user://settings.cfg"

# ---- Settings ----
var language := "it"
var difficulty := Config.DEFAULT_DIFFICULTY

# ---- The run ----
# Level is 0-based internally and only ever shown to a player as +1.
var level := 0
var score := 0
var lives := 0
var rescued: Array[String] = []
# Permanent upgrades bought or dropped during the run.
var max_hp := Config.MAX_HP
var max_lives := 0
var attack_multiplier := 1.0


func _ready() -> void:
	load_settings()
	reset_run()


# Starts a fresh run at level 1 with the lives the chosen difficulty grants.
func reset_run() -> void:
	level = 0
	score = 0
	lives = Config.lives_for(difficulty)
	max_lives = lives
	rescued = []
	max_hp = Config.MAX_HP
	attack_multiplier = 1.0
	run_changed.emit()


# Advances to the next level, banking what the finished one earned.
func complete_level(earned: int, lives_left: int, rescue: String) -> void:
	score += earned
	lives = lives_left
	if rescue != "" and not rescued.has(rescue):
		rescued.append(rescue)
	level += 1
	run_changed.emit()


# True once the run has passed the last level. The campaign table owns how
# many there are, so this takes the count rather than assuming it.
func run_complete(level_count: int) -> bool:
	return level >= level_count


# ---- Settings persistence ----
# Saved with ConfigFile rather than JSON: it is the engine's own format for
# exactly this, it survives a partially-corrupt file, and it does not need a
# schema kept in sync by hand.
func save_settings() -> void:
	var file := ConfigFile.new()
	Strings.set_language(language)
	file.set_value("game", "language", language)
	file.set_value("game", "difficulty", difficulty)
	# A failed save is not worth interrupting play for: the settings simply
	# stay session-only, exactly as they did when storage was blocked in the
	# browser.
	file.save(SETTINGS_PATH)
	settings_changed.emit()


func load_settings() -> void:
	var file := ConfigFile.new()
	if file.load(SETTINGS_PATH) != OK:
		return  # no settings yet, or unreadable; the defaults stand
	language = str(file.get_value("game", "language", language))
	var stored := str(file.get_value("game", "difficulty", difficulty))
	# Validate rather than trust: a hand-edited or older file must not put
	# the run into a difficulty that no longer exists.
	if Config.DIFFICULTIES.has(stored):
		difficulty = stored
	# The string table holds its own language so it can be used without the
	# scene tree; keep the two in step.
	Strings.set_language(language)
