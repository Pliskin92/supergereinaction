#ifndef LEVELS_H
#define LEVELS_H

#include "assists.h"

typedef enum LevelId {
	LEVEL_GRANDMA_CARLA = 0,
	LEVEL_GRANDPA_GASTONE,
	LEVEL_UNCLE_MATTIA,
	LEVEL_UNCLE_MICHELE,
	LEVEL_BOSS_LUIGI,
	LEVEL_MULTI_BOSS,
	LEVEL_COUNT
} LevelId;

typedef struct LevelDefinition {
	const char *name;
	uint8_t encounter_count;
	uint8_t opens_shop;
	AssistType unlocked_assist;
} LevelDefinition;

typedef struct LevelState {
	LevelId current_level;
	int16_t stage_timer;
	int16_t encounter_timer;
	uint8_t encounters_remaining;
	uint8_t stage_complete;
	uint8_t shop_pending;
	AssistType unlocked_assists;
} LevelState;

void Levels_Init(LevelState *state);
const LevelDefinition *Levels_GetDefinition(LevelId level);
void Levels_Start(LevelState *state, LevelId level);
void Levels_Update(LevelState *state);
int Levels_Advance(LevelState *state);

#endif
