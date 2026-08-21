#include "player.h"

static int clamp_int(int value, int minimum, int maximum) {
	if (value < minimum) {
		return minimum;
	}
	if (value > maximum) {
		return maximum;
	}
	return value;
}

void Player_Init(Player *player) {
	player->x = 48;
	player->y = 152;
	player->vx = 0;
	player->vy = 0;
	player->facing = 1;
	player->hp = 100;
	player->max_hp = 100;
	player->fury_meter = 0;
	player->platinum_timer = 0;
	player->platinum_state = 0;
	player->combo_step = 0;
	player->combo_damage = 0;
	player->move_timer = 0;
	player->action = PLAYER_ACTION_IDLE;
	player->sprite.u = 0;
	player->sprite.v = 0;
	player->sprite.w = 1;
	player->sprite.h = 1;
	player->sprite.tpage = 0;
	player->sprite.clut = 0;
}

void Player_StartPunchCombo(Player *player) {
	if (player->move_timer > 0 && player->action == PLAYER_ACTION_KNEE_SLIDE) {
		return;
	}

	if (player->move_timer == 0) {
		player->combo_step = 0;
	}

	if (player->combo_step < 3) {
		player->combo_step++;
	}

	player->action = (PlayerAction)(PLAYER_ACTION_PUNCH_1 + (player->combo_step - 1));
	player->move_timer = PLAYER_COMBO_WINDOW;
	player->combo_damage = 8 + (player->combo_step * 4);
	player->fury_meter = clamp_int(player->fury_meter + 8, 0, 100);

	if (player->fury_meter >= 100) {
		player->platinum_state = 1;
		player->platinum_timer = PLATINUM_STATE_FRAMES;
	}
}

void Player_StartKneeSlide(Player *player) {
	if (player->move_timer > 0 && player->action != PLAYER_ACTION_KNEE_SLIDE) {
		return;
	}

	player->action = PLAYER_ACTION_KNEE_SLIDE;
	player->move_timer = PLAYER_SLIDE_DURATION;
	player->vx = player->facing * PLAYER_SLIDE_SPEED;
	player->fury_meter = clamp_int(player->fury_meter + 12, 0, 100);
}

void Player_Heal(Player *player, int amount) {
	player->hp = clamp_int(player->hp + amount, 0, player->max_hp);
}

void Player_Update(Player *player, const GameInput *input) {
	int dx = 0;
	int dy = 0;

	if (input->pressed & PADRleft) {
		Player_StartPunchCombo(player);
	}

	if (input->pressed & PADRright) {
		Player_StartKneeSlide(player);
	}

	if (player->move_timer > 0) {
		player->move_timer--;
	}

	if (player->action == PLAYER_ACTION_KNEE_SLIDE && player->move_timer > 0) {
		player->x += player->vx;
	} else {
		if (input->held & PADLleft) {
			dx--;
			player->facing = -1;
		}
		if (input->held & PADLright) {
			dx++;
			player->facing = 1;
		}
		if (input->held & PADLup) {
			dy--;
		}
		if (input->held & PADLdown) {
			dy++;
		}

		player->x += dx * PLAYER_MOVE_SPEED;
		player->y += dy * PLAYER_MOVE_SPEED;

		if (dx != 0 || dy != 0) {
			player->action = PLAYER_ACTION_WALK;
		} else if (player->move_timer == 0) {
			player->action = PLAYER_ACTION_IDLE;
			player->combo_step = 0;
			player->combo_damage = 0;
		}
	}

	player->x = clamp_int(player->x, 16, SCREEN_WIDTH - 32);
	player->y = clamp_int(player->y, 72, SCREEN_HEIGHT - 32);

	if (player->move_timer == 0 && player->action == PLAYER_ACTION_KNEE_SLIDE) {
		player->action = PLAYER_ACTION_IDLE;
		player->vx = 0;
	}

	if (player->platinum_state && player->platinum_timer > 0) {
		player->platinum_timer--;
		if (player->platinum_timer == 0) {
			player->platinum_state = 0;
			player->fury_meter = 0;
		}
	}
}
