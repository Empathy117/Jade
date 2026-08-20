import { useEffect, useRef, useState } from "react";
import { Howl, Howler } from "howler";

import { pageVisibilityGain } from "./audioPolicy";
import { assetUrl } from "./data";
import type { Asset, ResolvedPlaybackState } from "./types";

export interface AudioSettings {
  masterVolume: number;
  musicVolume: number;
  ambienceVolume: number;
  muted: boolean;
  pureMode: boolean;
}

interface AudioDirectorOptions {
  started: boolean;
  bookPath: string | null;
  playback: ResolvedPlaybackState;
  assets: Map<string, Asset>;
  settings: AudioSettings;
}

interface PlayingTrack {
  assetId: string;
  howl: Howl;
}

export function unlockAudio(): void {
  if (Howler.ctx?.state === "suspended") {
    void Howler.ctx.resume().catch(() => {
      // A reload or book switch can close the previous context while resume is pending.
      // Howler will create the active track context when playback starts.
    });
  }
}

export function useAudioDirector({
  started,
  bookPath,
  playback,
  assets,
  settings,
}: AudioDirectorOptions): string | null {
  const music = useRef<PlayingTrack | null>(null);
  const ambience = useRef<Map<string, Howl>>(new Map());
  const cleanupTimers = useRef<Set<number>>(new Set());
  const [audioError, setAudioError] = useState<string | null>(null);
  const [visibilityGain, setVisibilityGain] = useState(() =>
    pageVisibilityGain(document.visibilityState),
  );

  useEffect(() => {
    const updateVisibilityGain = () => {
      setVisibilityGain(pageVisibilityGain(document.visibilityState));
    };
    document.addEventListener("visibilitychange", updateVisibilityGain);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibilityGain);
    };
  }, []);

  useEffect(() => {
    Howler.volume(settings.masterVolume);
    Howler.mute(settings.muted || settings.pureMode);
  }, [settings.masterVolume, settings.muted, settings.pureMode]);

  useEffect(() => {
    const desired = playback.music;
    const desiredAsset = desired ? assets.get(desired.asset_id) : undefined;
    const shouldPlay = started && bookPath && !settings.pureMode && desired && desiredAsset;

    if (!shouldPlay) {
      if (music.current) {
        fadeAndUnload(music.current.howl, 500, cleanupTimers.current);
        music.current = null;
      }
      return;
    }

    const targetVolume =
      desired.gain * settings.musicVolume * visibilityGain;
    if (music.current?.assetId === desired.asset_id) {
      music.current.howl.fade(music.current.howl.volume(), targetVolume, 250);
      return;
    }

    if (music.current) {
      fadeAndUnload(
        music.current.howl,
        desired.duration_ms,
        cleanupTimers.current,
      );
    }

    const howl = new Howl({
      src: [assetUrl(bookPath, desiredAsset)],
      loop: desiredAsset.loop ?? true,
      volume: 0,
      onloaderror: (_id, error) => {
        setAudioError(`音乐加载失败：${String(error)}`);
      },
      onplayerror: (_id, error) => {
        setAudioError(`音乐播放失败：${String(error)}`);
      },
    });
    music.current = { assetId: desired.asset_id, howl };
    howl.play();
    howl.fade(0, targetVolume, desired.duration_ms);
  }, [
    assets,
    bookPath,
    playback.music,
    settings.musicVolume,
    settings.pureMode,
    started,
    visibilityGain,
  ]);

  useEffect(() => {
    const desiredTracks = started && bookPath && !settings.pureMode ? playback.ambience : [];
    const desiredIds = new Set(desiredTracks.map((track) => track.asset_id));

    for (const [assetId, howl] of ambience.current) {
      if (!desiredIds.has(assetId)) {
        fadeAndUnload(howl, 900, cleanupTimers.current);
        ambience.current.delete(assetId);
      }
    }

    for (const desired of desiredTracks) {
      if (!bookPath) continue;
      const targetVolume =
        desired.gain * settings.ambienceVolume * visibilityGain;
      const existing = ambience.current.get(desired.asset_id);
      if (existing) {
        existing.fade(existing.volume(), targetVolume, 250);
        continue;
      }
      const asset = assets.get(desired.asset_id);
      if (!asset) {
        continue;
      }
      const howl = new Howl({
        src: [assetUrl(bookPath, asset)],
        loop: asset.loop ?? true,
        volume: 0,
        onloaderror: (_id, error) => {
          setAudioError(`环境音加载失败：${String(error)}`);
        },
        onplayerror: (_id, error) => {
          setAudioError(`环境音播放失败：${String(error)}`);
        },
      });
      ambience.current.set(desired.asset_id, howl);
      howl.play();
      howl.fade(0, targetVolume, 900);
    }
  }, [
    assets,
    bookPath,
    playback.ambience,
    settings.ambienceVolume,
    settings.pureMode,
    started,
    visibilityGain,
  ]);

  useEffect(() => {
    const timers = cleanupTimers.current;
    const ambienceTracks = ambience.current;
    return () => {
      for (const timeout of timers) {
        window.clearTimeout(timeout);
      }
      music.current?.howl.unload();
      for (const howl of ambienceTracks.values()) {
        howl.unload();
      }
    };
  }, []);

  return audioError;
}

function fadeAndUnload(howl: Howl, durationMs: number, timers: Set<number>): void {
  const duration = Math.max(0, durationMs);
  howl.fade(howl.volume(), 0, duration);
  const timeout = window.setTimeout(() => {
    howl.stop();
    howl.unload();
    timers.delete(timeout);
  }, duration + 80);
  timers.add(timeout);
}
