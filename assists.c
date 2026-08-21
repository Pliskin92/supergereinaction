#include "assists.h"

void AssistSystem_Init(AssistState *state) {
	state->active = ASSIST_NONE;
	state->active_timer = 0;
	state->cooldown_mattia = 0;
	state->cooldown_michele = 0;
	state->mattia_laser_pulse = 0;
	state->michele_hit_count = 0;
	state->michele_ground_pound_ready = 0;
	state->sprite.u = 0;
	state->sprite.v = 0;
	state->sprite.w = 1;
	state->sprite.h = 1;
	state->sprite.tpage = 0;
	state->sprite.clut = 0;
}

int AssistSystem_CanActivate(const AssistState *state, AssistType type) {
	if (state->active != ASSIST_NONE) {
		return 0;
	}

	if (type == ASSIST_UNCLE_MATTIA) {
		return state->cooldown_mattia == 0;
	}

	if (type == ASSIST_UNCLE_MICHELE) {
		return state->cooldown_michele == 0;
	}

	return 0;
}

int AssistSystem_Activate(AssistState *state, AssistType type) {
	if (!AssistSystem_CanActivate(state, type)) {
		return 0;
	}

	state->active = type;
	state->active_timer = (type == ASSIST_UNCLE_MATTIA) ? ASSIST_MATTIA_DURATION : ASSIST_MICHELE_DURATION;
	state->mattia_laser_pulse = 0;
	state->michele_hit_count = 0;
	state->michele_ground_pound_ready = 0;
	return 1;
}

void AssistSystem_Update(AssistState *state, Player *player) {
	if (state->cooldown_mattia > 0) {
		state->cooldown_mattia--;
	}

	if (state->cooldown_michele > 0) {
		state->cooldown_michele--;
	}

	if (state->active == ASSIST_NONE) {
		return;
	}

	if (state->active == ASSIST_UNCLE_MATTIA) {
		if ((state->active_timer % 60) == 0) {
			Player_Heal(player, 2);
		}

		if ((state->active_timer % 30) == 0) {
			state->mattia_laser_pulse++;
		}
	} else if (state->active == ASSIST_UNCLE_MICHELE) {
		if ((state->active_timer % 45) == 0) {
			state->michele_hit_count++;
		}

		if (state->active_timer <= 30) {
			state->michele_ground_pound_ready = 1;
		}
	}

	state->active_timer--;

	if (state->active_timer > 0) {
		return;
	}

	if (state->active == ASSIST_UNCLE_MATTIA) {
		state->cooldown_mattia = ASSIST_COOLDOWN_FRAMES;
	} else if (state->active == ASSIST_UNCLE_MICHELE) {
		state->cooldown_michele = ASSIST_COOLDOWN_FRAMES;
	}

	state->active = ASSIST_NONE;
	state->michele_ground_pound_ready = 0;
}
