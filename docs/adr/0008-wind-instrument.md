# ADR-0008: A wind instrument

**Status:** Accepted
**Date:** 2026-09-30
**Deciders:** Project owner

## Context

ADR-0006 added an instrument channel with one kind, `radio`, and said new
kinds would join by amendment. The owner now wants each book to have its own
presentation idea rather than share one across books, because the same device
repeated from book to book would wear thin.

《夏日书》 is a book about an island and its weather. The text keeps naming the
wind: a south-west wind that blows for days, a north wind all through
Midsummer Eve, a south-east gale at night, days of dead calm, a storm a child
prays for. The cottage has a barometer on the wall and the radio gives
forecasts. Whether the father is safe at sea, whether the boat can go out,
whether a night is frightening or peaceful, all hang on the wind. Ambience
already carries its sound. What the picture cannot show is its direction and
strength, and how they change from one paragraph to the next.

The same need is rare elsewhere. The owner explicitly does not want this kind
reused by default in other books; each book's instrument should be chosen from
its own text.

## Decision

Add `wind` as the second kind in the instrument channel of `direction.json`
and `playback.json` v2. Everything in ADR-0006 applies unchanged: the
`visual_novel` profile only, ordered and disjoint spans, keys that hold until
the next key, page turns that move and jumps that land, audio reactivity from
the ambience and sound-effect buses only, dimming under a CG, `aria-hidden`,
and the same `placement` values.

### 1. Direction (intent)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "wind",
    "at": "p0595", "until": "p0616",
    "intent": "waiting_out_the_gale",
    "states": [
      { "at": "p0595", "state": "breeze" },
      { "at": "p0597", "state": "gale" }
    ]
  }
]
```

The `wind` states are `calm`, `breeze`, `wind`, `gale`, and `storm`. Each is
what the text says the wind is doing, never more.

### 2. Playback (resolved)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "wind",
    "at": "p0595", "until": "p0616",
    "placement": "auto",
    "keys": [
      { "at": "p0595", "state": "breeze", "strength": 0.3, "gust": 0.3 },
      { "at": "p0597", "state": "gale", "from": "sw", "strength": 0.78, "gust": 0.6 }
    ]
  }
]
```

- **`from`** is the compass point the wind blows from: `n`, `ne`, `e`, `se`,
  `s`, `sw`, `w`, or `nw`. A "south-west wind" is `sw`. It must be a direction
  the text states or has stated for this wind; when the text gives none, the
  key omits it and no arrow is drawn. The Compiler never invents a direction.
  A `calm` key has no `from`.
- **`strength`** runs from 0 to 1 and sets the strength bar's resting level
  and the speed of the streaks. Suggested values: `calm` 0, `breeze` 0.25,
  `wind` 0.5, `gale` 0.75, `storm` 0.95.
- **`gust`** runs from 0 to 1 and sets how much the live loudness of the
  scene's sounds swings the arrow and flickers the bar, as `noise` does for
  the radio. Calm air does not react.
- **`state`** repeats the directed state in force, as for the radio.

### 3. Look

The same plate as the radio: dark, translucent, a hairline gold border, at
most a quarter of the viewport wide. Inside:

- **A dial.** A thin ring with eight ticks and a small `N` at the top.
- **An arrow** across the dial, pointing the way the wind blows, with its
  tail on the `from` side, so a south-west wind is drawn from the lower left
  to the upper right. It is absent when `from` is absent or the air is calm.
  On a page turn a change of direction swings the arrow the short way round
  with a damped motion; a jump sets it at once.
- **Streaks.** Three or four faint lines drift across the dial along the
  arrow at a speed that follows `strength`. They are drawn only when there is
  an arrow.
- **A strength bar** of five segments beside the dial, lit up to `strength`
  and flickering with gusts. In calm air it is dark and the dial shows only a
  still point at its centre.

No numbers are shown. A Beaufort figure would claim a precision the text never
gives.

### 4. Reduced motion

The arrow and bar show their current values statically: no swing, no
streaks, no flicker.

### 5. Validator rules

ADR-0006's rules apply. In addition, the schemas close the `wind` state
vocabulary, the `from` vocabulary, and forbid `from` on a `calm` key.

## Consequences

**Positive**

- 《夏日书》 can show the thing its chapters turn on without any art or
  licences.
- The instrument channel's shared plumbing (spans, reactivity, placement,
  dimming) carries a second kind with no new Runtime concepts.

**Negative / costs**

- Radio and wind now share the channel, so the playback key becomes a
  per-kind union and the Runtime component splits into a shared shell and one
  face per kind.
- A wind vane is easy to overuse. It belongs to spans where the wind itself
  is the tension (a boat out in a rising gale, a storm arriving), not to
  every windy paragraph. The staging guide says so.

## Rollout

1. Contracts: `wind` in the instrument kind, per-kind state vocabularies, and
   a `wind` playback key, with schema tests.
2. Validator: a `wind` bundle in the staging tests; no new rule beyond the
   schemas.
3. Runtime: split `Instrument` into a shared shell and a `radio` face, then
   add the `wind` face.
4. Staging guide: when to use it and the rule against inventing a direction.
5. Pilot in 《夏日书》, in a span where the wind is the scene's tension.
