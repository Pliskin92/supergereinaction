#include "levels.h"

static const LevelDefinition g_level_definitions[LEVEL_COUNT] = {
	{ "Grandma Carla", 3, 1, ASSIST_NONE },
	{ "Grandpa Gastone", 4, 1, ASSIST_NONE },
	{ "Uncle Mattia", 4, 1, ASSIST_UNCLE_MATTIA },
	{ "Uncle Michele", 5, 1, ASSIST_UNCLE_MICHELE },
	{ "Boss Luigi", 2, 1, ASSIST_NONE },
	{ "Mario/Wario/Bowser", 3, 0, ASSIST_NONE }
};

const LevelDefinition *Levels_GetDefinition(LevelId level) {
	return &g_level_definitions[level];
}

void Levels_Start(LevelState *state, LevelId level) {
	const LevelDefinition *definition = Levels_GetDefinition(level);

	state->current_level = level;
	state->stage_timer = 0;
	state->encounter_timer = 0;
	state->encounters_remaining = definition->encounter_count;
	state->stage_complete = 0;
	state->shop_pending = 0;
}

void Levels_Init(LevelState *state) {
	state->unlocked_assists = ASSIST_NONE;
	Levels_Start(state, LEVEL_GRANDMA_CARLA);
}

void Levels_Update(LevelState *state) {
	const LevelDefinition *definition = Levels_GetDefinition(state->current_level);

	if (state->stage_complete) {
		return;
	}

	state->stage_timer++;
	state->encounter_timer++;

	if (state->encounters_remaining > 0 && state->encounter_timer >= (8 * 60)) {
		state->encounter_timer = 0;
		state->encounters_remaining--;
	}

	if (state->encounters_remaining == 0) {
		state->stage_complete = 1;
		state->shop_pending = definition->opens_shop;
		if (definition->unlocked_assist != ASSIST_NONE) {
			state->unlocked_assists |= definition->unlocked_assist;
		}
	}
}

int Levels_Advance(LevelState *state) {
	if (state->current_level + 1 >= LEVEL_COUNT) {
		return 0;
	}

	Levels_Start(state, (LevelId)(state->current_level + 1));
	return 1;
}
