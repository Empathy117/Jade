# ADR-0010: A pianola instrument

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Project owner

## Context

The instrument channel (ADR-0006) grows one kind per book, each chosen from
that book's own text (ADR-0008, ADR-0009), so that no device turns up in book
after book.

In 《百年孤独》 a pianola arrives in Macondo in crates. It is assembled in the
new house, plays by itself at the party that opens the house, and draws the
town to hear music with no one at the keys. José Arcadio Buendía later takes
it apart to find the magic inside, and it is put back together and played
again. The instrument is wonder made mechanical: holes in a paper roll passing
over a bar, keys going down under no hand. Music can already come from the
BGM channel. What the picture cannot show is the machine doing it: the roll
moving, the keys dipping, and later the same machine in pieces on the floor.

As with the wind and the letter, the owner does not want this kind reused by
default: it belongs to the book in which a pianola is a marvel.

### Alternatives considered

- **Keys that follow the BGM.** Rejected. The instrument channel never taps
  music (ADR-0006), and a roll that pretended to be the recording heard would
  claim a correspondence nobody authored.
- **A generated sound.** Rejected. The pianola must not make audio; the BGM
  channel carries music, and a second source would fight it.
- **A hand-authored hole pattern.** Rejected. The text gives no score, and a
  Director could only invent one.

## Decision

Add `pianola` as the fourth kind in the instrument channel of
`direction.json` and `playback.json` v2. Everything in ADR-0006 applies
unchanged: the `visual_novel` profile only, ordered and disjoint spans, keys
that hold until the next key, page turns that move and jumps that land,
dimming under a CG, `aria-hidden`, and the same `placement` values.

### 1. Direction (intent)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "pianola",
    "at": "p1120", "until": "p1146",
    "intent": "the_house_opens",
    "states": [
      { "at": "p1120", "state": "closed" },
      { "at": "p1127", "state": "playing" },
      { "at": "p1141", "state": "faltering" }
    ]
  }
]
```

The `pianola` states are:

- `closed`: the case shut, lid down, still.
- `playing`: the roll moving past the tracker bar, keys dipping by themselves.
- `faltering`: the roll stutters, keys stick, holes pass without sounding.
- `dismantled`: the roll slack and unwound, keys lying loose; nothing moves.

Each is what the text says the machine is doing, never more.

### 2. Playback (resolved)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "pianola",
    "at": "p1120", "until": "p1146",
    "placement": "auto",
    "keys": [
      { "at": "p1120", "state": "closed" },
      { "at": "p1127", "state": "playing", "tempo": 0.7 },
      { "at": "p1141", "state": "faltering" }
    ]
  }
]
```

- **`tempo`** is optional and runs from 0 to 1: how fast the roll travels.
  It follows what the text says of the music (a slow waltz, a lively tune);
  when the text says nothing, it is omitted and the roll runs at 0.5. It is
  allowed only on `playing` and `faltering` keys.
- **`state`** repeats the directed state in force, as for every kind.

### 3. The roll

The hole pattern is drawn, not authored. The Runtime seeds a small random
generator with the span's `id` and punches a roll of 12 tracks and 48 rows
from it: sparse notes, short runs, an occasional chord. The same span always
shows the same roll, and different spans show different ones. The roll loops.

The pianola listens to nothing. Its keys follow its own roll, which never
claims to be the music the reader hears.

### 4. Look

The same plate as the radio: dark, translucent, a hairline gold border, at
most a quarter of the viewport wide. Inside, a dark wooden case:

- **A window** in which a strip of pale buff paper scrolls down past a
  brass tracker bar with twelve ports. Holes are small dark slots.
- **Twelve keys** below the bar, ivory with thin dark gaps. When a hole
  passes its port, that key dips and darkens a little, then rises.
- **`closed`.** A flat lid covers window and keys. On a page turn into
  `playing` it lifts; a jump shows it open at once.
- **`faltering`.** The roll lurches and pauses, some holes pass without a
  key moving, and some keys stay down a moment too long.
- **`dismantled`.** The lid is off, the roll hangs out of the window in a
  slack loop, and the keys lie scattered and tilted below the bar. Nothing
  moves.

A change of tempo on a page turn eases the roll's speed; a jump sets it.

### 5. Reduced motion

The roll stands still at a fixed point, with the keys under its current holes
shown down. The lid is open or shut at once. Nothing stutters.

### 6. Validator rules

ADR-0006's rules apply, including that each key repeats the directed state in
force (ADR-0008). In addition, the schemas close the `pianola` state
vocabulary, bound `tempo` to 0–1, and forbid `tempo` on `closed` and
`dismantled` keys.

## Consequences

**Positive**

- 《百年孤独》 can show the marvel of a machine that plays itself, and its
  ruin and revival, with no art, no licences, and no sound of its own.
- The roll costs the Director nothing: it is seeded, not authored.

**Negative / costs**

- A moving roll is the busiest face in the channel. It belongs to the few
  spans where the text dwells on the pianola, not to every party in the
  house; the staging guide says so.
- The roll is decorative and cannot match the BGM. A reader who looks for
  the melody in the holes will not find it.

## Rollout

1. Contracts: `pianola` in the instrument kind, its state vocabulary, and a
   `pianola` playback key with optional `tempo`, with schema tests.
2. Validator: a `pianola` bundle in the staging tests.
3. Runtime: the seeded roll and the `pianola` face.
4. Staging guide: when to use it, and that tempo follows the text.
5. Pilot in 《百年孤独》: the pianola's first night, and the span in which it
   is taken apart.
