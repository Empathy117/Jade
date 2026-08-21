import { useState } from "react";

import type { ResolvedReference } from "./guideReferences";

interface ReferenceGalleryContentProps {
  items: ResolvedReference[];
  selectedId: string | null;
  onSelect: (referenceId: string) => void;
  onJump: (paragraphId: string) => void;
}

/**
 * The dossier's provenance layer: original source scans, viewed as-is.
 *
 * Rendered inside the dossier panel's gallery tab; the panel owns the dialog
 * shell, tabs, and close behaviour.
 */
export function ReferenceGalleryContent({
  items,
  selectedId,
  onSelect,
  onJump,
}: ReferenceGalleryContentProps) {
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
  );
}
