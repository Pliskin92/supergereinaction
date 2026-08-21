#ifndef PLAYER_H
#define PLAYER_H

#include "game.h"

typedef enum PlayerAction {
	PLAYER_ACTION_IDLE = 0,
	PLAYER_ACTION_WALK,
	PLAYER_ACTION_PUNCH_1,
	PLAYER_ACTION_PUNCH_2,
	PLAYER_ACTION_PUNCH_3,
	PLAYER_ACTION_KNEE_SLIDE
} PlayerAction;

typedef struct Player {
	int16_t x;
	int16_t y;
	int16_t vx;
	int16_t vy;
	int16_t facing;
	int16_t hp;
	int16_t max_hp;
	int16_t fury_meter;
	int16_t platinum_timer;
	uint8_t platinum_state;
	uint8_t combo_step;
	uint8_t combo_damage;
	uint8_t move_timer;
	PlayerAction action;
	SpriteFrame sprite;
} Player;

void Player_Init(Player *player);
void Player_Update(Player *player, const GameInput *input);
void Player_StartPunchCombo(Player *player);
void Player_StartKneeSlide(Player *player);
void Player_Heal(Player *player, int amount);

#endif
