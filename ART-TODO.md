# Art still to be made

The campaign is **playable end to end right now** — all six levels, the
boss fights, the scoring and the highscore table all work. What is missing
is art: levels 2–6 currently borrow level 1's street, and five of the six
bosses are the same character.

Nothing here blocks play. Every slot below has a working fallback, so art
can be dropped in **one piece at a time** and the game keeps running the
whole way.

---

## 1. Level backgrounds — the biggest visual win

Levels 2–6 all draw level 1's street (`PLACEHOLDER_STREET` in
`godot/scripts/campaign.gd`). Each needs one **horizontally tileable strip**.

| Level | Setting | File to create |
|---|---|---|
| 2 | Grandpa Gastone's garage | `godot/assets/backgrounds/lv2/lv2-background.png` |
| 3 | Uncle Mattia's workshop | `godot/assets/backgrounds/lv3/lv3-background.png` |
| 4 | Uncle Michele's yard | `godot/assets/backgrounds/lv4/lv4-background.png` |
| 5 | Boss Luigi's approach | `godot/assets/backgrounds/lv5/lv5-background.png` |
| 6 | The final rescue | `godot/assets/backgrounds/lv6/lv6-background.png` |

**Requirements**, matching `lv1-background.png` (1855×387):

- The **left and right edges must line up**, because the strip is laid down
  end to end 6–8 times to make the level. A seam shows as a hard vertical
  line every screen or so.
- Keep the same proportions (roughly 4.8:1). Other ratios work, but the art
  is scaled to the canvas height, so a taller image simply means less of the
  world visible at once.
- There must be a clear, flat **walkable band** — the pavement in level 1.

**To install one**, edit that level's row in `godot/scripts/campaign.gd`:

```js
{
  id: 'lv2',
  background: 'assets/release/backgrounds/lv2/lv2-background.png',
  walk: { top: 0.731, bottom: 0.907 },   // measure off the new art
  placeholderArt: true,                  // <- delete this line
  ...
}
```

`walk.top` / `walk.bottom` are the top and bottom of the walkable band as
**fractions of the image's height**. Measure them once in an image editor:
if the floor runs from y=283 to y=351 on a 387px-tall image, they are
283/387 = 0.731 and 351/387 = 0.907. Get these wrong and characters stand
in the sky or sink through the floor — they are the only numbers that have
to be measured rather than guessed.

## 2. Level title-card splashes (optional, high impact)

Each level opens on a title card (`godot/scripts/level-card.gd`). With no art it
draws a dark card with speed lines — which looks fine. Give a level an
`art:` path and that image becomes the backdrop, which is the natural place
for a **comic panel** establishing each location.

```js
{ id: 'lv2', art: 'assets/release/cards/lv2.png', ... }
```

Any size; it is scaled to cover the canvas and dimmed behind the type.

## 3. Bosses

Levels 2–6 all use `boss1`, so every boss fight is the same character. Each
new boss needs a sprite pack at
`godot/assets/<name>_sprites/<clip>/{spritesheet.png,atlas.json}`
with, at minimum: `idle_right`, `walk_right`, `punch`, `fall`.

Then add an entry to `EnemyTypes` in `godot/scripts/entities.gd` (copy `boss1` and
change the numbers — it is the fullest example) and point the level's
`boss:` at it. The README names **Boss Luigi** for level 5 and
**Mario, Wario & Bowser** for level 6.

## 4. Enemy variety

Every level draws from the same two street minions. Levels 2–6 accept any
pair via their `minions: { standard, tough }` field, so a garage level
could field mechanics and a workshop level could field something else.
Same sprite-pack layout as above.

## 5. Assist sprites (Mattia, Michele)

Rescuing them unlocks them as summonable assists (`godot/scripts/assist.gd`).
Neither has a pack, so both currently appear as coloured vector figures that
walk and punch. A pack at `godot/assets/<name>_sprites/` with
`idle_right`, `walk_right` and `punch` makes them appear as themselves — no
code change, the lookup already tries those clips and falls back.

## 6. Shop backdrops — done

All five shop backdrops are shipped (`godot/assets/shops/`) and wired
to their levels via `shopArt` in `godot/scripts/campaign.gd`. Nothing to do here
unless you want to redraw them.

## 7. Rescue characters

Each level now ends with a story scene (`godot/scripts/interlude.gd`) in which the
rescued relative speaks. `carla` and `roger` have packs and appear as
themselves; `gastone`, `mattia` and `michele` fall back to a coloured vector
figure.

A pack needs only ONE standing clip to appear properly — `idle_right`,
`walk_right` or `wave`, whichever exists (see `INTERLUDE_STANDING_CLIPS`).
Then add one line to `INTERLUDE_CHARACTERS`:

```js
const INTERLUDE_CHARACTERS = {
  carla: 'carla',
  family: 'roger',
  gastone: 'gastone',   // <- once assets/release/gastone_sprites/ exists
};
```

Figures are auto-scaled to a common height, so a pack authored at any size
stands correctly beside Gere.

---

## How the fallbacks work

So you can add art in any order without breaking anything:

- **A missing sprite clip** 404s and that action is simply unavailable for
  that character — it does not crash, and other clips still play. (This is
  why the browser console shows a batch of 404s on load: those are optional
  clips nothing has drawn yet. They are expected.)
- **A missing background** leaves the level on the placeholder street.
- **A missing card splash** falls back to the speed-line card.
- **A missing family sprite pack** draws a coloured vector figure in the
  story scene, at the right height, so the scene still plays.
- **A missing boss type** would be a real error — so add the `EnemyTypes`
  entry in the same change as the `boss:` reference.
