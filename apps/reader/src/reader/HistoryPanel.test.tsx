import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HistoryPanel } from "./HistoryPanel";
import { HISTORY_WINDOW_RADIUS } from "./historyWindow";
import { makeParagraphs } from "../test/bookFixture";

const paragraphs = makeParagraphs(4000);
const FURTHEST = paragraphs.length - 1;

function renderPanel(currentIndex: number) {
  const onJump = vi.fn();
  render(
    <HistoryPanel
      paragraphs={paragraphs}
      firstIndex={1}
      currentIndex={currentIndex}
      furthestReadIndex={FURTHEST}
      onClose={vi.fn()}
      onJump={onJump}
      onReturnToLatest={vi.fn()}
    />,
  );
  return onJump;
}

function entryCount() {
  return document.querySelectorAll(".history-entry").length;
}

describe("HistoryPanel", () => {
  it("renders a window instead of every read paragraph", () => {
    renderPanel(FURTHEST);

    expect(entryCount()).toBeLessThanOrEqual(HISTORY_WINDOW_RADIUS * 2 + 1);
    expect(entryCount()).toBeGreaterThan(0);
    expect(screen.getByText(`已读 ${FURTHEST} 段 · 点击任意段落跳转`)).toBeDefined();
  });

  it("includes the current paragraph even when it is far behind the frontier", () => {
    renderPanel(40);

    expect(screen.getByText("第 39 段正文。")).toBeDefined();
    expect(screen.queryByText("第 3999 段正文。")).toBeNull();
  });

  it("grows the window on demand in both directions", async () => {
    const user = userEvent.setup();
    renderPanel(2000);
    const initial = entryCount();

    await user.click(screen.getByRole("button", { name: /载入更早的段落/ }));
    expect(entryCount()).toBe(initial + HISTORY_WINDOW_RADIUS);

    await user.click(screen.getByRole("button", { name: /载入更晚的段落/ }));
    expect(entryCount()).toBe(initial + HISTORY_WINDOW_RADIUS * 2);
  });

  it("numbers entries by their position in the book, not in the window", async () => {
    const user = userEvent.setup();
    const onJump = renderPanel(2000);

    // paragraphs[1999] is "第 1999 段正文。": index 0 is the title.
    const entry = screen.getByText("第 1999 段正文。").closest(".history-entry");
    expect(entry?.querySelector(".history-entry__number")?.textContent).toBe("1999");

    await user.click(screen.getByText("第 1999 段正文。"));

    expect(onJump).toHaveBeenCalledWith(1999);
  });

  it("offers no expansion once the whole history fits", () => {
    render(
      <HistoryPanel
        paragraphs={paragraphs}
        firstIndex={1}
        currentIndex={5}
        furthestReadIndex={5}
          onClose={vi.fn()}
        onJump={vi.fn()}
        onReturnToLatest={vi.fn()}
      />,
    );

    expect(entryCount()).toBe(5);
    expect(screen.queryByRole("button", { name: /载入更早的段落/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /载入更晚的段落/ })).toBeNull();
  });
});
