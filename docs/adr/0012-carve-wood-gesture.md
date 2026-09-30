# ADR-0012: A carving gesture

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Project owner

## Context

ADR-0007 added gesture beats with two kinds, `grind_ink` and `press_seal`,
and said new kinds would join by amendment. The owner wants each book to have
its own device, chosen from its own text, so that no element wears thin by
turning up in book after book.

《小李飞刀》 opens in a carriage crossing the snow. 李寻欢 sits inside with his
small knife, carving a little wooden figure, and the text dwells on the knife
and the figure taking shape. It is one short physical act with a clear end, which is exactly what a gesture
beat is for (ADR-0007): the reader can make the same small strokes once, at
the moment the text describes them.

This ADR amends ADR-0007's list of kinds. As with the instruments since the
wind, the owner does not want this kind reused by default: it belongs to the
book in which a man carves a figure in a carriage.

### Alternatives considered

- **Carving a face or a named likeness.** Rejected. The Reader draws no faces
  and no likenesses. The figure is a silhouette, and who it is stays in the
  text.
- **Free drawing** (the reader shapes the figure however they like).
  Rejected. The text says what is being carved; the reader takes part in the
  act, not in deciding its outcome. There is no wrong stroke and no failure.
- **A parameter for the figure's pose or size.** Rejected. The text gives no
  such detail a drawing could honour, so any value would be invented.

## Decision

Add `carve_wood` as the third gesture kind. Everything in ADR-0007 applies
unchanged: the `visual_novel` profile only, arrival once on a forward page
turn, pointer input captured inside the plate, Enter to complete, a page turn
that ends the gesture and shows it finished as it fades, the hint line shown
until the kind is learned, pure mode hiding it, the same `placement` values,
and the same spacing, moment, and CG rules.

| Kind | Gesture | Object drawn | Completes when |
|---|---|---|---|
| `carve_wood` | short drags across the block | a small block of pale wood seen from the front, pared away stroke by stroke; curling shavings fly off | enough of the waste wood is gone, or enough strokes are made |

### 1. Direction (intent)

```jsonc
"gestures": [
  { "id": "gesture_001", "kind": "carve_wood", "at": "p0014", "intent": "carving_in_the_snow" }
]
```

### 2. Playback (resolved)

```jsonc
"gestures": [
  {
    "id": "gesture_001", "kind": "carve_wood", "at": "p0014",
    "placement": "auto",
    "params": { "stage": "finish" },
    "sound": { "asset_id": "sfx_knife_last_shaving", "gain": 0.35 }
  }
]
```

- **`carve_wood.params.stage`** is `rough`, `finish`, or omitted, and is the
  kind's only parameter. It says how far the text takes the figure at this
  beat. `finish` (the default when omitted) leaves a smooth, slender standing
  figure when carving completes. `rough` leaves a figure still blocky and
  faceted, for a beat where the text shows the carving begun and not
  finished. Both come from the text: a completed figure where the text has
  not finished it would claim more than the text says, and nothing else about
  the figure is given precisely enough to draw.
- **`sound`** optionally names an `sfx` asset, played once on completion, as
  for every gesture. Carving has no looping sound while the knife moves.
- **`placement`** is `auto`, `center`, or `above_text`, as in ADR-0007.

### 3. Carving

- The block is divided into small cells. A hidden silhouette marks which of
  them belong to the figure: a small head with no features, a narrow neck,
  slight shoulders, a long robe widening toward the foot, and a plinth. For
  `rough` the silhouette is coarser and wider, cut in straight facets.
- Each drag inside the block is a knife stroke. Along its path it pares away
  waste wood within a knife's width, and never cuts into the figure. Where
  wood comes away, a curling shaving flies off and falls.
- A stroke counts once it travels at least three cells. Carving completes
  when 60% of the waste wood is gone or after 12 counted strokes, whichever
  comes first, so a reader who strokes anywhere on the block always finishes
  within a few seconds.
- On completion the remaining waste fades away and the figure stands on its
  plinth. There is no wrong stroke and no failure state.

### 4. Input and accessibility

As in ADR-0007. The plate's accessible name is "削木，可跳过" and its hint line
is "削木". **Reduced motion:** a single press completes the carving at once,
with no shavings and no fade.

### 5. Look

The same plate as the other gestures: a dark translucent ground with a
hairline gold border. The block is pale, warm wood with a few faint grain
lines, and the figure is cut from that same wood, so its outline shows only
where the waste has come away. Shavings are thin pale curls. No faces,
tools, or text are drawn.

### 6. Validator rules

ADR-0007's rules apply. The schemas add `carve_wood` to the gesture kinds and
close its parameters to `stage` with the values `rough` and `finish`.

## Consequences

**Positive**

- 《小李飞刀》 can let the reader take the knife to the wood at the moment the
  text does, without art, faces, or a scoring game.
- A reader who strokes carelessly still finishes quickly, and one who skips
  still sees the figure the text describes.

**Negative / costs**

- The gesture is the first to keep its own drawing state across strokes, so
  its Runtime object holds a small grid and an offscreen canvas for the
  duration of one beat.
- Carving is a longer act than pressing a seal. ADR-0007's spacing rules and
  the staging guide keep it to the few beats where the text dwells on it.

## Rollout

1. Contracts: `carve_wood` in the gesture kinds and its `stage` parameter,
   with schema tests.
2. Validator: a `carve_wood` bundle in the staging tests.
3. Runtime: the carving grid and silhouette, the canvas drawing, shavings,
   and the reduced-motion single press.
4. Staging guide: when to use it, and when the text calls for `rough`.
5. Pilot in 《小李飞刀》: the carving in the carriage in its first chapter.
