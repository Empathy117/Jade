import { Howler, type Howl } from "howler";

/**
 * A listening tap on the sounds of the scene — ambience and sound effects,
 * never music — so an instrument can react to what the reader hears
 * (ADR-0006). The tap only listens: it feeds a silent sink, so connecting it
 * never changes what plays.
 */

let analyser: AnalyserNode | null = null;
let samples: Float32Array<ArrayBuffer> | null = null;
const tapped = new WeakSet<AudioNode>();

function reactiveAnalyser(): AnalyserNode | null {
  const context = Howler.ctx;
  if (!context) return null;
  if (!analyser || analyser.context !== context) {
    analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    // Some engines only pull an analyser that reaches the destination.
    const sink = context.createGain();
    sink.gain.value = 0;
    analyser.connect(sink);
    sink.connect(context.destination);
    samples = new Float32Array(analyser.fftSize);
  }
  return analyser;
}

interface HowlInternals {
  _sounds?: { _node?: unknown }[];
}

/** Route a howl's Web Audio voices into the tap whenever they start playing. */
export function tapReactive(howl: Howl): void {
  const connect = () => {
    const target = reactiveAnalyser();
    if (!target) return;
    // Howler keeps each voice's gain node on `_node`; HTML5 voices have none.
    for (const sound of (howl as unknown as HowlInternals)._sounds ?? []) {
      const node = sound._node;
      if (node instanceof AudioNode && !tapped.has(node)) {
        node.connect(target);
        tapped.add(node);
      }
    }
  };
  howl.on("play", connect);
}

// Taps sit after each voice's volume, so raw loudness depends on the reader's
// volume settings. A slowly decaying peak normalises it: the meter follows how
// the scene's sound rises and falls, whatever the listening level. The floor
// keeps true silence at zero instead of amplifying the noise floor.
const SILENCE = 0.0004;
let peak = SILENCE;

function measure(): number {
  if (!analyser || !samples) return 0;
  analyser.getFloatTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const rms = Math.sqrt(sum / samples.length);
  peak = Math.max(rms, peak * 0.996, SILENCE);
  return rms;
}

/** Loudness of the scene's sounds right now, 0 (silence) to 1 (recent peak). */
export function reactiveLevel(): number {
  const rms = measure();
  return rms <= SILENCE ? 0 : Math.min(1, rms / peak);
}

/** The current waveform scaled so the recent peak spans about ±1, or null. */
export function reactiveWaveform(): Float32Array | null {
  if (!analyser || !samples) return null;
  const scale = 0.5 / Math.max(peak, SILENCE);
  return samples.map((sample) => sample * scale);
}
