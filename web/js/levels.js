// A fixed canvas for tuning Gere's movement before combat and levels exist.
const ARENA_WIDTH = 480;

class MechanicsArena {
  constructor() {
    this.worldWidth = ARENA_WIDTH;
  }

  advanceLockX() {
    return this.worldWidth;
  }

}

