// Touch controls: an on-screen pad for phones and tablets.
//
// The game was built for a keyboard, and everything downstream of input
// reads one of two things: the `Input` object (Input.held.left, and the
// one-shot Input.pressed.punch that clearPressed() wipes each frame), or a
// keydown event. This file feeds BOTH, rather than introducing a third
// input path that the menus and cutscenes would each have to learn about:
//
//   * gameplay  -> writes Input.held / Input.pressed directly, exactly as
//                  the keyboard handler does
//   * menus,    -> dispatches a synthetic keydown, so the title menu, the
//     cutscenes    cutscene skip and the name entry keep their single
//     summaries     keyboard code path and need no touch branch at all
//
// The pad is DOM, not canvas. Buttons drawn into the canvas would have to
// be hit-tested against a canvas that is scaled to the viewport, redrawn
// every frame, and would fight the game's own letterboxing. Absolutely
// positioned DOM over the canvas gets the browser's own touch handling,
// stays crisp at any density, and costs nothing per frame.

// Whether this device should get the pad at all.
//
// Pointer type rather than screen width: a narrow desktop window is still a
// keyboard machine and should not lose half its screen to thumb buttons,
// while a large tablet has no keyboard and needs them. `coarse` is exactly
// the question being asked -- is the primary pointer a finger.
function isTouchDevice() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch (e) {
    // Very old browsers without matchMedia: fall back to the touch API.
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}

// Sends a keydown/keyup pair for the screens that are keyboard-driven.
// `key` is the same string the real handlers compare against ('Enter',
// 'ArrowUp', 'j'), so those handlers need no knowledge of touch.
function sendKey(key) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
}

// The pad's buttons. `hold` buttons set Input.held for as long as a finger
// is down; `tap` buttons fire Input.pressed once per touch, the way the
// keyboard's one-shot actions do.
//
// `key` is what gets dispatched when the pad is driving a menu rather than
// gameplay, so a d-pad works the title screen and A confirms.
const TOUCH_BUTTONS = [
  { id: 'left', label: '◀', kind: 'hold', slot: 'left', key: 'ArrowLeft' },
  { id: 'right', label: '▶', kind: 'hold', slot: 'right', key: 'ArrowRight' },
  { id: 'up', label: '▲', kind: 'hold', slot: 'up', key: 'ArrowUp' },
  { id: 'down', label: '▼', kind: 'hold', slot: 'down', key: 'ArrowDown' },
  // The action cluster. Punch is the one used constantly, so it is the
  // biggest and sits under the thumb's resting position.
  { id: 'punch', label: 'A', kind: 'tap', slot: 'punch', key: 'j', primary: true },
  { id: 'roll', label: 'B', kind: 'tap', slot: 'slide', key: 'k' },
  { id: 'heavy', label: 'C', kind: 'tap', slot: 'heavy', key: 'l' },
  { id: 'jump', label: '⇑', kind: 'tap', slot: 'jump', key: ' ' },
];

// Reads one of the game-state globals the pad has to consult.
//
// These are declared `const`/`let` at the top level of classic scripts,
// which creates a SCRIPT-scoped binding that is deliberately not a property
// of window -- so a plain `window.Input` sees nothing even on the page that
// defines it. The pages that own these publish them explicitly (see
// `window.Input = Input` in level.js, and touchState() in level.js), and
// this reads only what was published. A page that publishes nothing simply
// gets null, which is the right answer for the title screen.
function globalOrNull(name) {
  return typeof window !== 'undefined' && window[name] !== undefined
    ? window[name] : null;
}

// True while the game is showing a keyboard-driven screen rather than
// playing: a cutscene, a card, the end-of-level summary, a game over. On
// those, a pad press must arrive as a key event instead of as Input state.
function touchWantsKeys() {
  // The level publishes this; pages without gameplay screens do not, and
  // fall through to the Input check below.
  const state = globalOrNull('touchState');
  if (typeof state === 'function') {
    const s = state();
    if (s.cutscene || s.card || s.summary || s.gameOver) return true;
  }
  // The title screen has no Input object at all -- it is a menu, and menus
  // are always key-driven.
  return !globalOrNull('Input');
}

// Builds the pad and wires it up. Safe to call on any page: it attaches to
// whatever exists and does nothing on a device that is not touch.
function setUpTouchControls(options = {}) {
  if (!isTouchDevice()) return null;

  const root = document.createElement('div');
  root.id = 'touchPad';
  root.setAttribute('aria-hidden', 'true');

  // Tracks which pointer is on which button, so a finger sliding off a
  // button releases it, and two thumbs work at once (move while punching).
  const activeButtons = new Map(); // pointerId -> button def

  const release = (def) => {
    if (!def) return;
    const input = globalOrNull('Input');
    if (def.kind === 'hold' && input) {
      input.held[def.slot] = false;
    }
    const el = root.querySelector(`[data-id="${def.id}"]`);
    if (el) el.classList.remove('pressed');
  };

  const press = (def, el) => {
    el.classList.add('pressed');
    // On a menu/cutscene the pad speaks keyboard; in play it speaks Input.
    if (touchWantsKeys()) {
      sendKey(def.key);
      return;
    }
    const input = globalOrNull('Input');
    if (!input) return;
    if (def.kind === 'hold') input.held[def.slot] = true;
    // A one-shot press is latched for the next update(), which clears it --
    // the same contract the keyboard's Input.pressed has.
    else input.pressed[def.slot] = true;
  };

  for (const def of TOUCH_BUTTONS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `touch-btn touch-${def.id}${def.primary ? ' touch-primary' : ''}`;
    el.dataset.id = def.id;
    el.textContent = def.label;
    el.tabIndex = -1;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Keep receiving this pointer's events even if the finger slides off
      // the button, so a release is never missed and a direction can never
      // stick on.
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      }
      activeButtons.set(e.pointerId, def);
      press(def, el);
    });

    const end = (e) => {
      e.preventDefault();
      release(activeButtons.get(e.pointerId));
      activeButtons.delete(e.pointerId);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    // The browser's own gestures -- double-tap zoom, long-press menus, text
    // selection -- all fire on a game pad otherwise.
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    root.appendChild(el);
  }

  // A pointer lost anywhere (app backgrounded mid-press, say) must not
  // leave a direction held down forever.
  window.addEventListener('blur', () => {
    for (const def of activeButtons.values()) release(def);
    activeButtons.clear();
  });

  // Pause/menu, top corner rather than in the thumb clusters: it leaves the
  // level, so it must be hard to hit by accident.
  if (options.escape !== false) {
    const esc = document.createElement('button');
    esc.type = 'button';
    esc.className = 'touch-btn touch-esc';
    esc.textContent = '☰';
    esc.tabIndex = -1;
    esc.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sendKey('Escape');
    });
    root.appendChild(esc);
  }

  document.body.appendChild(root);
  document.body.classList.add('has-touch-pad');
  return root;
}
