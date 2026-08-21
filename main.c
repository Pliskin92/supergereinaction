#include <stddef.h>
#include <stdint.h>
#include <psxapi.h>
#include <psxetc.h>
#include <psxgpu.h>
#include <psxgte.h>
#include <psxpad.h>
#include "assists.h"
#include "game.h"
#include "levels.h"
#include "player.h"

typedef struct GameContext {
	GameState state;
	GameInput input;
	Player player;
	AssistState assists;
	LevelState levels;
	uint32_t frame_count;
} GameContext;

static RenderBuffer g_buffers[2];
static uint8_t g_active_buffer;
static uint8_t *g_next_primitive;
static unsigned char g_pad_buffers[2][34];
static SpriteFrame g_white_sprite;

static int clamp_int(int value, int minimum, int maximum) {
	if (value < minimum) {
		return minimum;
	}
	if (value > maximum) {
		return maximum;
	}
	return value;
}

static void UploadWhiteTexture(void) {
	uint16_t texels[2] = { 0x7fff, 0x7fff };
	RECT rect = { 960, 0, 1, 1 };

	LoadImage(&rect, (u_long *)texels);
	DrawSync(0);

	g_white_sprite.u = 0;
	g_white_sprite.v = 0;
	g_white_sprite.w = 1;
	g_white_sprite.h = 1;
	g_white_sprite.tpage = getTPage(2, 0, rect.x, rect.y);
	g_white_sprite.clut = 0;
}

static void InitVideo(void) {
	ResetGraph(0);
	SetDefDispEnv(&g_buffers[0].disp, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
	SetDefDrawEnv(&g_buffers[0].draw, 0, SCREEN_HEIGHT, SCREEN_WIDTH, SCREEN_HEIGHT);
	SetDefDispEnv(&g_buffers[1].disp, 0, SCREEN_HEIGHT, SCREEN_WIDTH, SCREEN_HEIGHT);
	SetDefDrawEnv(&g_buffers[1].draw, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

	g_buffers[0].draw.isbg = 1;
	setRGB0(&g_buffers[0].draw, 16, 24, 40);
	g_buffers[1].draw.isbg = 1;
	setRGB0(&g_buffers[1].draw, 16, 24, 40);

	PutDispEnv(&g_buffers[0].disp);
	PutDrawEnv(&g_buffers[0].draw);
	SetDispMask(1);
}

static void InitPads(void) {
	InitPAD(g_pad_buffers[0], sizeof(g_pad_buffers[0]), g_pad_buffers[1], sizeof(g_pad_buffers[1]));
	StartPAD();
	ChangeClearPAD(0);
}

static uint16_t ReadPadHeld(void) {
	PADTYPE *pad = (PADTYPE *)g_pad_buffers[0];

	if (pad->stat != 0) {
		return 0;
	}

	return (uint16_t)~pad->btn;
}

static void UpdateInput(GameContext *game) {
	uint16_t previous = game->input.held;

	game->input.held = ReadPadHeld();
	game->input.pressed = game->input.held & (uint16_t)~previous;
	game->input.released = previous & (uint16_t)~game->input.held;
}

static void DrawQuad(int x, int y, int w, int h, const SpriteFrame *frame, uint8_t r, uint8_t g, uint8_t b, int ot_index) {
	POLY_FT4 *sprite = (POLY_FT4 *)g_next_primitive;
	int depth = clamp_int(ot_index, 0, OT_LENGTH - 1);

	setPolyFT4(sprite);
	setRGB0(sprite, r, g, b);
	setXY4(sprite, x, y, x + w, y, x, y + h, x + w, y + h);
	setUVWH(sprite, frame->u, frame->v, frame->w, frame->h);
	sprite->tpage = frame->tpage;
	sprite->clut = frame->clut;
	addPrim(g_buffers[g_active_buffer].ot + depth, sprite);

	g_next_primitive += sizeof(POLY_FT4);
}

static void RenderMenu(void) {
	DrawQuad(32, 40, 256, 56, &g_white_sprite, 60, 96, 180, OT_LENGTH - 3);
	DrawQuad(64, 120, 192, 72, &g_white_sprite, 100, 148, 255, OT_LENGTH - 2);
}

static void RenderShop(void) {
	DrawQuad(16, 24, 288, 192, &g_white_sprite, 28, 36, 72, OT_LENGTH - 3);
	DrawQuad(32, 48, 256, 64, &g_white_sprite, 88, 120, 220, OT_LENGTH - 2);
	DrawQuad(48, 136, 224, 40, &g_white_sprite, 196, 180, 72, OT_LENGTH - 1);
}

static void RenderLevel(const GameContext *game) {
	int player_r = game->player.platinum_state ? 255 : 240;
	int player_g = game->player.platinum_state ? 255 : 80;
	int player_b = game->player.platinum_state ? 160 : 80;
	int assist_x = game->player.x + (game->player.facing > 0 ? 20 : -20);

	DrawQuad(0, 160, SCREEN_WIDTH, 80, &g_white_sprite, 80, 120, 64, OT_LENGTH - 4);
	DrawQuad(game->player.x, game->player.y, 20, 28, &g_white_sprite, (uint8_t)player_r, (uint8_t)player_g, (uint8_t)player_b, OT_LENGTH - 2);

	if (game->assists.active == ASSIST_UNCLE_MATTIA) {
		DrawQuad(assist_x, game->player.y - 8, 18, 24, &g_white_sprite, 120, 255, 255, OT_LENGTH - 1);
	} else if (game->assists.active == ASSIST_UNCLE_MICHELE) {
		DrawQuad(assist_x, game->player.y - 8, 18, 24, &g_white_sprite, 255, 180, 96, OT_LENGTH - 1);
	}
}

static void BeginFrame(void) {
	ClearOTagR(g_buffers[g_active_buffer].ot, OT_LENGTH);
	g_next_primitive = g_buffers[g_active_buffer].packet_area;
}

static void EndFrame(void) {
	DrawSync(0);
	VSync(0);
	PutDispEnv(&g_buffers[g_active_buffer].disp);
	PutDrawEnv(&g_buffers[g_active_buffer].draw);
	DrawOTag(g_buffers[g_active_buffer].ot + (OT_LENGTH - 1));
	g_active_buffer ^= 1;
}

static void TryActivateAssist(GameContext *game) {
	AssistType assist = ASSIST_NONE;

	if (!game->player.platinum_state) {
		return;
	}

	if ((game->input.held & PADRright) && (game->input.pressed & PADRleft) &&
		(game->levels.unlocked_assists & ASSIST_UNCLE_MATTIA)) {
		assist = ASSIST_UNCLE_MATTIA;
	} else if ((game->input.held & PADRleft) && (game->input.pressed & PADRright) &&
			   (game->levels.unlocked_assists & ASSIST_UNCLE_MICHELE)) {
		assist = ASSIST_UNCLE_MICHELE;
	}

	if (assist != ASSIST_NONE) {
		AssistSystem_Activate(&game->assists, assist);
	}
}

static void UpdateMenu(GameContext *game) {
	if (game->input.pressed & PADRleft) {
		game->state = GAME_STATE_LEVEL;
	}
}

static void UpdateShop(GameContext *game) {
	if (game->input.pressed & (PADRleft | PADRright)) {
		if (!Levels_Advance(&game->levels)) {
			Levels_Start(&game->levels, LEVEL_GRANDMA_CARLA);
			game->levels.unlocked_assists = ASSIST_NONE;
			Player_Init(&game->player);
			AssistSystem_Init(&game->assists);
		}
		game->state = GAME_STATE_LEVEL;
	}
}

static void UpdateLevel(GameContext *game) {
	Player_Update(&game->player, &game->input);
	TryActivateAssist(game);
	AssistSystem_Update(&game->assists, &game->player);
	Levels_Update(&game->levels);

	if (!game->levels.stage_complete) {
		return;
	}

	if (game->levels.shop_pending) {
		game->state = GAME_STATE_SHOP;
		game->levels.shop_pending = 0;
		return;
	}

	if (!Levels_Advance(&game->levels)) {
		game->state = GAME_STATE_MENU;
		Levels_Start(&game->levels, LEVEL_GRANDMA_CARLA);
		game->levels.unlocked_assists = ASSIST_NONE;
		Player_Init(&game->player);
		AssistSystem_Init(&game->assists);
	}
}

int main(void) {
	GameContext game;

	InitVideo();
	InitPads();
	UploadWhiteTexture();

	game.state = GAME_STATE_MENU;
	game.input.held = 0;
	game.input.pressed = 0;
	game.input.released = 0;
	game.frame_count = 0;
	Player_Init(&game.player);
	game.player.sprite = g_white_sprite;
	AssistSystem_Init(&game.assists);
	game.assists.sprite = g_white_sprite;
	Levels_Init(&game.levels);

	for (;;) {
		UpdateInput(&game);

		switch (game.state) {
		case GAME_STATE_MENU:
			UpdateMenu(&game);
			break;
		case GAME_STATE_LEVEL:
			UpdateLevel(&game);
			break;
		case GAME_STATE_SHOP:
			UpdateShop(&game);
			break;
		}

		BeginFrame();

		switch (game.state) {
		case GAME_STATE_MENU:
			RenderMenu();
			break;
		case GAME_STATE_LEVEL:
			RenderLevel(&game);
			break;
		case GAME_STATE_SHOP:
			RenderShop();
			break;
		}

		EndFrame();
		game.frame_count++;
	}

	return 0;
}
