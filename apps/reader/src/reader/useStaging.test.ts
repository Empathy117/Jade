import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { paragraphIndex } from "./readerState";
import type { ReadingPoint } from "./staging";
import type { BookBundle, PlaybackDocument, SourceDocument } from "./types";
import { useStaging, type ReadingStep } from "./useStaging";

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
    { id: "p0003", kind: "prose", text: "二。" },
    { id: "p0004", kind: "prose", text: "三。" },
  ],
};
const playback: PlaybackDocument = {
  schema_version: 2,
  book_id: "fixture-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  asset_catalog_id: "fixture",
  cues: [{ at: "p0002", scene_id: "scene_001", clear_text: true }],
  gestures: [
    { id: "gesture_001", kind: "press_seal", at: "p0003", placement: "auto", params: {} },
  ],
};
const bundle = { source, playback } as unknown as BookBundle;
const positions = paragraphIndex(source);

interface Props {
  point: ReadingPoint;
  step: ReadingStep;
}

function reader(initial: Props) {
  return renderHook(({ point, step }: Props) => useStaging(bundle, positions, point, step), {
    initialProps: initial,
  });
}

const at = (index: number): ReadingPoint => ({ index, beat: 0 });

describe("useStaging gestures", () => {
  it("arrives on a forward page turn and closes when the reader moves on", () => {
    const { result, rerender } = reader({ point: at(1), step: { serial: 0, direction: 1 } });
    expect(result.current.gesture).toBeNull();

    rerender({ point: at(2), step: { serial: 1, direction: 1 } });
    expect(result.current.gesture?.cue.id).toBe("gesture_001");
    expect(result.current.gesture?.active).toBe(true);

    rerender({ point: at(3), step: { serial: 2, direction: 1 } });
    expect(result.current.gesture?.active).toBe(false);
  });

  it("does not replay after paging back and forward again", () => {
    const { result, rerender } = reader({ point: at(1), step: { serial: 0, direction: 1 } });
    rerender({ point: at(2), step: { serial: 1, direction: 1 } });
    const first = result.current.gesture?.serial;
    rerender({ point: at(1), step: { serial: 2, direction: -1 } });
    rerender({ point: at(2), step: { serial: 3, direction: 1 } });
    expect(result.current.gesture?.serial).toBe(first);
    expect(result.current.gesture?.active).toBe(false);
  });

  it("never appears on a jump or a resume", () => {
    const { result, rerender } = reader({ point: at(1), step: { serial: 0, direction: 1 } });
    // A jump moves the reading point without a page turn.
    rerender({ point: at(2), step: { serial: 0, direction: 1 } });
    expect(result.current.gesture).toBeNull();

    const resumed = reader({ point: at(2), step: { serial: 0, direction: 1 } });
    expect(resumed.result.current.gesture).toBeNull();
  });
});
