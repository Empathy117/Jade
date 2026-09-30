# ADR-0013: A making-up gesture

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Project owner

## Context

ADR-0007 added gesture beats and said new kinds would join by amendment;
ADR-0012 added the third. The owner wants each book to have its own device,
chosen from its own text, so that no element wears thin by turning up in book
after book.

《生尸之死》 is set in an America where the dead have begun to rise, and it
satirises the country's mortuary trade: embalming, "restorative art", a
cemetery whose dead are made up to look content. Its detective dies early in
the book and gets up again. The next morning, in front of a bathroom mirror, he
makes up his own face so that its pallor will pass for the living. It is one
short physical act, described in the text, with a clear end, and it turns the
book's satire on the person the reader is following. That is what a gesture
beat is for (ADR-0007): the reader makes the same small motion once, at the
moment the text describes it.

The act happens exactly once in the book. This ADR amends ADR-0007's list of
kinds. As with every device since the wind, it belongs to one book and is not
reused by default.

### Alternatives considered

- **Drawing a face, a mirror, or a reflection.** Rejected. The Reader draws no
  faces and no likenesses (ADR-0005, ADR-0012). A face drawn on a plate would
  also say more than the text does about what the reader should picture. The
  device is a featureless glazed field; the face stays in the text.
- **Authored colours** (a hex value for the pallor or the foundation).
  Rejected. The colours belong to the device, as the wood belongs to the
  carving. A free colour invites a Compiler to invent a skin tone the text
  never gives, and no reviewer could check it.
- **A finish parameter** (`matte` or `sheen`). Considered and rejected. The
  scene's point is that the pallor is covered, not how the covering looks, and
  a finish the text does not name would be invented. The field keeps one
  quiet glaze highlight whatever is applied.
- **A tool** (a sponge, a brush, a compact). Rejected. The pointer is the
  tool; drawing one adds an object the text may not mention.
- **Reusing `carve_wood`'s paring with a different skin.** Rejected. Carving
  removes material toward a hidden shape; making up adds colour that stays
  where it is laid. The motions feel different, and the difference is the
  point.

## Decision

Add `apply_cosmetics` as the fourth gesture kind. Everything in ADR-0007
applies unchanged: the `visual_novel` profile only, arrival once on a forward
page turn, pointer input captured inside the plate, Enter to complete, a page
turn that ends the gesture and shows it finished, the hint line shown until
the kind is learned, pure mode hiding it, the same `placement` values, and the
same spacing, moment, and CG rules.

| Kind | Gesture | Object drawn | Completes when |
|---|---|---|---|
| `apply_cosmetics` | brush across the field | a pale, cool, featureless glazed field; a warm living tint blooms where the brush passes and stays | about 60% of the field is warmed |

### 1. Direction (intent)

```jsonc
"gestures": [
  { "id": "gesture_001", "kind": "apply_cosmetics", "at": "p0412", "intent": "passing_for_living" }
]
```

### 2. Playback (resolved)

```jsonc
"gestures": [
  {
    "id": "gesture_001", "kind": "apply_cosmetics", "at": "p0412",
    "placement": "auto",
    "params": {}
  }
]
```

- **`apply_cosmetics` takes no parameters**; `params` must be empty, as for
  `press_seal`. The field, the tint, and the glaze are the device's own and
  are the same in every reading.
- **`sound`** optionally names an `sfx` asset, played once on completion, as
  for every gesture. There is no looping sound while the brush moves.
- **`placement`** is `auto`, `center`, or `above_text`, as in ADR-0007.

### 3. Making up

- The field is a soft, slightly irregular oval, wider than it is tall, so that
  it reads as a glazed tile or the unglazed body of porcelain rather than a
  head. It is ivory-grey and cool, with faint crazing in its glaze and one soft
  highlight. Nothing on it suggests eyes, a nose, or a mouth.
- Each drag across the field is a stroke of the brush. Along its path a warm,
  soft-edged tint is laid down, peach toward faint rose, a little uneven, the
  way foundation goes on. It stays where it is laid. Strokes outside the field
  lay nothing.
- The field is divided into small cells to measure coverage. When 60% of the
  field's cells are warmed, the rest warms in by itself over about a second.
  There is no wrong stroke and no failure state.
- Finished, the field is the only warm thing on the plate: for this kind the
  plate's hairline border and hint line are drawn in a neutral grey rather
  than the Reader's gold.

### 4. Input and accessibility

As in ADR-0007. The plate's accessible name is "上妆，可跳过" and its hint
line is "上妆". Neither word, nor any other interface text for this kind,
names death, disguise, or revival; the text does that.

- **Enter** completes it; the field warms in as it does on completion.
- **Page turn** completes it at once, without the warm-in, as the plate fades.
- **Reduced motion:** a single press completes it, and the warmth arrives as
  a plain fade with no brush marks.

### 5. Look

The same plate as the other gestures, with the neutral border noted above.
The field's crazing, grain, and highlight are drawn once to an offscreen
canvas when the beat arrives; the brush writes into a second offscreen canvas
from a pre-drawn soft dab, so a stroke allocates nothing per frame and the
canvas redraws only while the brush moves or the warmth fades in.

### 6. Validator rules

ADR-0007's rules apply. The schemas add `apply_cosmetics` to the gesture kinds
and close its `params` to the empty object. The validator adds one rule:

- **At most one `apply_cosmetics` per book** (`gesture_once_per_book`). The
  device's whole effect is a single turn from cold to warm; a second one would
  make it a routine. A book whose text genuinely repeats the act needs a new
  ADR, not a second beat.

## Consequences

**Positive**

- 《生尸之死》 can let the reader make up the detective's face at the moment the
  text does, without drawing a face, a mirror, or a body.
- A reader who skips still sees the field turned warm, which is what the text
  describes.

**Negative / costs**

- A fourth hand-drawn gesture in the Runtime, holding two small offscreen
  canvases and a coverage grid for the length of one beat.
- The neutral plate border is a per-kind exception to ADR-0007's look, kept
  so that the finished warmth is not competing with gold.

## Rollout

1. Contracts: `apply_cosmetics` in the gesture kinds with empty `params`,
   with schema tests.
2. Validator: the once-per-book rule and an `apply_cosmetics` bundle in the
   staging tests.
3. Runtime: the field, its glaze, the brush and coverage grid, the warm-in,
   Enter, skipping, and the reduced-motion single press.
4. Staging guide: when to use it and why it takes no parameters.
5. Pilot in 《生尸之死》: the morning at the mirror after the detective wakes.
