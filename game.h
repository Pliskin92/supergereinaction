#ifndef GAME_H
#define GAME_H

#include <stdint.h>
#include <psxgpu.h>
#include <psxetc.h>
#include <psxpad.h>

#define SCREEN_WIDTH 320
#define SCREEN_HEIGHT 240
#define OT_LENGTH 8
#define PACKET_AREA_SIZE 8192
#define PLAYER_MOVE_SPEED 2
#define PLAYER_SLIDE_SPEED 4
#define PLAYER_COMBO_WINDOW 12
#define PLAYER_SLIDE_DURATION 16
#define PLATINUM_STATE_FRAMES (10 * 60)

typedef enum GameState {
	GAME_STATE_MENU = 0,
	GAME_STATE_LEVEL,
	GAME_STATE_SHOP
} GameState;

typedef struct GameInput {
	uint16_t held;
	uint16_t pressed;
	uint16_t released;
} GameInput;

typedef struct SpriteFrame {
	int16_t u;
	int16_t v;
	int16_t w;
	int16_t h;
	uint16_t tpage;
	uint16_t clut;
} SpriteFrame;

typedef struct RenderBuffer {
	DISPENV disp;
	DRAWENV draw;
	u_long ot[OT_LENGTH];
	u_long packet_area[PACKET_AREA_SIZE / sizeof(u_long)];
} RenderBuffer;

#endif
