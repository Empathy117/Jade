import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { unlockedCodex } from "./codex";
import { CodexPanel } from "./CodexPanel";
import type { ResolvedReference } from "./guideReferences";
import type { CodexDocument, DirectionDocument } from "./types";

const PARAGRAPH_IDS = Array.from({ length: 12 }, (_, index) =>
  `p${String(index + 1).padStart(4, "0")}`,
);
const positions = new Map(PARAGRAPH_IDS.map((id, index) => [id, index]));

const direction: DirectionDocument = {
  schema_version: 1,
  book_id: "test-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  scenes: [
    {
      id: "scene_001",
      label: "初到大宅",
      start: "p0002",
      end: "p0011",
      location: "hall",
      time: null,
      weather: null,
      mood: ["quiet"],
      tension: 0.2,
    },
  ],
};

const codex: CodexDocument = {
  schema_version: 1,
  book_id: "test-book",
  source_revision: 1,
  source_sha256: "0".repeat(64),
  characters: [
    {
      id: "char_ann",
      name: "安",
      at: "p0002",
      role: "大宅的主人",
      group: "家族",
      status: [{ label: "死亡", kind: "dead", at: "p0006" }],
    },
    { id: "char_cat", name: "凯特", at: "p0003", group: "村镇" },
  ],
  relationships: [{ a: "char_ann", b: "char_cat", kind: "friend", label: "旧识", at: "p0004" }],
  places: [{ id: "hall", name: "大厅", at: "p0002" }],
  maps: [
    {
      id: "map_manor",
      title: "大宅",
      at: "p0002",
      image: "codex-assets/manor.svg",
      width: 100,
      height: 80,
      source_illustration_id: "ill0001",
      markers: [{ place_id: "hall", x: 10, y: 10 }],
    },
  ],
};

const references: ResolvedReference[] = [
  {
    reference: { id: "ref_map", illustration_id: "ill0001", title: "原书地图" },
    illustration: {
      id: "ill0001",
      at: "p0002",
      title: "原书地图",
      path: "source-assets/map.png",
      media_type: "image/png",
      sha256: "1".repeat(64),
      source_href: "images/map.png",
    },
    src: "/test-book/source-assets/map.png",
  },
];

function renderPanel(overrides: Partial<Parameters<typeof CodexPanel>[0]> = {}) {
  const onJump = vi.fn();
  render(
    <CodexPanel
      view={unlockedCodex(codex, direction, positions, 8)}
      references={references}
      bookPath="test-book"
      activeLocation="hall"
      seenIndex={2}
      positions={positions}
      initialTab={null}
      initialReferenceId={null}
      onJump={onJump}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
  return onJump;
}

describe("CodexPanel", () => {
  it("shows every populated tab and opens on the people tab", () => {
    renderPanel();

    expect(screen.getByRole("tab", { name: "人物" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "地图" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "图册" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "安" })).toBeDefined();
    expect(screen.getByText("大宅的主人")).toBeDefined();
    expect(screen.getByText("死亡")).toBeDefined();
  });

  it("navigates between characters through relation chips", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /凯特\s*旧识/ }));

    expect(screen.getByRole("heading", { name: "凯特" })).toBeDefined();
  });

  it("shows the map with its you-are-here marker and opens the place card", async () => {
    const user = userEvent.setup();
    const onJump = renderPanel();

    await user.click(screen.getByRole("tab", { name: "地图" }));

    expect(screen.getByAltText("大宅")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "大厅（你在这里）" }));
    expect(screen.getByRole("heading", { name: "大厅" })).toBeDefined();
    expect(screen.getByText("初到大宅")).toBeDefined();
    // The place card lists exactly one read scene, so one jump button.
    await user.click(screen.getByRole("button", { name: /回到原文/ }));
    expect(onJump).toHaveBeenCalledWith("p0002");
  });

  it("jumps to the map's source scan through the gallery tab", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("tab", { name: "地图" }));
    await user.click(screen.getByRole("button", { name: /查看原书扫描/ }));

    expect(screen.getByRole("tab", { name: "图册", selected: true })).toBeDefined();
    expect(screen.getByRole("heading", { name: "原书地图" })).toBeDefined();
  });

  it("honours an initial gallery intent from an inline illustration", () => {
    renderPanel({ initialTab: "gallery", initialReferenceId: "ref_map" });

    expect(screen.getByRole("tab", { name: "图册", selected: true })).toBeDefined();
    expect(screen.getByRole("heading", { name: "原书地图" })).toBeDefined();
  });
});
