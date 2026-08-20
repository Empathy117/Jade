# AI Director + Reader Runtime

An experimental reader where the source book controls what is said and the
director layer controls only how it is presented.

The project has completed its single-user experience review and entered Phase
5. It now provides a multi-book private library, immutable source text,
scene-aware backgrounds, real BGM and ambience, progress restoration, and
accessible reading controls. Books are currently produced by an Agent through
stable data contracts; unattended Director, Matcher, and Compiler components
can replace the Agent later without changing the Reader Runtime.

## Make an immersive book

In this repository, give the Agent a TXT or EPUB and say:

> 把这本 TXT / EPUB 制作为沉浸阅读版本。

The repository instructions route that request through the complete
[Agent book-production protocol](docs/agent-book-production-protocol.md):
immutable import, scene direction, asset generation or acquisition, audio
processing, playback authoring, validation, library registration, and a record
of remaining human judgment.

The architectural boundary and future automation path are recorded in
[ADR-0001](docs/adr/0001-agent-assisted-book-production.md).

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

Import a TXT book into an immutable source bundle:

```sh
just import-txt path/to/novel.txt books/my-novel my-novel
```

The original TXT bytes are preserved and hashed; `source.json` contains only a
decoded, paragraph-addressable representation for later directing.

Validate the complete library and every registered bundle:

```sh
just validate-library
```

Validate one book bundle:

```sh
just validate books/restaurant-demo
```

Start the Reader:

```sh
just dev
```

Then open [http://localhost:5173](http://localhost:5173). The page cannot be
run directly with `file://` because browsers block its JSON and audio requests.

Current Reader controls:

- click the reading area, press Space, or press Right Arrow to advance;
- press Left Arrow or use the footer buttons to move backward;
- press Up Arrow or use the `↑` button to review and jump to any previously
  read paragraph without losing the furthest reading position;
- use `Aa` for font size, audio, reduced motion, and pure reading mode;
- progress and settings are stored locally in the browser.

The opening screen lists every entry in `books/library.json`; each book keeps
its own progress. A book can also be opened directly with
`?book=<registered-path>`.

See [the implementation plan](docs/implementation-plan.md) for phase boundaries
and acceptance criteria. Phase 4 observations use the
[experience gate](docs/experience-gate.md) and its linked session template.
