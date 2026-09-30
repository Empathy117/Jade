# ADR-0009: A letter instrument

**Status:** Accepted
**Date:** 2026-10-01
**Deciders:** Project owner

## Context

ADR-0006 added an instrument channel and ADR-0008 its second kind, `wind`.
The owner wants each book to have its own device, chosen from its own text,
so that no element wears thin by turning up in book after book. The taste
anchor stays Tsukiweb and Rusty Lake: quiet, tactile, procedural, no faces,
no text drawn inside the device.

《一个陌生女人的来信》 is almost entirely one letter. R. comes home, finds a
thick envelope with no sender, and reads twenty-odd pages written by a woman
he does not remember. The frame story is a few paragraphs at each end; the
rest is the letter itself. The letter keeps saying that its writer can hardly
go on: her hand is failing, she must stop, she begins again. What the picture
cannot show is the thing R. is holding, how much of it he has read, and the
moments where the writing itself falters.

The same need is rare elsewhere. As with the wind, the owner does not want
this kind reused by default: it belongs to the book whose text is a letter.

### Alternatives considered

- **A page counter.** Rejected. A number claims a precision the text never
  gives and turns reading into a progress bar. The device shows how much of
  the stack has been turned over, never how many pages.
- **Progress carried per key.** Rejected. Progress follows every paragraph,
  so keys would have to be dense and a Compiler would have to invent them.
  Reading position already says how far through the letter the reader is.
- **Drawing the letter's words.** Rejected. Instruments never render text,
  and the prose is already on screen.

## Decision

Add `letter` as the third kind in the instrument channel of `direction.json`
and `playback.json` v2. Everything in ADR-0006 applies unchanged: the
`visual_novel` profile only, ordered and disjoint spans, keys that hold until
the next key, page turns that move and jumps that land, dimming under a CG,
`aria-hidden`, and the same `placement` values.

### 1. Direction (intent)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "letter",
    "at": "p0009", "until": "p0031",
    "intent": "opening_the_letter",
    "extent": { "at": "p0012", "until": "p0480" },
    "states": [
      { "at": "p0009", "state": "sealed" },
      { "at": "p0012", "state": "reading" },
      { "at": "p0027", "state": "faltering" },
      { "at": "p0029", "state": "reading" }
    ]
  }
]
```

The `letter` states are:

- `sealed`: the envelope, thick and unopened.
- `reading`: the sheets in hand, fanned slightly, being read.
- `faltering`: the writing on the top sheet trembles and a blot of ink
  spreads. Only where the letter says its writer can hardly write.
- `set_down`: the stack squared and laid down.

Each is what the text says is happening to the letter, never more. Once a
letter has been opened it is never `sealed` again.

**`extent`** is optional and names the paragraphs the letter's own text runs
across, from its first line to its last. It is a fact about the source, so it
belongs to direction. When it is absent, the span itself is the extent. It
lets a book show the letter in several short spans (the opening, a passage
where the writing falters, the end) while the stack still shows how far
through the whole letter the reader is.

### 2. Playback (resolved)

```jsonc
"instruments": [
  {
    "id": "instrument_001",
    "kind": "letter",
    "at": "p0009", "until": "p0031",
    "placement": "auto",
    "extent": { "at": "p0012", "until": "p0480" },
    "keys": [
      { "at": "p0009", "state": "sealed" },
      { "at": "p0012", "state": "reading" },
      { "at": "p0027", "state": "faltering" },
      { "at": "p0029", "state": "reading" }
    ]
  }
]
```

A `letter` key carries only `at`, an optional `beat`, and `state`, which
repeats the directed state in force. `extent` repeats direction's.

### 3. How far through the letter

The share of the letter turned over is computed by the Runtime from reading
position; no key carries it.

- A reading point's ordinal is its paragraph position plus the share of that
  paragraph's reading beats already read, as for the camera (ADR-0004).
- The extent runs from the start of its `at` paragraph to the end of its
  `until` paragraph.
- `turned = clamp((ordinal − start) / (end − start), 0, 1)`.

The stack is drawn as ten sheets. `floor(turned × 10)` of them lie turned
over on the left pile; the rest wait on the right, the top one showing its
lines. Before the extent nothing is turned; on its last paragraph one sheet
is still in hand. A sheet therefore moves only every tenth of the letter,
which keeps the device still for long stretches.

On a page turn that crosses a sheet boundary, the top sheet lifts and slides
across to the other pile, one sheet after another if several; paging back
slides them back. A jump or resume lands with the piles already split.

### 4. Look

The same plate as the radio: dark, translucent, a hairline gold border, at
most a quarter of the viewport wide. Inside:

- **Paper.** Cream sheets with soft edges, each set at a small fixed angle so
  the piles fan slightly. No texture, no letterhead.
- **Lines.** The top sheet on the right carries a few rows of abstract
  blue-black strokes of uneven length, never glyphs. Turned sheets lie face
  down and blank.
- **`sealed`.** A plain envelope, its thickness shown by the edges of the
  sheets inside. No seal, no address, no stamp.
- **`faltering`.** The strokes on the top sheet tremble a little and one blot
  spreads over a couple of seconds, then holds.
- **`set_down`.** The sheets gathered into one squared stack, face down, and
  the whole plate dimmed.

The letter does not listen to the scene's sounds: paper does not answer
noise. Its only motion is a sheet changing piles and the tremor of
`faltering`.

### 5. Reduced motion

Sheets change piles at once, the strokes hold still, and a faltering blot is
shown at its full size.

### 6. Validator rules

ADR-0006's rules apply, including that each key repeats the directed state in
force (ADR-0008). In addition:

- The schemas close the `letter` state vocabulary, allow `extent` on `letter`
  spans only, and give `letter` keys no fields beyond `at`, `beat`, and
  `state`.
- `extent.until` is not before `extent.at`, and the extent overlaps its span.
- Playback mirrors direction's `extent`.
- Spans with the same extent show the same letter: across them, in reading
  order, no `sealed` state follows any other state.

## Consequences

**Positive**

- 《一个陌生女人的来信》 can show the letter R. holds, and where its writing
  breaks down, without art or licences and without dense keys.
- Progress through a long span costs the Director nothing: reading position
  already carries it.

**Negative / costs**

- The instrument reading gains a value derived from reading position rather
  than from keys, which the Runtime computes for this kind alone.
- A letter shown for a whole book would become wallpaper. The staging guide
  asks for a few short spans, with `extent` keeping the stack honest across
  them.

## Rollout

1. Contracts: `letter` in the instrument kind, its state vocabulary, `extent`,
   and a `letter` playback key, with schema tests.
2. Validator: a `letter` bundle in the staging tests, and the extent and
   resealing rules.
3. Runtime: the turned share in the instrument reading, and the `letter` face.
4. Staging guide: when to use it, and that `faltering` follows the text.
5. Pilot in 《一个陌生女人的来信》: the opening of the envelope, one passage
   where the writing falters, and R. setting the letter down.
