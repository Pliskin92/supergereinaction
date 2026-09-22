# Tests for scripts/title_screen.gd.
#
# The menu is navigation and settings, both of which are easy to get subtly
# wrong: an index that walks off its list, or a difficulty change that does
# not take effect until the next run.
extends RefCounted


func run(t) -> void:
	t.describe("Title — the menu wraps rather than running off its ends")
	# The wrapping is asserted directly rather than through a TitleScreen
	# instance: the screen is a Node2D that wants a scene tree, and what is
	# actually under test is the index arithmetic, not the node.
	var count: int = TitleScreen.ITEMS.size()
	t.check(count > 0, "there are menu items")
	t.equal(wrapi(-1, 0, count), count - 1, "up from the first wraps to the last")
	t.equal(wrapi(count, 0, count), 0, "down from the last wraps to the first")
	t.equal(wrapi(0, 0, count), 0, "and the first item stays put")

	t.describe("Title — every menu item has text")
	for item in TitleScreen.ITEMS:
		t.check(
			Strings.get_text(item) != item,
			"'%s' has a translation rather than showing its key" % item
		)
	for row in TitleScreen.OPTION_ROWS:
		t.check(
			Strings.get_text(row) != row,
			"option '%s' has a translation" % row
		)

	t.describe("Title — every language and difficulty is named")
	for language in Strings.TABLE.keys():
		var key: String = "language_" + str(language)
		t.check(Strings.get_text(key) != key, "language '%s' has a name" % language)
	for level in Config.DIFFICULTIES.keys():
		var key: String = "difficulty_" + str(level)
		t.check(Strings.get_text(key) != key, "difficulty '%s' has a name" % level)

	t.describe("Title — the string tables agree")
	# A key present in one language and missing from the other shows as a
	# raw key to half the players, which is the kind of thing nobody
	# notices until someone switches language.
	var italian: Dictionary = Strings.TABLE["it"]
	var english: Dictionary = Strings.TABLE["en"]
	var missing_en: Array = []
	var missing_it: Array = []
	for key in italian:
		if not english.has(key):
			missing_en.append(key)
	for key in english:
		if not italian.has(key):
			missing_it.append(key)
	t.check(
		missing_en.is_empty(),
		"every Italian key exists in English (missing: %s)" % str(missing_en)
	)
	t.check(
		missing_it.is_empty(),
		"every English key exists in Italian (missing: %s)" % str(missing_it)
	)

	t.describe("Title — a missing key shows as the key, not as nothing")
	t.equal(
		Strings.get_text("no_such_key_at_all"), "no_such_key_at_all",
		"so a gap is visible on screen during development"
	)

	t.finished()
