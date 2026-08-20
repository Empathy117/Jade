# Repository Instructions

## Immersive book production

When the user asks to “把这本 TXT / EPUB 制作为沉浸阅读版本”, or makes an
equivalent request to turn a TXT or EPUB book into a Reader book, follow
[`docs/agent-book-production-protocol.md`](docs/agent-book-production-protocol.md)
from preflight through library registration and validation.

Non-negotiable rules:

- Preserve the input TXT or EPUB bytes and let the importer create paragraph IDs.
- Never copy or rewrite source prose in `direction.json`, `assets.json`, or
  `playback.json`; reference paragraph IDs only.
- Treat background, music, and ambience as independent channels.
- Prefer stable, restrained presentation over frequent asset changes.
- Record a license, source, and attribution decision for every asset.
- Validate the complete bundle and `books/library.json` before handoff.
- Record steps that still required human judgment so repeated work can later be
  considered for automation.
- Keep Git commits atomic; do not combine book assets, runtime changes, and
  unrelated documentation in one commit.

The current production implementation is an Agent. Future unattended Director,
Matcher, and Compiler components must produce the same versioned contracts so
that the Reader Runtime remains unchanged.
