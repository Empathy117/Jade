import { useState } from "react";

import type { ResolvedReference } from "./guideReferences";

interface ReferenceGalleryProps {
  items: ResolvedReference[];
  selectedId: string | null;
  onSelect: (referenceId: string) => void;
  onClose: () => void;
  onJump: (paragraphId: string) => void;
}

export function ReferenceGallery({
  items,
  selectedId,
  onSelect,
  onClose,
  onJump,
}: ReferenceGalleryProps) {
  const selected = items.find((item) => item.reference.id === selectedId) ?? items[0];
  // Zoom belongs to one diagram: switching diagrams starts unzoomed again.
  const [zoom, setZoom] = useState<{ referenceId?: string; zoomed: boolean }>({
    referenceId: selected?.reference.id,
    zoomed: false,
  });
  const zoomed = zoom.referenceId === selected?.reference.id && zoom.zoomed;
  const toggleZoom = () =>
    setZoom({ referenceId: selected?.reference.id, zoomed: !zoomed });

  if (!selected) return null;

  return (
    <div
      className="reference-backdrop"
      data-interactive="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="reference-gallery"
        role="dialog"
        aria-modal="true"
        aria-label="资料图册"
      >
        <header className="reference-heading">
          <div>
            <p>资料图册</p>
            <span>原书附图 · 已随阅读进度解锁 {items.length} 张</span>
          </div>
          <button type="button" aria-label="关闭资料图册" onClick={onClose}>×</button>
        </header>

        <div className={`reference-layout${items.length === 1 ? " reference-layout--single" : ""}`}>
          {items.length > 1 ? (
            <nav className="reference-list" aria-label="选择资料图">
              {items.map((item) => (
                <button
                  className={item.reference.id === selected.reference.id ? "is-current" : ""}
                  type="button"
                  key={item.reference.id}
                  aria-current={item.reference.id === selected.reference.id ? "true" : undefined}
                  onClick={() => onSelect(item.reference.id)}
                >
                  <img src={item.src} alt="" />
                  <span>{item.reference.title}</span>
                </button>
              ))}
            </nav>
          ) : null}

          <article className="reference-viewer">
            <div className="reference-viewer__toolbar">
              <div>
                <h2>{selected.reference.title}</h2>
                {selected.reference.note ? <p>{selected.reference.note}</p> : null}
              </div>
              <button type="button" onClick={toggleZoom}>
                {zoomed ? "适应窗口" : "放大查看"}
              </button>
            </div>
            <button
              className={`reference-canvas${zoomed ? " is-zoomed" : ""}`}
              type="button"
              aria-label={zoomed ? "缩小图片" : "放大图片"}
              onClick={toggleZoom}
            >
              <img src={selected.src} alt={selected.reference.title} />
            </button>
            <footer className="reference-viewer__footer">
              <span>来自原始 EPUB · {selected.illustration.at}</span>
              <button type="button" onClick={() => onJump(selected.illustration.at)}>
                回到原文位置 <span aria-hidden="true">→</span>
              </button>
            </footer>
          </article>
        </div>
      </section>
    </div>
  );
}
