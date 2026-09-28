# ADR-0004: Reading-driven camera, shots, and key moments

**Status:** Accepted
**Date:** 2026-09-28
**Deciders:** Project owner

## Context

The Director currently speaks in scenes. Each scene resolves to one background
held for its whole span, and `playback.json` offers only `cut` or `crossfade`
between scenes. `BackgroundStage` renders two stacked layers. The result is
calm but static: a climax and a passage of exposition look identical, and the
only visual event a reader ever sees is a background swap.

Visual novels feel directed not because they animate constantly but because
the frame responds to the prose: a slow push-in while tension builds, a held
wide shot after a revelation, a moment of silence before a line lands. The
Reader already advances in discrete reading beats (`readingBeats.ts`), which is
the same driver a visual novel's click-to-advance provides. What is missing is
a contract that lets the Director describe framing below scene granularity and
mark a small number of designed set pieces.

Constraints carried over from existing contracts and the production protocol:

- Direction references paragraph IDs only and never copies source prose.
- Background, music, and ambience remain independent channels.
- Stable, restrained presentation is preferred over frequent change.
- The Reader Runtime must not depend on who authored the direction (Agent now,
  unattended Director/Matcher/Compiler later).
- No presentation may reveal information before its source anchor.

## Decision

Introduce two new semantic layers in `direction.json` v2 and their resolved
counterparts in `playback.json` v2. The camera is driven by **reading
position**, not wall-clock time.

### 1. Shots (camera within a scene)

A scene may contain an ordered list of shots. Each shot declares *intent*; the
Compiler resolves intent to numbers against the chosen asset's metadata.

```jsonc
// direction.json v2 — inside a scene
"shots": [
  { "at": "p0412",          "framing": "wide",   "move": "drift" },
  { "at": "p0418",          "framing": "medium", "move": "push_in",
    "focus": "window" },
  { "at": "p0421", "beat": 2, "framing": "close", "move": "hold",
    "focus": "window" }
]
```

| Field     | Values | Notes |
|-----------|--------|-------|
| `at`      | paragraph ID | must lie within the scene span |
| `beat`    | integer ≥ 0, optional | reading-beat index within that paragraph |
| `framing` | `wide` `medium` `close` `detail` | relative crop, not pixels |
| `move`    | `hold` `drift` `push_in` `pull_out` `pan_left` `pan_right` `rack_focus` | motion *across* the shot's span |
| `focus`   | tag, optional | must name a `focal_points` entry on the resolved asset |

A scene without `shots` behaves as one implicit `{ framing: "wide", move:
"hold" }` shot, which is exactly v1 behaviour.

### 2. Moments (designed set pieces)

Moments mark narrative peaks. They are chosen from a closed vocabulary of named
templates rather than free keyframes, so design quality lives in the Runtime
and stays consistent across books.

```jsonc
// direction.json v2 — top level
"moments": [
  { "id": "moment_001", "at": "p0433", "template": "isolate_line",
    "intent": "revelation" },
  { "id": "moment_002", "at": "p0610", "beat": 1, "template": "silence",
    "intent": "loss", "hold_ms": 1800 }
]
```

Initial templates:

| Template        | Effect | Channels touched |
|-----------------|--------|------------------|
| `letterbox_hold`| bars close in, page advance is briefly held | frame, pacing |
| `isolate_line`  | background dims and blurs, current beat stands alone | frame, grade |
| `silence`       | music ducks to zero, ambience remains | music |
| `grade_shift`   | colour grade moves to another palette step and stays | grade |
| `flash_cut`     | single white or black frame, then cut | frame |
| `slow_reveal`   | begins at `detail`, pulls to `wide` over following beats | camera |

`intent` is a free tag (`revelation`, `loss`, `threat`, `reunion` …) used by the
Compiler to tune parameters and by reviewers to audit choices. It must not
name ending-level information.

### 3. Grade tokens

A book may define a small grade palette; scenes reference it by name.

```jsonc
"grades": {
  "dawn":   { "tint": "#f3e6d0", "shade": 0.28, "saturation": 0.9 },
  "night":  { "tint": "#1d2433", "shade": 0.52, "saturation": 0.7 },
  "memory": { "tint": "#e8dcc8", "shade": 0.35, "saturation": 0.45 }
}
// scene: "grade": "night"
```

This replaces the single global `background-shade` with per-scene values
exposed as CSS custom properties. At most five grades per book.

### 4. Asset metadata (`assets.json`)

Background assets gain optional fields the Compiler requires once a shot uses
anything beyond `wide/hold`:

```jsonc
"focal_points": { "window": [0.62, 0.30, 0.18, 0.22] },   // x, y, w, h (0–1)
"text_safe_area": [0.08, 0.35, 0.84, 0.55],
"min_scale_headroom": 1.6
```

`close` and `detail` framing are rejected at compile time for assets without
enough resolution headroom.

### 5. Resolved playback (`playback.json` v2)

The Compiler emits numeric keyframes keyed by reading position; the Runtime
never sees intent words.

```jsonc
"camera": [
  { "at": "p0412", "beat": 0, "scale": 1.00, "x": 0.00, "y": 0.00, "blur": 0 },
  { "at": "p0418", "beat": 0, "scale": 1.18, "x": 0.06, "y": -0.04, "blur": 0 },
  { "at": "p0421", "beat": 2, "scale": 1.45, "x": 0.11, "y": -0.07, "blur": 0 }
],
"moments": [
  { "id": "moment_001", "at": "p0433", "beat": 0, "template": "isolate_line",
    "params": { "dim": 0.72, "blur_px": 14, "in_ms": 900, "out_ms": 1400 } }
]
```

### 6. Runtime

`BackgroundStage` becomes `Stage` with ordered layers:

```text
plate → (parallax, later) → grade → vignette / letterbox → reading surface
```

- Camera state is interpolated from the current `(paragraph, beat)` between
  neighbouring keyframes, applied with `transform` only (GPU-friendly).
  Paging backwards rewinds the camera; jumping (search, contents, bookmark)
  settles directly to the target state without replaying motion.
- Motion between beats eases over a fixed, slow curve; within a `drift` or
  `hold` shot a very slow idle drift may run on time but never exceeds 2 %
  scale change.
- Moments fire once per forward arrival at their anchor within a session and
  are always skippable by the next advance input; pacing holds never block
  input longer than `hold_ms` (max 2500 ms).
- `reducedMotion`: camera resolves to each shot's static end framing with
  crossfades; moments reduce to their grade/audio component only.
- Camera never moves the reading surface and never pushes a focal point into
  `text_safe_area`.

### 7. Restraint rules (validator-enforced)

- ≤ 2 moments per chapter; ≥ 40 paragraphs between moments.
- ≤ 1 shot change per 3 paragraphs on average within a scene.
- `flash_cut` ≤ 1 per book unless the protocol records a justification.
- Every moment and non-default shot must appear in the production notes with a
  one-line rationale (human-judgment log, for later automation).

## Consequences

**Positive**

- Climaxes get visual weight without adding assets; the same background can
  carry a whole scene's arc.
- Design quality is centralised in a small template set, so the Agent chooses
  *what* and *where*, not *how it looks*.
- v1 bundles stay valid and render unchanged.

**Negative / costs**

- Existing backgrounds need `focal_points` and often higher resolution before
  close framing is allowed.
- The Compiler grows a resolution step and new validation.
- Moments increase the surface for spoilers; review must check anchor timing.

## Rollout

1. Schemas v2 for `direction` and `playback`; validator accepts v1 and v2. The
   framing metadata on `assets` is optional and additive, so `assets` stays v1.
2. Runtime `Stage` with camera interpolation and grade tokens; reduced-motion path.
3. Moment templates `isolate_line`, `letterbox_hold`, `silence`.
4. Pilot on one chapter of a public-domain book; run the experience gate.
5. Update `agent-book-production-protocol.md` with shot/moment selection
   guidance; add remaining templates and parallax only if the pilot justifies it.

## Resolved questions

- **Beat anchors:** allowed. `beat` is optional on shots and moments; paragraph
  granularity remains the default.
- **Idle drift:** allowed only inside `drift` shots, capped at 2 % scale change,
  and paused while the reader is not on the page.
- **Reader chrome:** `letterbox_hold` and `isolate_line` may fade the toolbar
  and progress indicators for their duration; any input restores them at once.
- **Grade tokens:** live in `direction.json` (`grades`), since they are
  direction choices per book rather than Reader theming.
