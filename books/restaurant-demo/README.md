# Restaurant Demo

This is the hand-authored Phase 3 bundle for 《要求特别多的餐厅》.

- `source.txt` is the frozen source file.
- `source.json` is mechanically numbered by `scripts/build_demo_source.py`.
- `direction.json` and `playback.json` are manually authored.
- Six backgrounds were generated with the built-in OpenAI image generation
  tool on 2026-08-19 using a consistent cinematic Japanese literary
  illustration brief. The generation cache originals are not runtime inputs.
- Three curated CC0 music tracks provide the score. Two procedural ambience
  tracks are generated locally by `scripts/generate_demo_audio.sh`.

Validate the complete bundle from the project root:

```sh
just validate books/restaurant-demo
```
