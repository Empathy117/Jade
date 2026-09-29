# ADR-0007: Gesture beats, starting with grinding ink and pressing a seal

**Status:** Accepted
**Date:** 2026-09-29
**Deciders:** Project owner

## Context

Everything the Reader stages today happens to the reader: a page turn arrives
and the camera moves, a sound plays, a CG fades in. The owner asked for "a
little simple interactivity" while planning the visual-novel slice of
《山茶文具店》.

That book shows why interaction is worth considering. Its drama lives in the
physical making of letters. The heroine grinds ink, and the text says how:
which way to turn the ink stick, when to stop, how pale the ink must stay.
She seals an envelope in the morning and posts it. These are small, concrete
acts with a clear end. A reader who makes the same motion once, at the moment
the text describes it, feels the scene in the hands rather than only watching
it.

The same need recurs in other books: folding a letter, striking a match,
winding a watch, ringing a shop bell. In each, the text describes one short
physical act.

Constraints carried over from earlier ADRs and the owner's taste:

- The Reader is a reader, not a game. Interaction must never block reading,
  change the text, branch the story, or score the reader.
- Staging follows reading position, and one-shot staging fires only on a
  forward page turn (ADR-0004, ADR-0005).
- No character sprites. Objects, sound, and light carry the atmosphere
  (ADR-0005, ADR-0006).
- The Runtime plays versioned contracts and never knows about particular
  books.
- Direction never copies source prose.

### Alternatives considered

- **Choices or branching.** Rejected. The source text is fixed, and a choice
  whose outcome is always the same text is a lie.
- **Free-form hotspots on backgrounds** (click the teapot, and so on).
  Rejected. They ask the reader to hunt, pull attention away from the text,
  and need hand-authored hit areas on every painted plate.
- **A book-specific mini-game.** Rejected for the same reason ADR-0006
  rejected a book-specific widget.
- **Doing nothing and relying on sound.** This remains the default for most
  books. Gesture beats are an opt-in accent, like moments.

## Decision

Add a **gesture channel** to `direction.json` and `playback.json` v2. It is
available only in the `visual_novel` profile. A gesture beat is a small,
procedural 2D object (SVG and Canvas, no image assets) that appears when a
forward page turn arrives on its anchor and invites one simple motion. The
reader may make the motion or simply turn the page; either way the story goes
on unchanged.

The channel starts with two kinds. Each kind pairs one gesture with one
object, so the Runtime owns the drawing and every book gets the same quality:

| Kind | Gesture | Object drawn | Completes when |
|---|---|---|---|
| `grind_ink` | drag in circles on the stone | an inkstone seen from above, water in the well darkening as it is ground | the ink reaches its target tone |
| `press_seal` | one press | an envelope flap and a seal; the impression stays | the seal is pressed |

### 1. Direction (intent)

```jsonc
"gestures": [
  { "id": "gesture_001", "kind": "grind_ink", "at": "p0229", "intent": "mourning_ink" },
  { "id": "gesture_002", "kind": "press_seal", "at": "p0241", "intent": "sending_off" }
]
```

`intent` is a free tag for reviewers, like a moment's. It must not name
ending-level information.

### 2. Playback (resolved)

```jsonc
"gestures": [
  {
    "id": "gesture_001", "kind": "grind_ink", "at": "p0229",
    "placement": "auto",
    "params": { "direction": "ccw", "tone": "pale" }
  },
  {
    "id": "gesture_002", "kind": "press_seal", "at": "p0241",
    "placement": "auto",
    "params": {},
    "sound": { "asset_id": "sfx_seal_press", "gain": 0.4 }
  }
]
```

- **`grind_ink.params.direction`** is `cw`, `ccw`, or omitted. It sets only the
  hint arrow drawn around the stone. It must be the direction the text states;
  when the text states none, it is omitted and no arrow is drawn. Turning the
  other way still grinds. There is no wrong answer and no failure state.
- **`grind_ink.params.tone`** is `pale`, `normal`, or `deep`: how dark the ink
  gets when grinding completes. It must follow the text; `normal` is the
  default.
- **`press_seal`** takes no parameters. The impression is an abstract
  vermilion mark with no legible glyph, because gestures never render text.
- **`sound`** optionally names a `sfx` asset and its gain. It plays once on
  completion, on the sound-effect bus.
- **`placement`** is `auto` (centred above the adv text box; lower third in
  nvl), `center`, or `above_text`.

### 3. Lifecycle

1. **Arrival.** The gesture appears only when a forward page turn lands on its
   anchor, once per session, exactly like a moment. Jumping, resuming, or
   paging back onto the anchor does not show it.
2. **Invitation.** The object fades in with a one-line hint in interface text
   ("转动墨条" / "按下封印"). Nothing else on the page changes.
3. **Doing.** Pointer input inside the object's plate drives it: accumulated
   drag angle grinds, and a press seals. Input outside the plate behaves as
   usual, so clicking the text still turns the page.
4. **Completion.** The object settles into its finished state (ink at tone,
   impression pressed), plays its sound if any, and stays until the next page
   turn.
5. **Skipping.** A page turn at any point ends the gesture. The object shows
   its finished state briefly as it fades out, so skipping still closes the
   act the text describes. A page turn is never consumed or blocked.

### 4. Input and accessibility

- The plate is a focusable control with an accessible name ("磨墨，可跳过").
  **Enter** completes it at once. Space and the arrow keys keep their reading
  meanings, so keyboard reading is unchanged.
- The plate captures its own pointer and touch events so a circular drag
  never turns into a swipe or a text selection.
- The touch target is at least 160 px across on phones.
- **Reduced motion:** `grind_ink` becomes a single press that fills the well
  statically. There is no swirl animation.
- **Pure mode:** gestures are not shown.
- **Muted audio:** gestures work; only the completion sound is silent.

### 5. Look

Restrained and flat, matching the instrument: a dark translucent plate with a
hairline border in the Reader's gold. The inkstone is a soft grey ellipse. The
ink is a single fill whose opacity follows grinding, with a faint radial swirl
along the pointer's path. The seal is a vermilion mark that lands with a small
press-in. There is no skeuomorphic texture and no brand marks. While a CG is on
screen, no gesture may be anchored (see validator rules), so the two never
compete.

### 6. Validator rules

- Gestures require `profile: "visual_novel"`.
- Each gesture lies inside a scene, and playback mirrors direction by `id`,
  `kind`, and anchor.
- `kind` and `params` belong to the closed vocabulary above.
- There is at most one gesture per reading beat, none on a beat that also
  carries a moment, and none inside a CG span.
- Gestures are spaced at least as far apart as the profile's moments
  (8 paragraphs in `visual_novel`), so one scene can hold a pair such as
  grinding at night and sealing the next morning, but not a string of them.
- `sound.asset_id`, when present, names an `sfx` asset.

## Consequences

**Positive**

- The reader can take part in the physical act a scene is about, without
  sprites, choices, or new art.
- Skipping is free, so a reader who wants only the text loses nothing.
- The vocabulary grows by kinds: `fold_letter`, `strike_match`, `wind_watch`,
  and `ring_bell` could follow, each with its own drawing.

**Negative / costs**

- This is the first input the Reader accepts besides navigation. Pointer
  capture must not leak into page turning, selection, or swipe handling, and
  that needs tests.
- Another overlay competes with the text. The restraint rules (moment
  spacing, no CG overlap, visual-novel profile only) exist to keep it rare.
- Each new kind needs its own drawing and parameters, which means a Runtime
  change and an amendment to this ADR.

## Rollout

1. Extend the schemas (gestures in direction and playback v2) and the
   validator, with tests.
2. Build the Runtime `Gesture` overlay: arrival and one-shot rules shared with
   moments, pointer capture, Enter to complete, skip on page turn, reduced
   motion and pure mode.
3. Add gesture guidance to `docs/visual-novel-staging-guide.md`: when a
   gesture earns its place, and the rule that parameters come from the text.
4. Pilot on the first commission night of 《山茶文具店》 (grind the ink, then
   press the seal the next morning), and let the owner read it.

## Resolved questions

- **Grinding sound:** no looping sound while the pointer moves. The
  completion sound is enough for the pilot, and a loop would compete with the
  score.
- **Hint line:** it shows until the reader completes one gesture of that kind
  in the session, and is hidden after that, so the second one is recognised
  without being explained.
