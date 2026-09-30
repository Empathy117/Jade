/** Tracks across the pianola's roll, one per key (ADR-0010). */
export const PIANOLA_TRACKS = 12;
/** Rows punched in one loop of the roll. */
export const PIANOLA_ROWS = 48;

/** A 32-bit FNV-1a hash of a span id: the roll's seed. */
export function rollSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small deterministic generator (mulberry32): the same seed, the same roll. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Punch a roll for a span: a melody wandering over the upper tracks, some
 * notes held, a bass note under every other beat, and a chord now and then.
 * Row-major, one byte per track: 1 is a hole. Nothing here is a score; it
 * only has to look like one.
 */
export function punchRoll(id: string): Uint8Array {
  const random = seededRandom(rollSeed(id));
  const roll = new Uint8Array(PIANOLA_TRACKS * PIANOLA_ROWS);
  const punch = (row: number, track: number) => {
    if (track >= 0 && track < PIANOLA_TRACKS) roll[(row % PIANOLA_ROWS) * PIANOLA_TRACKS + track] = 1;
  };
  let melody = 6 + Math.floor(random() * 6);
  let bass = Math.floor(random() * 4);
  for (let row = 0; row < PIANOLA_ROWS; row += 1) {
    if (random() < 0.7) {
      punch(row, melody);
      if (random() < 0.35) punch(row + 1, melody);
      if (random() < 0.12) punch(row + 2, melody);
    }
    if (row % 4 === 0) {
      punch(row, bass);
      punch(row + 1, bass);
      if (random() < 0.4) bass = Math.floor(random() * 5);
    }
    if (row % 8 === 4 || random() < 0.05) {
      punch(row, melody - 3);
      punch(row, melody - 5);
    }
    melody = Math.min(PIANOLA_TRACKS - 1, Math.max(5, melody + Math.floor(random() * 5) - 2));
  }
  return roll;
}

/** Whether the roll has a hole on a track at a row; rows wrap, since the roll loops. */
export function holeAt(roll: Uint8Array, track: number, row: number): boolean {
  const wrapped = ((row % PIANOLA_ROWS) + PIANOLA_ROWS) % PIANOLA_ROWS;
  return roll[wrapped * PIANOLA_TRACKS + track] === 1;
}

/**
 * Where each key lies once the machine is taken apart: x and y offsets and a
 * tilt, three numbers per key, seeded like the roll.
 */
export function scatterKeys(id: string): Float32Array {
  const random = seededRandom(rollSeed(id) ^ 0x9e3779b9);
  const scattered = new Float32Array(PIANOLA_TRACKS * 3);
  for (let key = 0; key < PIANOLA_TRACKS; key += 1) {
    scattered[key * 3] = (random() - 0.5) * 10;
    scattered[key * 3 + 1] = random() * 14;
    scattered[key * 3 + 2] = (random() - 0.5) * 1.1;
  }
  return scattered;
}
