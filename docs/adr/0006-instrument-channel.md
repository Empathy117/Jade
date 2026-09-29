# ADR-0006: An instrument channel, starting with the radio

**Status:** Proposed
**Date:** 2026-09-29
**Deciders:** Project owner

## Context

The visual-novel profile (ADR-0005) gave the Reader sound effects, CGs, and
screen and text effects. The owner avoids character sprites (repetition, cost,
lost imagination). The owner's reference points are Tsukiweb and the mood of
Rusty Lake, and both favour atmosphere and objects over faces.

《我们生活在南京》 shows what this approach is missing. Its two leads speak
across twenty years through amateur shortwave radio and never see each other.
The radio is effectively the second protagonist: a frequency, a signal that
strengthens or fades, a transmit lamp, a noise floor. Today the Reader can
express the radio only through ambience, one-shot sounds, and a background of
a radio desk. The picture cannot show the state of the link, the thing each
exchange depends on.

The same need recurs in other books. A telephone line, a transistor radio, a
pocket watch, a heart monitor: in each, an object's changing state carries the
scene's tension.

### Alternatives considered

- **three.js / WebGL.** Rejected. The library alone would more than double
  the Reader's JavaScript payload. It keeps the GPU busy for hours of reading.
  Its look pulls toward game-like realism that clashes with painted plates.
  And a Director agent cannot reliably author 3D scenes. The effects wanted
  here are 2D.
- **Baking the radio into backgrounds or CGs.** Rejected. A static picture
  cannot follow the signal from line to line, and every state would need its
  own commissioned image.
- **A book-specific widget.** Rejected. It would break the rule that the
  Runtime plays versioned contracts and never knows about particular books.

## Decision

Add an **instrument channel** to `direction.json` and `playback.json` v2. It is
available only in the `visual_novel` profile, and `radio` is its first and, for
now, only kind. An instrument is a small, procedural 2D overlay: SVG and
Canvas, no image assets. It shows an object's state and follows reading
position, like the camera does.

### 1. Direction (intent)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "radio",
    "at": "p00214", "until": "p00306",
    "intent": "first_contact",
    "states": [
      { "at": "p00214", "state": "listening" },
      { "at": "p00222", "state": "transmitting" },
      { "at": "p00256", "state": "tuning" },
      { "at": "p00268", "beat": 1, "state": "contact" },
      { "at": "p00305", "state": "lost" },
      { "at": "p00306", "state": "off" }
    ]
  }
]
```

`state` is a closed vocabulary per kind. For `radio` the states are
`off`, `listening`, `tuning`, `contact`, `transmitting`, and `lost`. States
describe what the text says is happening, never more.

### 2. Playback (resolved)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "radio",
    "at": "p00214", "until": "p00306",
    "placement": "auto",
    "keys": [
      { "at": "p00214", "frequency": "14.195", "signal": 0.05, "noise": 0.6, "tx": false },
      { "at": "p00222", "frequency": "14.195", "signal": 0.05, "noise": 0.6, "tx": true },
      { "at": "p00256", "frequency": "14.130", "signal": 0.05, "noise": 0.7, "tx": false, "tuning": true },
      { "at": "p00268", "beat": 1, "frequency": "14.255", "signal": 0.55, "noise": 0.4, "tx": false }
    ]
  }
]
```

- **`frequency`** is a display string matching `^\d{1,5}(\.\d{1,3}){0,2}$`. The
  unit comes from the kind (MHz for `radio`). It must be a value the text
  states. When the text gives none, the key omits it and the display shows
  dashes. The Compiler never invents a number.
- **`signal`** and **`noise`** run from 0 to 1. Signal sets the S-meter
  needle's resting position. Noise sets how much the needle and the waveform
  react to sound.
- **`tx`** lights the transmit lamp.
- **`tuning`** makes the digits roll from the previous key's frequency to this
  one during the page turn.
- **`placement`** is `auto` (above the adv text box, or the top-right corner
  in nvl), `top_right`, or `above_text`.

Keys hold rather than interpolate. The Runtime eases the needle toward each
new value with a damped motion, the way a physical meter settles. A page turn
moves the instrument; a jump or resume lands on the target state with no
travel, as the camera does.

### 3. Audio reactivity

A Web Audio analyser taps the **ambience and sound-effect buses only, never
music**. Its level, scaled by the key's `noise`, jitters the needle and drives
a single-trace waveform. When the static rises, the needle trembles; when a
signal comes through clean, the trace steadies. Picture and sound are then one
event rather than two timelines. With audio muted, in pure mode, or before the
audio context is unlocked, the instrument shows its resting values.

### 4. Look

- Restrained and flat: a dark translucent plate with a hairline border in the
  Reader's existing gold. Amber seven-segment digits, one needle, one trace,
  one red lamp. No skeuomorphic 3D chassis and no brand marks.
- At most a quarter of the viewport width. It never overlaps the adv text box
  or the reading column.
- It fades in when its span begins and out when it ends. While a CG is on
  screen it dims so that the CG leads.
- `aria-hidden`. It is decorative; the text already says what happens.

### 5. Reduced motion

The instrument shows its current values statically. There is no needle
settling, waveform, digit roll, or audio jitter. The transmit lamp still
reflects `tx`.

### 6. Validator rules

- Instruments require `profile: "visual_novel"`.
- Spans are ordered, do not overlap, and `until` is not before `at`.
- Every state and key lies inside its span and is ordered. There is at most
  one key per reading beat.
- Playback instruments mirror direction by `id`, `kind`, and span.
- Every `state` belongs to its kind's vocabulary.

## Consequences

**Positive**

- A book whose drama lives in an object can show that object's state without
  sprites or extra art.
- No assets and no licences are needed, and the cost to reading performance
  is small.
- The channel generalises: `telephone`, `transistor_radio`, `watch`, or
  `monitor` can later join as new kinds with their own state vocabularies.

**Negative / costs**

- Another overlay competes for attention. The look and placement rules above
  exist to keep it quiet.
- Audio reactivity needs the ambience and sound-effect buses routed
  separately from music inside the audio director.
- Each new kind needs its own visual design and state vocabulary, which means
  a Runtime change and an amendment to this ADR.

## Rollout

1. Extend the schemas (instrument definitions in direction and playback v2)
   and the validator, with tests.
2. Build the Runtime `Instrument` overlay for `radio`: static rendering,
   state resolution by reading position, and stepped versus jumped transitions.
3. Add audio reactivity through ambience and sound-effect bus analysers.
4. Add instrument guidance to `docs/visual-novel-staging-guide.md`: when to
   use one, what the states mean, and the rule against inventing frequencies.
5. Once the rework of 《我们生活在南京》 is complete, pilot on its first-contact
   slice (scene_005). Anchors in this ADR's examples are illustrative; the
   pilot uses the reworked direction.

## Open questions

- Should `placement: auto` sit above the text box, or in a corner that keeps
  the CG's centre clear?
- Should the waveform trace show only when `noise` is above zero, or always
  while a span is active?
- When a CG covers the stage mid-span, should the instrument dim (proposed) or
  hide entirely?
