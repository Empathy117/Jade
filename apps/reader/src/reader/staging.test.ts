import { describe, expect, it } from "vitest";

import { paragraphIndex } from "./readerState";
import {
  atmosphereAt,
  cameraAt,
  cameraTransform,
  cgAt,
  gestureAt,
  gradeAt,
  IDENTITY_CAMERA,
  instrumentAt,
  layoutAt,
  letterTurned,
  momentAt,
  NO_ATMOSPHERE,
  oneShotsAt,
  trembleAt,
} from "./staging";
import type { InstrumentCue, PlaybackDocument, RadioKey, SourceDocument } from "./types";

// p0003 is long enough to split into several reading beats.
const longText = "这一句写得很长，".repeat(30) + "。";

const source: SourceDocument = {
  schema_version: 1,
  book_id: "fixture-book",
  revision: 1,
  title: "Fixture",
  language: "zh-CN",
  source: { format: "txt", path: "source.txt", sha256: "0".repeat(64) },
  paragraphs: [
    { id: "p0001", kind: "title", text: "Fixture" },
    { id: "p0002", kind: "prose", text: "一。" },
    { id: "p0003", kind: "prose", text: longText },
    { id: "p0004", kind: "prose", text: "三。" },
    { id: "p0005", kind: "prose", text: "四。" },
    { id: "p0006", kind: "prose", text: "五。" },
  ],
};
const positions = paragraphIndex(source);

const night = { tint: "#1d2433", shade: 0.5, saturation: 0.7, duration_ms: 1600 };
const dawn = { tint: "#f3e6d0", shade: 0.2, saturation: 0.9, duration_ms: 900 };

const playback: PlaybackDocument = {
  schema_version: 2,
  book_id: "fixture-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  asset_catalog_id: "fixture",
  cues: [
    {
      at: "p0002",
      scene_id: "scene_001",
      background: { asset_id: "bg_a", transition: "crossfade", duration_ms: 1000 },
      grade: night,
    },
    {
      at: "p0005",
      scene_id: "scene_002",
      background: { asset_id: "bg_b", transition: "crossfade", duration_ms: 1000 },
    },
  ],
  camera: [
    { at: "p0002", scale: 1.0, x: 0, y: 0, drift: 0.01 },
    { at: "p0004", scale: 1.4, x: 0.5, y: -0.5 },
    { at: "p0006", scale: 1.2, x: 0, y: 0 },
  ],
  moments: [
    { id: "moment_001", at: "p0003", beat: 1, template: "isolate_line", params: { dim: 0.7 } },
    {
      id: "moment_002",
      at: "p0004",
      template: "grade_shift",
      params: { grade: dawn },
    },
  ],
};

describe("cameraAt", () => {
  it("holds the first key at its anchor and interpolates by reading position", () => {
    expect(cameraAt(source, positions, playback, { index: 1, beat: 0 })).toMatchObject({
      scale: 1,
      drift: 0.01,
    });
    const mid = cameraAt(source, positions, playback, { index: 2, beat: 0 });
    expect(mid.scale).toBeCloseTo(1.2);
    expect(mid.x).toBeCloseTo(0.25);
    // The idle drift belongs to the key being held.
    expect(mid.drift).toBe(0.01);
  });

  it("advances within a paragraph beat by beat", () => {
    const first = cameraAt(source, positions, playback, { index: 2, beat: 0 });
    const second = cameraAt(source, positions, playback, { index: 2, beat: 1 });
    expect(second.scale).toBeGreaterThan(first.scale);
    expect(second.scale).toBeLessThan(1.4);
  });

  it("never interpolates across a background change", () => {
    // p0004 is the last key on bg_a; it holds until the background changes.
    expect(cameraAt(source, positions, playback, { index: 3, beat: 0 }).scale).toBeCloseTo(1.4);
    // bg_b starts from the identity framing, then eases toward its own key.
    expect(cameraAt(source, positions, playback, { index: 4, beat: 0 })).toEqual(IDENTITY_CAMERA);
    expect(cameraAt(source, positions, playback, { index: 5, beat: 0 }).scale).toBeCloseTo(1.2);
  });

  it("is the identity without camera keys", () => {
    const v1 = { ...playback, camera: undefined };
    expect(cameraAt(source, positions, v1, { index: 3, beat: 0 })).toEqual(IDENTITY_CAMERA);
  });
});

describe("cameraTransform", () => {
  it("bounds translation by the slack the scale leaves", () => {
    expect(cameraTransform({ ...IDENTITY_CAMERA, scale: 1.4, x: 1, y: -1 })).toBe(
      "translate(-20%, 20%) scale(1.4)",
    );
    expect(cameraTransform(IDENTITY_CAMERA)).toBe("translate(0%, 0%) scale(1)");
  });
});

describe("gradeAt", () => {
  it("follows cue grades and grade shifts in reading order", () => {
    expect(gradeAt(positions, playback, { index: 1, beat: 0 })).toBe(night);
    expect(gradeAt(positions, playback, { index: 3, beat: 0 })).toBe(dawn);
    // A later cue without a grade leaves the shifted grade in force.
    expect(gradeAt(positions, playback, { index: 5, beat: 0 })).toBe(dawn);
  });
});

describe("momentAt", () => {
  it("matches the exact paragraph and beat", () => {
    expect(momentAt(positions, playback, { index: 2, beat: 0 })).toBeNull();
    expect(momentAt(positions, playback, { index: 2, beat: 1 })?.id).toBe("moment_001");
  });
});

describe("visual-novel channels", () => {
  const dust = { particles: "dust" as const, density: 0.5, flicker: 0.3 };
  const vn: PlaybackDocument = {
    ...playback,
    cues: [
      { ...playback.cues[0], layout: "adv", atmosphere: dust },
      { ...playback.cues[1], layout: "nvl", atmosphere: NO_ATMOSPHERE },
    ],
    cgs: [
      {
        id: "cg_001",
        at: "p0003",
        beat: 1,
        until: "p0004",
        asset_id: "cg_a",
        transition: "iris",
        duration_ms: 1200,
      },
    ],
    sounds: [{ id: "sound_001", at: "p0004", asset_id: "sfx_a", gain: 0.8 }],
    effects: [
      { at: "p0004", type: "shake", intensity: 0.6 },
      { at: "p0004", type: "tremble", intensity: 0.8 },
    ],
  };

  it("holds layout and atmosphere until a cue changes them", () => {
    expect(layoutAt(positions, vn, { index: 3, beat: 0 })).toBe("adv");
    expect(atmosphereAt(positions, vn, { index: 3, beat: 0 })).toBe(dust);
    expect(layoutAt(positions, vn, { index: 4, beat: 0 })).toBe("nvl");
    expect(layoutAt(positions, playback, { index: 3, beat: 0 })).toBe("nvl");
  });

  it("shows event art over its inclusive span", () => {
    expect(cgAt(positions, vn, { index: 2, beat: 0 })).toBeNull();
    expect(cgAt(positions, vn, { index: 2, beat: 1 })?.id).toBe("cg_001");
    expect(cgAt(positions, vn, { index: 3, beat: 0 })?.id).toBe("cg_001");
    expect(cgAt(positions, vn, { index: 4, beat: 0 })).toBeNull();
  });

  it("separates one-shot events from the tremble state", () => {
    const shots = oneShotsAt(positions, vn, { index: 3, beat: 0 });
    expect(shots.sounds.map((sound) => sound.id)).toEqual(["sound_001"]);
    expect(shots.effects.map((effect) => effect.type)).toEqual(["shake"]);
    expect(trembleAt(positions, vn, { index: 3, beat: 0 })).toBe(0.8);
    expect(trembleAt(positions, vn, { index: 2, beat: 0 })).toBe(0);
  });
});

describe("instrumentAt", () => {
  const radio: PlaybackDocument = {
    ...playback,
    instruments: [
      {
        id: "instrument_001",
        kind: "radio",
        at: "p0003",
        until: "p0005",
        placement: "auto",
        keys: [
          { at: "p0003", beat: 1, state: "listening", frequency: "14.195", signal: 0.05, noise: 0.6, tx: false },
          { at: "p0004", state: "contact", frequency: "14.255", signal: 0.6, noise: 0.3, tx: false, tuning: true },
        ],
      },
    ],
  };

  it("is absent outside the span", () => {
    expect(instrumentAt(source, positions, radio, { index: 1, beat: 0 })).toBeNull();
    expect(instrumentAt(source, positions, radio, { index: 5, beat: 0 })).toBeNull();
  });

  it("shows the first key from the start of the span", () => {
    const reading = instrumentAt(source, positions, radio, { index: 2, beat: 0 });
    expect(reading?.key.state).toBe("listening");
    expect(reading?.previous).toBeNull();
  });

  it("holds the latest key and remembers the one before", () => {
    const reading = instrumentAt(source, positions, radio, { index: 4, beat: 0 });
    expect((reading?.key as RadioKey).frequency).toBe("14.255");
    expect((reading?.previous as RadioKey).frequency).toBe("14.195");
    expect(reading?.progress).toBeNull();
  });
});

describe("letterTurned", () => {
  const letter: InstrumentCue = {
    id: "instrument_001",
    kind: "letter",
    at: "p0002",
    until: "p0006",
    placement: "auto",
    extent: { at: "p0003", until: "p0005" },
    keys: [
      { at: "p0002", state: "sealed" },
      { at: "p0003", state: "reading" },
    ],
  };

  it("runs through the extent from its first paragraph to the end of its last", () => {
    expect(letterTurned(source, positions, letter, { index: 1, beat: 0 })).toBe(0);
    expect(letterTurned(source, positions, letter, { index: 2, beat: 0 })).toBe(0);
    expect(letterTurned(source, positions, letter, { index: 3, beat: 0 })).toBeCloseTo(1 / 3);
    expect(letterTurned(source, positions, letter, { index: 4, beat: 0 })).toBeCloseTo(2 / 3);
    expect(letterTurned(source, positions, letter, { index: 5, beat: 0 })).toBe(1);
  });

  it("follows reading beats inside a long paragraph", () => {
    const partway = letterTurned(source, positions, letter, { index: 2, beat: 1 });
    expect(partway).toBeGreaterThan(0);
    expect(partway).toBeLessThan(1 / 3);
  });

  it("uses the span when no extent is given", () => {
    const { extent: _extent, ...spanOnly } = letter as Extract<InstrumentCue, { kind: "letter" }>;
    expect(letterTurned(source, positions, spanOnly, { index: 3, beat: 0 })).toBeCloseTo(2 / 5);
  });

  it("is carried in the instrument reading for a letter only", () => {
    const withLetter: PlaybackDocument = { ...playback, instruments: [letter] };
    const reading = instrumentAt(source, positions, withLetter, { index: 4, beat: 0 });
    expect(reading?.key.state).toBe("reading");
    expect(reading?.progress).toBeCloseTo(2 / 3);
  });
});

describe("gestureAt", () => {
  const withGesture: PlaybackDocument = {
    ...playback,
    gestures: [
      {
        id: "gesture_001",
        kind: "grind_ink",
        at: "p0003",
        beat: 2,
        placement: "auto",
        params: { direction: "ccw", tone: "pale" },
      },
    ],
  };

  it("matches only the exact paragraph and beat", () => {
    expect(gestureAt(positions, withGesture, { index: 2, beat: 1 })).toBeNull();
    expect(gestureAt(positions, withGesture, { index: 2, beat: 2 })?.id).toBe("gesture_001");
    expect(gestureAt(positions, playback, { index: 2, beat: 2 })).toBeNull();
  });
});
