# ADR-0011: An incense instrument

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Project owner

## Context

The instrument channel (ADR-0006) grows one kind per book, each chosen from
that book's own text (ADR-0008 to ADR-0010), so that no device turns up in
book after book.

In 《红楼梦》 the poetry club times its contests with one stick of 梦甜香.
The stick is lit when the topic is set; while it burns the poets think and
write, and when it has burnt out, time is up and whoever has not finished is
penalised. The text makes the stick a clock that everyone in the room is
watching. Ambience can carry the room. What the picture cannot show is the
stick itself, burning down while the reader reads the poets at work.

As with the other kinds since the wind, the owner does not want this kind
reused by default: it belongs to the book in which a stick of incense keeps
time.

### Alternatives considered

- **Keys that hold, like the radio's.** Rejected. A stick that shortened in
  jumps at each key would look like a meter, not a flame. It should burn
  down as the reader reads.
- **Burning by wall-clock time.** Rejected. Staging follows reading position
  (ADR-0004): a reader who pauses must not come back to a stick burnt out, and
  paging back must give back what was burnt.
- **A countdown.** Rejected. Instruments show no numbers the text does not
  give, and the stick is already the clock.

## Decision

Add `incense` as the fifth kind in the instrument channel of
`direction.json` and `playback.json` v2. Everything in ADR-0006 applies
unchanged: the `visual_novel` profile only, ordered and disjoint spans, page
turns that move and jumps that land, audio reactivity from the ambience and
sound-effect buses only, dimming under a CG, `aria-hidden`, and the same
`placement` values. Unlike other kinds, an incense key's `burnt` value is
interpolated between keys, as described below.

### 1. Direction (intent)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "incense",
    "at": "p2210", "until": "p2262",
    "intent": "the_crab_flower_contest",
    "states": [
      { "at": "p2210", "state": "unlit" },
      { "at": "p2214", "state": "burning" },
      { "at": "p2255", "state": "ember" },
      { "at": "p2261", "state": "out" }
    ]
  }
]
```

The `incense` states are:

- `unlit`: the stick standing whole in its burner.
- `burning`: a glowing tip, a thread of smoke, ash lengthening.
- `ember`: a short stub, the glow lower and redder, the last stretch.
- `out`: the ember gone, the last smoke thinning away, the ash fallen.

Each is what the text says of the stick, never more. Within a span the states
only move forward through that order: a stick is not unlit again once lit.

### 2. Playback (resolved)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "incense",
    "at": "p2210", "until": "p2262",
    "placement": "auto",
    "keys": [
      { "at": "p2210", "state": "unlit", "burnt": 0 },
      { "at": "p2214", "state": "burning", "burnt": 0 },
      { "at": "p2255", "state": "ember", "burnt": 0.85 },
      { "at": "p2261", "state": "out", "burnt": 1 }
    ]
  }
]
```

- **`burnt`** runs from 0 to 1: the share of the stick burnt away at the key.
  An `unlit` key has `burnt: 0`. Within a span `burnt` never decreases. The
  values follow the text: when the text says the stick is half gone, it is
  0.5; otherwise keys spread the burning over the contest, with `ember`
  around 0.8 and `out` at 1 when the stick has burnt to its end.
- **`state`** repeats the directed state in force, as for every kind.

### 3. Burning between keys

Reading position sets how much of the stick is gone. Take the key at or
before the reading point, `a`, and the next key in the span, `b`. With
ordinals as for the camera (paragraph position plus the share of its reading
beats already read, ADR-0004):

- If `a` is `burning` or `ember`, the stick is lit and
  `burnt = a.burnt + (b.burnt − a.burnt) × (ordinal − a) / (b − a)`.
- If `a` is `unlit` or `out`, nothing burns: `burnt = a.burnt`.
- After the span's last key, and whenever there is no `b`, `burnt` holds at
  the last key's value. Before the first key it is the first key's value.

The result only ever moves forward as the reader moves forward, and moves
back as they page back. On a page turn the stick eases down to its new length;
a jump or resume lands on the interpolated value at once.

### 4. Look

A narrower plate than the other kinds, tall rather than wide, with the same
dark translucent ground and hairline gold border.

- **A burner.** A low, dark bronze bowl at the foot of the plate, a faint
  rim, a little pale ash inside.
- **The stick.** A thin reddish-brown line rising from the bowl. Its length
  is `1 − burnt` of the full stick.
- **The ember.** A small orange glow at the top of what is left, breathing
  slowly; lower and redder in `ember`.
- **Ash.** A short grey column above the ember that grows as the stick burns
  and, once long enough, bends and drops into the bowl.
- **Smoke.** One pale thread rising from the ember and curling as it goes.
  The loudness of the scene's sounds makes it waver, as a draught would; in
  a still room it rises almost straight.
- **`out`.** The glow fades, the last thread of smoke thins away over a few
  seconds, and nothing moves after that.

### 5. Reduced motion

The stick shows its current length, the smoke is drawn as a still curve, the
ember does not breathe, and no ash falls.

### 6. Validator rules

ADR-0006's rules apply, including that each key repeats the directed state in
force (ADR-0008). In addition:

- The schemas close the `incense` state vocabulary, require `burnt` from 0 to
  1 on every key, and require `burnt: 0` on an `unlit` key.
- Within a span, `burnt` never decreases from one key to the next.
- Within a span, directed states never move back in the order `unlit`,
  `burning`, `ember`, `out`.

## Consequences

**Positive**

- 《红楼梦》 can show the stick every poet in the room is watching, burning
  down with the reading, without art or licences.
- Paging back restores the stick, so the device never contradicts the
  reading position.

**Negative / costs**

- This is the first instrument whose keys interpolate. The Runtime computes
  the interpolated value in the instrument reading, and the validator guards
  the monotonic rule that makes it read as burning.
- A burning stick beside every gathering would soon be wallpaper. It
  belongs to the contests the text times with it.

## Rollout

1. Contracts: `incense` in the instrument kind, its state vocabulary, and an
   `incense` playback key with `burnt`, with schema tests.
2. Validator: an `incense` bundle in the staging tests, and the monotonic
   `burnt` and forward-only state rules.
3. Runtime: the interpolated share in the instrument reading, and the
   `incense` face.
4. Staging guide: when to use it, and how to spread `burnt` over a contest.
5. Pilot in 《红楼梦》: the first contest of the poetry club.
