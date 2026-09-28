import { useEffect, useRef } from "react";
import { Howl } from "howler";

import { assetUrl } from "./data";
import type { Asset } from "./types";
import type { AudioSettings } from "./useAudioDirector";
import type { OneShotRun } from "./useStaging";

interface SoundEffectOptions {
  started: boolean;
  bookPath: string | null;
  run: OneShotRun | null;
  assets: Map<string, Asset>;
  settings: AudioSettings;
}

/**
 * Play each run of one-shot sounds once. Sound effects share the ambience
 * volume: both are the sounds of the scene rather than its score.
 */
export function useSoundEffects({ started, bookPath, run, assets, settings }: SoundEffectOptions) {
  const played = useRef(0);
  // Pending and playing sounds outlive the page turn that started them: a
  // quick reader should still hear the bark that follows the door.
  const pending = useRef(new Set<number>());
  const playing = useRef(new Set<Howl>());
  const volume = settings.ambienceVolume;
  const silent = !started || !bookPath || settings.pureMode;

  useEffect(() => {
    if (!run || run.serial === played.current) return;
    played.current = run.serial;
    if (silent || !bookPath) return;

    for (const sound of run.sounds) {
      const asset = assets.get(sound.asset_id);
      if (!asset) continue;
      const play = () => {
        const howl = new Howl({
          src: [assetUrl(bookPath, asset)],
          volume: sound.gain * volume,
          onend: () => {
            howl.unload();
            playing.current.delete(howl);
          },
        });
        playing.current.add(howl);
        howl.play();
      };
      if (!sound.delay_ms) {
        play();
        continue;
      }
      const timer = window.setTimeout(() => {
        pending.current.delete(timer);
        play();
      }, sound.delay_ms);
      pending.current.add(timer);
    }
  }, [assets, bookPath, run, silent, volume]);

  // Leaving the book or turning the sound off silences everything at once.
  useEffect(() => {
    const timers = pending.current;
    const howls = playing.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      howls.forEach((howl) => howl.unload());
      howls.clear();
    };
  }, [silent]);
}
