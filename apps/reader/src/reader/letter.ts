/** Sheets drawn in the letter's stack (ADR-0009); a sheet moves every tenth of the letter. */
export const LETTER_SHEETS = 10;

/** How many sheets lie turned over for a share of the letter read. */
export function sheetsTurned(turned: number): number {
  return Math.min(LETTER_SHEETS, Math.max(0, Math.floor(turned * LETTER_SHEETS + 1e-9)));
}
