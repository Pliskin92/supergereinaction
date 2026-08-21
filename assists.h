#ifndef ASSISTS_H
#define ASSISTS_H

#include "player.h"

#define ASSIST_MATTIA_DURATION (20 * 60)
#define ASSIST_MICHELE_DURATION (8 * 60)
#define ASSIST_COOLDOWN_FRAMES (15 * 60)

typedef enum AssistType {
	ASSIST_NONE = 0,
	ASSIST_UNCLE_MATTIA,
	ASSIST_UNCLE_MICHELE
} AssistType;

typedef struct AssistState {
	AssistType active;
	int16_t active_timer;
	int16_t cooldown_mattia;
	int16_t cooldown_michele;
	uint8_t mattia_laser_pulse;
	uint8_t michele_hit_count;
	uint8_t michele_ground_pound_ready;
	SpriteFrame sprite;
} AssistState;

void AssistSystem_Init(AssistState *state);
int AssistSystem_CanActivate(const AssistState *state, AssistType type);
int AssistSystem_Activate(AssistState *state, AssistType type);
void AssistSystem_Update(AssistState *state, Player *player);

#endif
