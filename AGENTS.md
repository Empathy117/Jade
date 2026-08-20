# Repository Instructions

## Immersive book production

When the user asks to “把这本 TXT / EPUB 制作为沉浸阅读版本”, or makes an
equivalent request to turn a TXT or EPUB book into a Reader book, follow
[`docs/agent-book-production-protocol.md`](docs/agent-book-production-protocol.md)
from preflight through library registration and validation.

Non-negotiable rules:

- Preserve the input TXT or EPUB bytes and let the importer create paragraph IDs.
- Treat extracted EPUB illustrations as immutable source content: inspect every
  extracted image, keep it anchored inline, and never repurpose it as a
  Director background.
- Use optional `guide.json` only for book-specific reading aids: a preferred
  narrative start and a curated subset of recurring reference diagrams. Do not
  put every decorative image in the gallery, and do not expose a reference
  before its source anchor has been reached.
- Preserve front matter even when `guide.json.start_at` skips it by default;
  never delete copyright, contents, cast, maps, or other source material merely
  to improve the opening experience.
- Never copy or rewrite source prose in `direction.json`, `assets.json`, or
  `playback.json`; reference paragraph IDs only.
- Treat background, music, and ambience as independent channels.
- Prefer stable, restrained presentation over frequent asset changes.
- Record a license, source, and attribution decision for every asset.
- Validate the complete bundle and `books/library.json` before handoff.
- In the real Reader, verify preferred/beginning start choices, inline source
  images, gallery unlock order, zoom, and return-to-source behavior whenever a
  guide or source illustrations are present.
- Record steps that still required human judgment so repeated work can later be
  considered for automation.
- Keep Git commits atomic; do not combine book assets, runtime changes, and
  unrelated documentation in one commit.

The current production implementation is an Agent. Future unattended Director,
Matcher, and Compiler components must produce the same versioned contracts so
that the Reader Runtime remains unchanged.
