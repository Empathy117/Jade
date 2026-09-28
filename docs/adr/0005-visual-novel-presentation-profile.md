# ADR-0005: A visual-novel presentation profile

**Status:** Accepted
**Date:** 2026-09-28
**Deciders:** Project owner

## Context

ADR-0004 gave the Reader a camera, colour grades, and a handful of key
moments under a strict restraint budget. The first pilot (要求特别多的餐厅)
worked, but the owner found it far from what a visual novel delivers.

The gap is structural rather than a missing effect:

- **Layout.** The Reader lays full-screen prose over a darkened plate, so
  backgrounds are commissioned to recede. Visual novels mostly put a text box
  at the bottom and let the picture lead.
- **Density.** A visual novel script carries a presentation command every one
  to three lines. The pilot changes the picture on roughly one reading beat in
  ten.
- **Asset kinds.** Visual novels layer background variants, event art (CG),
  one-shot sound effects, screen effects, and text effects. The Reader has one
  plate per scene and continuous ambience.

The owner chose to pursue visual-novel density for books that want it, while
keeping the restrained immersive reading mode as the default. Character
sprites are explicitly out of scope for now.

## Decision

Add a per-book **presentation profile** to `direction.json` v2:

- `immersive` (default): everything in ADR-0004 and its restraint budget,
  unchanged. Visual-novel features are rejected by the validator.
- `visual_novel`: unlocks the features below and a wider budget.

Features unlocked by `visual_novel`, all anchored to paragraph IDs and reading
beats and never copying source prose:

1. **Layout per scene.** `nvl` keeps full-screen prose; `adv` shows only the
   current beat in a bottom text box over an undimmed stage, typed out
   progressively. The first turn during typing completes the line.
2. **Event art (CG).** Anchored spans that take over the stage, entering with a
   crossfade, iris, or wipe. CGs are Director-layer assets, never source
   illustrations.
3. **Sound effects.** One-shot sounds that play on forward arrival at a beat.
4. **Screen and text effects.** `shake` and `pulse` fire once on forward
   arrival; `tremble` shakes the current line while it is on screen.
5. **Atmosphere per scene.** Procedural particles and light flicker.
6. **Transitions.** `iris` and `wipe` join `cut` and `crossfade` for
   backgrounds and CGs.

One-shot effects follow the moment rule of ADR-0004: they fire once per
session on a forward page turn, never on jumps, resumes, or paging back.
Reduced motion drops shake, tremble, particles, flicker, iris/wipe, and
typing; sound, CGs, and layout remain.

Budget for `visual_novel`: at most 6 key moments per chapter at least 8
paragraphs apart, at most 3 `flash_cut` per book, at most one shot per two
paragraphs, at most 2 sounds and one effect of each type per reading beat.

## Consequences

- Books opt in; nothing changes for existing immersive books.
- Production cost rises sharply: CGs need commissioned art and each scene
  needs beat-level direction. The first slice is one scene (钥匙孔, p0113–
  p0136) so the cost and payoff can be judged before scaling.
- Sprites, speaker attribution, and name plates remain future work.
