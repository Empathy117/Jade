# AI Director + Reader Runtime

An experimental reader where the source book controls what is said and the
director layer controls only how it is presented.

The project has completed Phase 3: a hand-directed, end-to-end reading demo
with immutable source text, scene-aware backgrounds, BGM and ambience,
progress restoration, and accessible reading controls. AI integration and EPUB
import are intentionally deferred until the experience review is complete.

## Development

Prerequisites:

- Nix with flakes enabled
- direnv with its shell hook installed

Enter the development environment:

```sh
direnv allow
just versions
```

Run all current checks:

```sh
just check
```

Validate the hand-directed demo bundle:

```sh
just validate books/restaurant-demo
```

Start the Reader:

```sh
just dev
```

Then open [http://localhost:5173](http://localhost:5173). The page cannot be
run directly with `file://` because browsers block its JSON and audio requests.

Current demo controls:

- click the reading area, press Space, or press Right Arrow to advance;
- press Left Arrow or use the footer buttons to move backward;
- press Up Arrow or use the `↑` button to review and jump to any previously
  read paragraph without losing the furthest reading position;
- use `Aa` for font size, audio, reduced motion, and pure reading mode;
- progress and settings are stored locally in the browser.

See [the implementation plan](docs/implementation-plan.md) for architecture,
phase boundaries, and acceptance criteria.
