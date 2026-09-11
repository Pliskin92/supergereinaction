// The shop between levels.
//
// It opens after each rescue scene, before the summary, and spends SCORE.
// Score is already earned, already carried across levels by the run, and
// already the thing the player is watching -- so it is a currency without
// needing a second one dropped, drawn, HUD'd and persisted.
//
// That choice has a real consequence and it is the point: points spent here
// are gone from the final total. Buying a life to survive level 5 costs the
// highscore it would have been worth, so the shop is a running decision
// about whether you are playing to finish or to score.
//
// What it sells is permanent for the run (a bigger health pool, harder
// blows, more lives), because a consumable that only lasts one level would
// be a worse version of the potions the street already drops.
//
// ART: the shop draws a backdrop when the level's row names one and a plain
// panel otherwise. There is shop art in assets/private for all five
// locations; moving one into assets/release and pointing a campaign row at
// it is all it takes. See ART-TODO.md.

// The stock. Prices are in points, against a run that earns roughly
// 8-12k per level.
//
// `apply` mutates the player AND the run: the player so the effect is
// immediate, the run so it survives the page load into the next level. Both
// are needed -- the player object does not outlive the level.
const SHOP_STOCK = [
  // No healing item: every level already starts the player at full health
  // (Player.startLevel), so one would never be worth buying.
  {
    id: 'life',
    nameKey: 'shopLife',
    price: 2500,
    // A whole extra heart, and the ceiling with it.
    apply: (player, runState) => {
      player.maxLives++;
      player.lives++;
      runState.lives = player.lives;
      runState.maxLives = player.maxLives;
    },
  },
  {
    id: 'vitality',
    nameKey: 'shopVitality',
    price: 1800,
    // The same permanent boost the boss drop gives, bought rather than
    // rolled.
    apply: (player, runState) => {
      player.maxHp += BOSS_HP_BOOST;
      player.hp = player.maxHp;
      runState.maxHp = player.maxHp;
    },
  },
  {
    id: 'power',
    nameKey: 'shopPower',
    price: 3000,
    // Multiplicative, and it stacks with itself and with boss drops, so it
    // stays worth buying late when points are plentiful.
    apply: (player, runState) => {
      player.atkMultiplier *= BOSS_ATK_BOOST;
      runState.atkMultiplier = player.atkMultiplier;
    },
  },
];

// What is actually on the shelves.
function shopStock() {
  return SHOP_STOCK;
}

// Restores everything the shop and the boss drops have granted onto a
// freshly constructed Player at the start of a level.
//
// Without this the shop would be a con: the page reloads between levels, so
// a bought +20 max HP would vanish on the next level's first frame.
function applyRunUpgrades(player, runState) {
  if (!runState) return;
  if (runState.maxHp) {
    player.maxHp = Math.max(player.maxHp, runState.maxHp);
    player.hp = player.maxHp;
  }
  if (runState.maxLives) {
    player.maxLives = Math.max(player.maxLives, runState.maxLives);
  }
  if (runState.atkMultiplier) {
    player.atkMultiplier = runState.atkMultiplier;
  }
}

class Shop {
  constructor(W, H, levelDef, player, runState) {
    this.W = W;
    this.H = H;
    this.level = levelDef;
    this.player = player;
    this.run = runState;
    this.stock = shopStock();
    this.index = 0;
    this.done = false;
    // The last thing bought, flashed beside its row so a purchase is
    // acknowledged rather than only showing up as a smaller score.
    this.flash = 0;
    this.flashId = null;
    // Rejected purchase (not enough points), flashed the same way.
    this.deny = 0;
  }

  get current() {
    return this.stock[this.index];
  }

  canAfford(item) {
    return item && this.player.score >= item.price;
  }

  handleKey(key) {
    if (this.done) return;
    if (key === 'ArrowUp') {
      this.index = (this.index + this.stock.length - 1) % this.stock.length;
    } else if (key === 'ArrowDown') {
      this.index = (this.index + 1) % this.stock.length;
    } else if (key === 'Enter') {
      this.buy();
    } else if (key === 'Escape' || key === ' ') {
      this.done = true;
    }
  }

  buy() {
    const item = this.current;
    if (!item) return;
    if (!this.canAfford(item)) {
      this.deny = 30;
      return;
    }
    this.player.score -= item.price;
    this.run.score = this.player.score;
    item.apply(this.player, this.run);
    saveRun(this.run);
    this.flash = 40;
    this.flashId = item.id;
  }

  update() {
    if (this.flash > 0) this.flash--;
    if (this.deny > 0) this.deny--;
  }

  draw(ctx) {
    const { W, H } = this;
    ctx.save();

    // Backdrop: the level's shop art if it has any, a dark panel otherwise.
    const art = this.level && this.level.shopArt
      ? LevelCardArt[`${this.level.id}-shop`] : null;
    if (art) {
      drawCoverImage(ctx, art, W, H);
      ctx.fillStyle = 'rgba(10,8,18,0.72)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = 'rgba(10,8,20,0.94)';
      ctx.fillRect(0, 0, W, H);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    ctx.font = 'bold 26px Impact, "Arial Black", sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#1a1020';
    ctx.strokeText(t('shopTitle'), W / 2, 40);
    ctx.fillStyle = '#ffd54d';
    ctx.fillText(t('shopTitle'), W / 2, 40);

    // The purse. This is the number every price is weighed against, so it
    // is the second-biggest thing on the screen.
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#00f5d4';
    ctx.fillText(`${t('score')}: ${this.player.score}`, W / 2, 68);

    // The shelves.
    const rowH = 30;
    const top = 104;
    const rowW = Math.min(430, W * 0.62);
    this.stock.forEach((item, i) => {
      const y = top + i * rowH;
      const selected = i === this.index;
      const affordable = this.canAfford(item);

      ctx.fillStyle = selected ? 'rgba(255,213,77,0.16)' : 'rgba(255,255,255,0.05)';
      rr(ctx, (W - rowW) / 2, y - rowH / 2 + 3, rowW, rowH - 6, 5);
      ctx.fill();

      ctx.font = `bold ${selected ? 14 : 13}px monospace`;
      ctx.textAlign = 'left';
      // An item that cannot be afforded is dimmed rather than hidden, so
      // the player can see what they are saving toward.
      ctx.fillStyle = affordable
        ? (selected ? '#ffffff' : '#cfc9e0')
        : 'rgba(255,255,255,0.32)';
      ctx.fillText(t(item.nameKey), (W - rowW) / 2 + 14, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = affordable ? '#ffd54d' : 'rgba(232,76,76,0.65)';
      ctx.fillText(String(item.price), (W + rowW) / 2 - 14, y);

      // Purchase acknowledgement.
      if (this.flash > 0 && this.flashId === item.id) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00f5d4';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(t('shopBought'), W / 2, y + rowH - 6);
      }
      ctx.textAlign = 'center';
    });

    if (this.deny > 0) {
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#e84c4c';
      ctx.fillText(t('shopTooPoor'), W / 2, top + this.stock.length * rowH + 6);
    }

    // What the player currently has, so the effect of a purchase is visible
    // rather than abstract.
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(
      `${t('livesLeft')}: ${this.player.lives}♥   HP: ${this.player.maxHp}`
        + `   ATK: x${this.player.atkMultiplier.toFixed(2)}`,
      W / 2, H - 46,
    );

    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(t('shopHint'), W / 2, H - 24);
    ctx.restore();
  }
}
