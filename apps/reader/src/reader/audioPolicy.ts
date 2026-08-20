export const HIDDEN_PAGE_GAIN = 0.35;

export function pageVisibilityGain(visibilityState: string): number {
  return visibilityState === "hidden" ? HIDDEN_PAGE_GAIN : 1;
}
