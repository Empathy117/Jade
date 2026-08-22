import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { progressStorageKey, readingBeatStorageKey } from "./reader/readerState";
import { stubBookFetch } from "./test/bookFixture";

const PROGRESS_KEY = progressStorageKey("test-book", 1);
const READING_BEAT_KEY = readingBeatStorageKey("test-book", 1);

async function openBook() {
  const user = userEvent.setup();
  render(<App />);
  // The library card reads "开始阅读" or "继续阅读" depending on saved progress.
  const card = await screen.findByRole("button", { name: /阅读《测试之书》/ });
  await user.click(card);
  // The cover, whichever start options it offers for this book.
  await screen.findByText("原书负责说什么，导演只决定怎么呈现。");
  return user;
}

async function startReading() {
  const user = await openBook();
  await user.click(screen.getByRole("button", { name: /^开始阅读/ }));
  await screen.findByRole("button", { name: "下一页" });
  return user;
}

describe("App", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", stubBookFetch());
    window.history.pushState({}, "", "/");
  });

  it("lists the library and opens a book cover", async () => {
    await openBook();

    expect(screen.getByRole("heading", { name: "测试之书" })).toBeDefined();
    expect(screen.getByText("沉浸阅读 · Agent 导演版")).toBeDefined();
  });

  it("records the selected book in the URL so it can be linked", async () => {
    await openBook();

    expect(new URLSearchParams(window.location.search).get("book")).toBe("test-book");
  });

  it("shows the first body paragraph once reading starts", async () => {
    await startReading();

    expect(screen.getByText("第 1 段正文。")).toBeDefined();
    expect(screen.queryByText("第 2 段正文。")).toBeNull();
  });

  it("advances on Space and keeps earlier text from the same scene on screen", async () => {
    const user = await startReading();

    await user.keyboard(" ");

    expect(await screen.findByText("第 2 段正文。")).toBeDefined();
    expect(screen.getByText("第 1 段正文。")).toBeDefined();
  });

  it("turns through a long source paragraph before advancing its paragraph id", async () => {
    vi.stubGlobal(
      "fetch",
      stubBookFetch(6, { firstProseText: "第一句。".repeat(90) }),
    );
    const user = await openBook();
    await user.click(screen.getByRole("button", { name: /^开始阅读/ }));

    expect(await screen.findByLabelText(/本段第 1 页/)).toBeDefined();
    expect(document.querySelector(".reading-block")?.getAttribute("data-paragraph-id")).toBe("p0002");

    await user.keyboard(" ");

    expect(await screen.findByLabelText(/本段第 2 页/)).toBeDefined();
    const visibleBeats = document.querySelectorAll(".reading-block[data-paragraph-id='p0002']");
    expect(visibleBeats).toHaveLength(2);
    expect(window.localStorage.getItem(READING_BEAT_KEY)).toBe("1");
  });

  it("clears retained text only when a new scene asks for a clear", async () => {
    const user = await startReading();
    await user.keyboard(" ");

    expect(screen.getByText("第 1 段正文。")).toBeDefined();
    expect(screen.getByText("第 2 段正文。")).toBeDefined();

    await user.keyboard(" ");

    expect(await screen.findByText("第 3 段正文。")).toBeDefined();
    expect(screen.queryByText("第 1 段正文。")).toBeNull();
    expect(screen.queryByText("第 2 段正文。")).toBeNull();
  });

  it("stores the furthest read paragraph so the book can resume", async () => {
    const user = await startReading();

    await user.keyboard(" ");

    await waitFor(() => {
      expect(window.localStorage.getItem(PROGRESS_KEY)).toBe("p0003");
    });
  });

  it("does not lose the furthest position when reviewing an earlier paragraph", async () => {
    const user = await startReading();
    await user.keyboard(" ");
    await user.keyboard(" ");
    await waitFor(() => {
      expect(window.localStorage.getItem(PROGRESS_KEY)).toBe("p0004");
    });

    await user.keyboard("{ArrowLeft}");

    expect(screen.queryByText("第 3 段正文。")).toBeNull();
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBe("p0004");
  });

  it("offers to resume when progress was saved earlier", async () => {
    window.localStorage.setItem(PROGRESS_KEY, "p0004");

    await openBook();

    expect(screen.getByRole("button", { name: /继续阅读/ })).toBeDefined();
  });

  it("resumes the saved page inside a long paragraph", async () => {
    vi.stubGlobal(
      "fetch",
      stubBookFetch(6, { firstProseText: "第一句。".repeat(90) }),
    );
    window.localStorage.setItem(PROGRESS_KEY, "p0002");
    window.localStorage.setItem(READING_BEAT_KEY, "2");
    const user = await openBook();

    await user.click(screen.getByRole("button", { name: /继续阅读/ }));

    expect(await screen.findByLabelText(/本段第 3 页/)).toBeDefined();
  });

  it("reports a failed bundle instead of rendering an empty reader", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    );

    render(<App />);

    expect(await screen.findByText("BOOK_LOAD_FAILED")).toBeDefined();
  });

  it("sweeps progress stored under other revisions of the same book", async () => {
    const stale = progressStorageKey("test-book", 0);
    const staleBeat = readingBeatStorageKey("test-book", 0);
    window.localStorage.setItem(stale, "p0002");
    window.localStorage.setItem(staleBeat, "4");
    window.localStorage.setItem(PROGRESS_KEY, "p0004");

    await openBook();

    expect(window.localStorage.getItem(stale)).toBeNull();
    expect(window.localStorage.getItem(staleBeat)).toBeNull();
    expect(window.localStorage.getItem(PROGRESS_KEY)).toBe("p0004");
  });

  it("opens the chapter list once a heading has been read and jumps from it", async () => {
    // A longer book: heading "第 1 章" sits at offset 10 (paragraph id p0012).
    vi.stubGlobal("fetch", stubBookFetch(60));
    window.localStorage.setItem(PROGRESS_KEY, "p0020");
    const user = await openBook();
    await user.click(screen.getByRole("button", { name: /继续阅读/ }));
    await screen.findByRole("button", { name: "下一页" });

    await user.click(screen.getByRole("button", { name: "章节目录" }));
    const chapterEntry = await screen.findByRole("button", { name: /第 1 章/ });
    await user.click(chapterEntry);

    expect(screen.queryByRole("dialog", { name: "章节目录" })).toBeNull();
    const paragraphs = document.querySelectorAll(".reading-block");
    expect(paragraphs[paragraphs.length - 1]?.getAttribute("data-paragraph-id")).toBe("p0012");
  });

  it("unlocks the dossier with reading progress and opens it from the header", async () => {
    vi.stubGlobal(
      "fetch",
      stubBookFetch(6, {
        codex: {
          schema_version: 1,
          book_id: "test-book",
          source_revision: 1,
          source_sha256: "0".repeat(64),
          characters: [
            { id: "char_ann", name: "安", at: "p0003", role: "领航员", group: "旅人" },
          ],
        },
      }),
    );
    const user = await startReading();

    // 安 first appears one paragraph ahead — the dossier has nothing to say yet.
    expect(screen.queryByRole("button", { name: "档案" })).toBeNull();

    await user.keyboard(" ");
    await user.click(await screen.findByRole("button", { name: "档案" }));

    expect(screen.getByRole("dialog", { name: "档案" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "安" })).toBeDefined();
    expect(screen.getByText("领航员")).toBeDefined();
  });
});
