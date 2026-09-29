import type { Howl } from "howler";

// How much of a pass overlaps the next: long enough to cover an MP3's encoder
// padding (about 0.1 s at each end) and a seam that does not quite match,
// short enough that the loop's own shape is kept.
const MIN_OVERLAP_S = 0.4;
const MAX_OVERLAP_S = 3;
const OVERLAP_SHARE = 0.15;
// Howler fades are linear, and a linear crossfade between two passes of noise
// dips about 3 dB at its midpoint. Staggering the ramps — the next pass rises
// over the first 70 % of the overlap, this one falls over the last 70 % — keeps
// the combined loudness within about 1 dB across the seam.
const RAMP_SHARE = 0.7;

/**
 * Loop an ambience track without a hole at the seam.
 *
 * Native looping replays the decoded buffer end to end, so any silence an
 * encoder left at either end — or a fade baked into the file — is heard once
 * per pass. Instead each pass starts the next one a little before it ends and
 * crossfades between them.
 */
export class SeamlessLoop {
  private volume = 0;
  private current: number | null = null;
  private timer: number | null = null;
  private releaseTimer: number | null = null;
  /** The pass being handed over from, until its release ramp has begun. */
  private outgoing: number | null = null;
  private stopped = false;

  constructor(private readonly howl: Howl) {}

  /**
   * Start playing, fading in from silence to `volume` over `fadeMs`. A track
   * catalogued as not looping plays once.
   */
  start(volume: number, fadeMs: number, loop = true): void {
    this.volume = volume;
    const begin = () => {
      if (this.stopped) return;
      this.current = this.howl.play();
      this.howl.volume(0, this.current);
      this.howl.fade(0, volume, fadeMs, this.current);
      if (loop) this.scheduleNext();
    };
    if (this.howl.state() === "loaded") begin();
    else this.howl.once("load", begin);
  }

  /** Move to a new volume, e.g. when the reader changes the ambience level. */
  setVolume(volume: number, fadeMs: number): void {
    this.volume = volume;
    if (this.current === null) return;
    this.howl.fade(this.howl.volume(this.current) as number, volume, fadeMs, this.current);
  }

  /** Fade out and release the track. */
  stop(fadeMs: number, onDone: () => void): void {
    this.stopped = true;
    this.clearTimers();
    // Stopping mid-seam: the pass still waiting to fade out fades with the rest.
    for (const id of [this.current, this.outgoing]) {
      if (id !== null) this.howl.fade(this.howl.volume(id) as number, 0, fadeMs, id);
    }
    window.setTimeout(() => {
      this.howl.stop();
      this.howl.unload();
      onDone();
    }, fadeMs + 80);
  }

  unload(): void {
    this.stopped = true;
    this.clearTimers();
    this.howl.unload();
  }

  private clearTimers(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    if (this.releaseTimer !== null) window.clearTimeout(this.releaseTimer);
  }

  private overlapSeconds(): number {
    const duration = this.howl.duration();
    return Math.min(MAX_OVERLAP_S, Math.max(MIN_OVERLAP_S, duration * OVERLAP_SHARE));
  }

  private scheduleNext(): void {
    const duration = this.howl.duration();
    if (!Number.isFinite(duration) || duration <= MIN_OVERLAP_S * 2) {
      // Too short to crossfade against itself; fall back to plain looping.
      if (this.current !== null) this.howl.loop(true, this.current);
      return;
    }
    const overlapMs = Math.round(this.overlapSeconds() * 1000);
    const rampMs = Math.round(overlapMs * RAMP_SHARE);
    this.timer = window.setTimeout(() => {
      if (this.stopped) return;
      const outgoing = this.current;
      const incoming = this.howl.play();
      this.howl.volume(0, incoming);
      this.howl.fade(0, this.volume, rampMs, incoming);
      if (outgoing !== null) {
        this.outgoing = outgoing;
        this.releaseTimer = window.setTimeout(() => {
          this.howl.fade(this.howl.volume(outgoing) as number, 0, rampMs, outgoing);
          this.outgoing = null;
        }, overlapMs - rampMs);
      }
      this.current = incoming;
      this.scheduleNext();
    }, Math.round(duration * 1000) - overlapMs);
  }
}
