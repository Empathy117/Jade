import { safeGet } from "./localStorage";
import type { AudioSettings } from "./useAudioDirector";

export interface ReaderSettings extends AudioSettings {
  fontScale: number;
  reducedMotion: boolean;
}

export const SETTINGS_KEY = "immersive-reader:settings:v1";

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontScale: 1,
  masterVolume: 0.9,
  musicVolume: 0.55,
  ambienceVolume: 0.5,
  muted: false,
  pureMode: false,
  reducedMotion: false,
};

/** Merge saved settings over the defaults, discarding anything unreadable. */
export function parseSettings(
  saved: string | null,
  defaults: ReaderSettings,
): ReaderSettings {
  if (!saved) return defaults;
  try {
    const parsed = JSON.parse(saved) as unknown;
    if (typeof parsed !== "object" || parsed === null) return defaults;
    return { ...defaults, ...(parsed as Partial<ReaderSettings>) };
  } catch {
    return defaults;
  }
}

export function loadSettings(): ReaderSettings {
  const defaults: ReaderSettings = {
    ...DEFAULT_SETTINGS,
    reducedMotion:
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  };
  return parseSettings(safeGet(SETTINGS_KEY), defaults);
}
