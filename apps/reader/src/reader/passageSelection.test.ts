import { afterEach, describe, expect, it } from "vitest";

import { hasTextSelection, resolvePassage } from "./passageSelection";
import type { Paragraph } from "./types";

const paragraphs: Paragraph[] = [
  { id: "p0001", kind: "title", text: "测试之书" },
  { id: "p0002", kind: "prose", text: "山路越走越深。\n风停了。" },
  { id: "p0003", kind: "note", text: "① 编者注。" },
  { id: "p0004", kind: "prose", text: "两位绅士①站在门前。" },
];
const positions = new Map(paragraphs.map((paragraph, index) => [paragraph.id, index]));

/** The markup ReadingViewport renders: stamped text runs, unstamped chrome. */
function mountViewport(): HTMLElement {
  const root = document.createElement("section");
  root.innerHTML = `
    <div class="reading-block" data-paragraph-id="p0002">
      <div class="paragraph">
        <span><span data-text-start="0">山路越走越深。</span><br></span><span><span data-text-start="8">风停了。</span></span>
        <button class="paragraph-chip">批</button>
      </div>
      <div class="reading-beat-mark">1 / 1</div>
    </div>
    <div class="reading-block" data-paragraph-id="p0004">
      <div class="paragraph">
        <span><span data-text-start="0">两位绅士</span><button class="note-marker" data-text-start="4">①</button><span data-text-start="5">站在</span><mark data-text-start="7">门前。</mark></span>
      </div>
    </div>`;
  document.body.append(root);
  return root;
}

function textOf(root: HTMLElement, start: number, paragraphId: string): Text {
  const segment = root.querySelector(
    `[data-paragraph-id="${paragraphId}"] [data-text-start="${start}"]`,
  );
  return segment!.firstChild as Text;
}

function rangeBetween(start: [Node, number], end: [Node, number]): Range {
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  return range;
}

describe("resolvePassage", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("anchors a selection inside one run by paragraph offsets", () => {
    const root = mountViewport();
    const text = textOf(root, 8, "p0002");

    expect(resolvePassage(root, rangeBetween([text, 1], [text, 3]), paragraphs, positions)).toEqual({
      start: { paragraphId: "p0002", offset: 9 },
      end: { paragraphId: "p0002", offset: 11 },
    });
  });

  it("spans paragraphs and counts marker superscripts as source text", () => {
    const root = mountViewport();
    const range = rangeBetween([textOf(root, 0, "p0002"), 5], [textOf(root, 5, "p0004"), 1]);

    expect(resolvePassage(root, range, paragraphs, positions)).toEqual({
      start: { paragraphId: "p0002", offset: 5 },
      end: { paragraphId: "p0004", offset: 6 },
    });
  });

  it("ignores chips and page counters caught in the sweep", () => {
    const root = mountViewport();
    const chip = root.querySelector(".paragraph-chip")!;
    const counter = root.querySelector(".reading-beat-mark")!;
    const range = rangeBetween([chip.firstChild!, 0], [counter.firstChild!, 3]);

    expect(resolvePassage(root, range, paragraphs, positions)).toBeNull();
  });

  it("pulls both ends in past line breaks and paragraph gaps", () => {
    const root = mountViewport();
    // From the end of the first line to the very start of the next paragraph.
    const range = rangeBetween(
      [textOf(root, 0, "p0002"), 7],
      [root.querySelector('[data-paragraph-id="p0004"]')!, 0],
    );

    expect(resolvePassage(root, range, paragraphs, positions)).toEqual({
      start: { paragraphId: "p0002", offset: 8 },
      end: { paragraphId: "p0002", offset: 12 },
    });
  });
});

describe("hasTextSelection", () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.innerHTML = "";
  });

  it("sees only a selection that holds words", () => {
    const root = mountViewport();
    const text = textOf(root, 0, "p0002");
    const selection = window.getSelection()!;

    selection.setBaseAndExtent(text, 2, text, 2);
    expect(hasTextSelection()).toBe(false);

    selection.setBaseAndExtent(text, 0, text, 2);
    expect(hasTextSelection()).toBe(true);
  });
});
