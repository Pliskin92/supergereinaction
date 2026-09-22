# UI text, in one table.
#
# The game's own voice is Italian -- the characters are Italian and the
# shouts are performance rather than interface -- so the strings are
# Italian, with English kept alongside for anything a non-speaker has to
# read to operate the game.
#
# Looked up by key so a missing translation is visible as a key on screen
# rather than as blank space.
class_name Strings
extends RefCounted

const TABLE := {
	"it": {
		"new_game": "NUOVA PARTITA",
		"options": "OPZIONI",
		"language": "Lingua",
		"difficulty": "Difficolta",
		"language_it": "Italiano",
		"language_en": "English",
		"difficulty_easy": "FACILE",
		"difficulty_medium": "NORMALE",
		"difficulty_hard": "DIFFICILE",
		"difficulty_hell": "INFERNO",
		"menu_hint": "FRECCE + INVIO",
		"options_hint": "FRECCE CAMBIA \u00b7 INVIO INDIETRO",
		"level1_title": "LIVELLO 1 — LA STRADA",
		"level2_title": "LIVELLO 2 — IL GARAGE DI GASTONE",
		"level3_title": "LIVELLO 3 — IL LABORATORIO DI MATTIA",
		"level4_title": "LIVELLO 4 — IL CORTILE DI MICHELE",
		"level5_title": "LIVELLO 5 — BOSS LUIGI",
		"level6_title": "LIVELLO 6 — IL SALVATAGGIO FINALE",
		"score": "PUNTI",
		"fury": "FURIA",
		"level_clear": "LIVELLO COMPLETATO!",
		"campaign_clear": "SALVATAGGIO COMPLETO!",
		"game_over": "GAME OVER",
		"time_bonus": "BONUS TEMPO",
		"lives_bonus": "BONUS VITE",
		"lives_left": "VITE RIMASTE",
		"total": "TOTALE",
		"rescued": "SALVATO",
		"next_level": "PROSSIMO",
		"continue_hint": "INVIO PER CONTINUARE",
		"retry_hint": "INVIO PER RIPROVARE",
		"rescue_carla": "NONNA CARLA",
		"rescue_gastone": "NONNO GASTONE",
		"rescue_mattia": "ZIO MATTIA",
		"rescue_michele": "ZIO MICHELE",
		"rescue_family": "TUTTA LA FAMIGLIA",
	},
	"en": {
		"new_game": "NEW GAME",
		"options": "OPTIONS",
		"language": "Language",
		"difficulty": "Difficulty",
		"language_it": "Italiano",
		"language_en": "English",
		"difficulty_easy": "EASY",
		"difficulty_medium": "MEDIUM",
		"difficulty_hard": "HARD",
		"difficulty_hell": "HELL",
		"menu_hint": "ARROWS + ENTER",
		"options_hint": "ARROWS CHANGE \u00b7 ENTER BACK",
		"level1_title": "LEVEL 1 — THE STREET",
		"level2_title": "LEVEL 2 — GASTONE'S GARAGE",
		"level3_title": "LEVEL 3 — MATTIA'S WORKSHOP",
		"level4_title": "LEVEL 4 — MICHELE'S YARD",
		"level5_title": "LEVEL 5 — BOSS LUIGI",
		"level6_title": "LEVEL 6 — THE FINAL RESCUE",
		"score": "SCORE",
		"fury": "FURY",
		"level_clear": "LEVEL CLEAR!",
		"campaign_clear": "RESCUE COMPLETE!",
		"game_over": "GAME OVER",
		"time_bonus": "TIME BONUS",
		"lives_bonus": "LIVES BONUS",
		"lives_left": "LIVES LEFT",
		"total": "TOTAL",
		"rescued": "RESCUED",
		"next_level": "NEXT",
		"continue_hint": "ENTER TO CONTINUE",
		"retry_hint": "ENTER TO RETRY",
		"rescue_carla": "GRANDMA CARLA",
		"rescue_gastone": "GRANDPA GASTONE",
		"rescue_mattia": "UNCLE MATTIA",
		"rescue_michele": "UNCLE MICHELE",
		"rescue_family": "THE WHOLE FAMILY",
	},
}

const DEFAULT_LANGUAGE := "it"


# The text for a key in the current language.
#
# Falls back to the default language, then to the key itself. Showing the
# key is deliberate: a missing string is then obvious on screen during
# development rather than silently blank.
# The language to look up in. Held here rather than read from the GameState
# autoload, because an autoload does not exist in a --script run and a
# string table that cannot be used without a full scene tree is a string
# table that cannot be tested. GameState sets it when it loads settings.
static var language := DEFAULT_LANGUAGE


static func set_language(value: String) -> void:
	if TABLE.has(value):
		language = value


static func get_text(key: String) -> String:
	var language: String = Strings.language
	if not TABLE.has(language):
		language = DEFAULT_LANGUAGE
	var table: Dictionary = TABLE[language]
	if table.has(key):
		return table[key]
	var fallback: Dictionary = TABLE[DEFAULT_LANGUAGE]
	return fallback.get(key, key)
