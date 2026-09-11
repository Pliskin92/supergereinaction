// The campaign: the six story levels, and the run that walks through them.
//
// Level 1 was written as a one-off -- its roster, its boss, its backdrop and
// its walkable band were all constants at the top of level.js. Everything
// that actually DIFFERS between levels is now a row in the table below, and
// level.js reads the row for whichever level the run is on. Adding level 7
// is an entry here, not another copy of level.js.
//
// What a level owns:
//   id / titleKey  identity, and the HUD caption
//   background     the strip that repeats to make the street
//   walk           the walkable band inside that art, as image-height
//                  fractions (see LEVEL_WALK_TOP in level.js for how these
//                  are measured off the source image)
//   loops          how many times the strip is laid end to end
//   roster         how many minions the level spends, give or take jitter
//   packs          the size range one encounter arrives in
//   toughShare     fraction of each pack that is the tougher minion type
//   minions        which two enemy types make up the packs
//   boss           the enemy type waiting at the end
//   rescue         who is saved when the boss goes down -- the story beat
//                  the level exists to deliver
//   art            OPTIONAL splash shown behind the level's title card
//                  (js/level-card.js). Absent means the card draws its own
//                  speed-line treatment, so this can be filled in per level
//                  as the art arrives.
//
// A level whose art has not been drawn yet points at level 1's street and
// says so in `placeholderArt`. That is deliberate: the campaign is playable
// end to end NOW, and dropping in real art later is a one-line edit per
// level rather than a structural change. See ART-TODO.md.

// Level 1's street, reused as the stand-in backdrop for levels whose own
// art is not drawn yet. Named rather than repeated so the placeholder rows
// are obviously placeholders, and so swapping one for real art is a change
// in exactly one place -- that row's `background`.
const PLACEHOLDER_STREET = 'assets/release/backgrounds/lv1/lv1-background.png';
// The walkable band measured off that art. A level using the placeholder
// backdrop must use the placeholder band with it, or actors stand in the
// road; real art brings its own measured pair.
const PLACEHOLDER_WALK = { top: 0.731, bottom: 0.907 };

const Campaign = [
  {
    id: 'lv1',
    titleKey: 'level1Title',
    background: 'assets/release/backgrounds/lv1/lv1-background.png',
    walk: { top: 0.731, bottom: 0.907 },
    loops: 6,
    roster: 60,
    packs: { min: 4, max: 6 },
    toughShare: 0.3,
    minions: { standard: 'minion', tough: 'bananana' },
    boss: 'boss1',
    rescue: 'carla',
  },
  // Levels 2-6 run on the same engine and are fully playable; only their
  // backdrops are still level 1's street. The difficulty curve is real --
  // the roster grows, the packs get bigger, and the tougher minion takes
  // over the street -- so the campaign already plays as a campaign.
  {
    id: 'lv2',
    titleKey: 'level2Title',
    background: PLACEHOLDER_STREET,
    walk: PLACEHOLDER_WALK,
    placeholderArt: true,
    loops: 6,
    roster: 70,
    packs: { min: 4, max: 6 },
    toughShare: 0.4,
    minions: { standard: 'minion', tough: 'bananana' },
    boss: 'boss1',
    rescue: 'gastone',
  },
  {
    id: 'lv3',
    titleKey: 'level3Title',
    background: PLACEHOLDER_STREET,
    walk: PLACEHOLDER_WALK,
    placeholderArt: true,
    loops: 7,
    roster: 80,
    packs: { min: 5, max: 6 },
    toughShare: 0.5,
    minions: { standard: 'minion', tough: 'bananana' },
    boss: 'boss1',
    rescue: 'mattia',
  },
  {
    id: 'lv4',
    titleKey: 'level4Title',
    background: PLACEHOLDER_STREET,
    walk: PLACEHOLDER_WALK,
    placeholderArt: true,
    loops: 7,
    roster: 90,
    packs: { min: 5, max: 6 },
    toughShare: 0.6,
    minions: { standard: 'minion', tough: 'bananana' },
    boss: 'boss1',
    rescue: 'michele',
  },
  {
    id: 'lv5',
    titleKey: 'level5Title',
    background: PLACEHOLDER_STREET,
    walk: PLACEHOLDER_WALK,
    placeholderArt: true,
    loops: 7,
    roster: 100,
    packs: { min: 5, max: 6 },
    toughShare: 0.7,
    minions: { standard: 'minion', tough: 'bananana' },
    boss: 'boss1',
    rescue: null,
  },
  {
    id: 'lv6',
    titleKey: 'level6Title',
    background: PLACEHOLDER_STREET,
    walk: PLACEHOLDER_WALK,
    placeholderArt: true,
    loops: 8,
    roster: 110,
    packs: { min: 5, max: 6 },
    toughShare: 0.8,
    minions: { standard: 'minion', tough: 'bananana' },
    boss: 'boss1',
    rescue: 'family',
  },
];

const CAMPAIGN_LENGTH = Campaign.length;

// Clamps to a real level whatever it is handed, so a corrupted save or a
// hand-edited ?level= can never index off the end of the table.
function campaignLevel(index) {
  const i = clampIndex(index);
  return Campaign[i];
}

function clampIndex(index) {
  const n = Number(index);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(CAMPAIGN_LENGTH - 1, Math.floor(n)));
}

// ---- The run ----
// What carries ACROSS levels: which level is next, the score so far, and the
// lives left. Held in sessionStorage rather than localStorage because a run
// is one sitting: closing the tab ends it, and the permanent record is the
// highscore table, not this.
//
// Level 1 kept all of this in the Player, which was right while there was
// one level. Across six, the score has to survive the page navigation
// between them -- each level is its own page load -- so it lives here.

const RUN_KEY = 'supergere.run';

function newRun() {
  return {
    level: 0,
    score: 0,
    lives: difficultyLives(),
    rescued: [],
    // No upgrades yet; see loadRun for why these are named rather than
    // left to appear when first written.
    maxHp: undefined,
    maxLives: undefined,
    atkMultiplier: undefined,
  };
}

function loadRun() {
  try {
    const raw = sessionStorage.getItem(RUN_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      // A stored run from an older build may be missing fields added since.
      //
      // Every field the run carries has to be listed here: this rebuilds a
      // known shape rather than spreading `stored`, so anything omitted is
      // silently dropped on the next page load. The upgrade fields below
      // are exactly that -- the shop wrote them and they vanished between
      // levels until they were named here.
      return {
        level: clampIndex(stored.level),
        score: Number(stored.score) || 0,
        lives: Number(stored.lives) || difficultyLives(),
        rescued: Array.isArray(stored.rescued) ? stored.rescued : [],
        // Permanent upgrades, from the shop and from boss drops. Undefined
        // until something grants one; applyRunUpgrades() ignores absent
        // values rather than treating them as zero.
        maxHp: Number(stored.maxHp) || undefined,
        maxLives: Number(stored.maxLives) || undefined,
        atkMultiplier: Number(stored.atkMultiplier) || undefined,
      };
    }
  } catch (e) { /* storage blocked or unreadable; start a fresh run */ }
  return newRun();
}

function saveRun(run) {
  try {
    sessionStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch (e) { /* storage unavailable; the run stays in memory only */ }
}

function clearRun() {
  try {
    sessionStorage.removeItem(RUN_KEY);
  } catch (e) { /* nothing to clear */ }
}

// True once the level just beaten was the last one.
function runComplete(run) {
  return run.level >= CAMPAIGN_LENGTH;
}
