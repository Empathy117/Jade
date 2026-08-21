import { describe, expect, it } from "vitest";

import type { CharacterView, TreeView } from "./codex";
import { treeLayout } from "./treeLayout";

function makeView(id: string, name: string): CharacterView {
  return {
    character: { id, name, at: "p0002" },
    appeared: true,
    aliases: [],
    facts: [],
    status: [],
    currentStatus: null,
    relations: [],
  };
}

function makeTree(overrides: Partial<TreeView>): TreeView {
  return {
    tree: {
      id: "tree_family",
      title: "家族",
      at: "p0002",
      nodes: [
        { character_id: "char_ann", row: 0, col: 0 },
        { character_id: "char_ben", row: 0, col: 2 },
        { character_id: "char_dan", row: 1, col: 1 },
      ],
    },
    nodes: [
      { node: { character_id: "char_ann", row: 0, col: 0 }, view: makeView("char_ann", "安") },
      { node: { character_id: "char_ben", row: 0, col: 2 }, view: makeView("char_ben", "本") },
      { node: { character_id: "char_dan", row: 1, col: 1 }, view: makeView("char_dan", "丹") },
    ],
    couples: [["char_ann", "char_ben"]],
    parentLinks: [
      { parent: "char_ann", child: "char_dan" },
      { parent: "char_ben", child: "char_dan" },
    ],
    ...overrides,
  };
}

describe("treeLayout", () => {
  it("places chips on the half-chip column grid", () => {
    const layout = treeLayout(makeTree({}));

    expect(layout.chips.map((chip) => [chip.id, chip.x, chip.y])).toEqual([
      ["char_ann", 84, 54],
      ["char_ben", 220, 54],
      ["char_dan", 152, 172],
    ]);
    expect(layout.width).toBeGreaterThan(220);
    expect(layout.height).toBeGreaterThan(172);
  });

  it("draws a marriage bar between spouses on the same row", () => {
    const layout = treeLayout(makeTree({}));

    expect(layout.couples).toEqual([
      { key: "char_ann=char_ben", x1: 142, x2: 162, y: 54 },
    ]);
  });

  it("skips the bar for a spouse pair split across rows", () => {
    const layout = treeLayout(
      makeTree({
        nodes: [
          { node: { character_id: "char_ann", row: 0, col: 0 }, view: makeView("char_ann", "安") },
          { node: { character_id: "char_ben", row: 1, col: 2 }, view: makeView("char_ben", "本") },
        ],
        parentLinks: [],
      }),
    );

    expect(layout.couples).toEqual([]);
  });

  it("drops a couple's children from the midpoint between the parents", () => {
    const layout = treeLayout(makeTree({}));

    expect(layout.descents).toEqual([
      {
        key: "char_ann+char_ben",
        fromX: 152,
        fromY: 54,
        busY: 128,
        children: [{ x: 152, topY: 148 }],
      },
    ]);
  });

  it("drops a single known parent's children from that chip's bottom edge", () => {
    const layout = treeLayout(
      makeTree({
        parentLinks: [{ parent: "char_ann", child: "char_dan" }],
      }),
    );

    expect(layout.descents).toEqual([
      {
        key: "char_ann",
        fromX: 84,
        fromY: 78,
        busY: 128,
        children: [{ x: 152, topY: 148 }],
      },
    ]);
  });
});
