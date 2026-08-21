import { CHIP_H, CHIP_W, treeLayout } from "./treeLayout";
import type { TreeView } from "./codex";
import type { CodexStatusKind } from "./types";

const STATUS_GLYPHS: Record<CodexStatusKind, string> = {
  alive: "",
  dead: "†",
  undead: "再",
  missing: "?",
  unknown: "?",
};

interface FamilyTreeProps {
  tree: TreeView;
  selectedId: string | null;
  onSelect: (characterId: string) => void;
}

export function FamilyTree({ tree, selectedId, onSelect }: FamilyTreeProps) {
  const layout = treeLayout(tree);

  return (
    <div className="tree-scroll">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ minWidth: layout.width }}
        role="img"
        aria-label={tree.tree.title}
      >
        <g>
          {layout.couples.map((couple) => (
            <g key={couple.key}>
              <line className="tree-line" x1={couple.x1} y1={couple.y - 3} x2={couple.x2} y2={couple.y - 3} />
              <line className="tree-line" x1={couple.x1} y1={couple.y + 3} x2={couple.x2} y2={couple.y + 3} />
            </g>
          ))}
          {layout.descents.map((descent) => (
            <g key={descent.key}>
              <line
                className="tree-line"
                x1={descent.fromX}
                y1={descent.fromY}
                x2={descent.fromX}
                y2={descent.busY}
              />
              {descent.children.length > 1 ? (
                <line
                  className="tree-line"
                  x1={Math.min(descent.fromX, descent.children[0].x)}
                  y1={descent.busY}
                  x2={Math.max(descent.fromX, descent.children[descent.children.length - 1].x)}
                  y2={descent.busY}
                />
              ) : (
                <line
                  className="tree-line"
                  x1={descent.fromX}
                  y1={descent.busY}
                  x2={descent.children[0].x}
                  y2={descent.busY}
                />
              )}
              {descent.children.map((child) => (
                <line
                  key={`${descent.key}-${child.x}`}
                  className="tree-line"
                  x1={child.x}
                  y1={descent.busY}
                  x2={child.x}
                  y2={child.topY}
                />
              ))}
            </g>
          ))}
        </g>
        {layout.chips.map((chip) => {
          const status = chip.view.currentStatus;
          const glyph = status ? STATUS_GLYPHS[status.kind] : "";
          return (
            <g
              key={chip.id}
              className={`tree-node${chip.id === selectedId ? " is-selected" : ""}${chip.view.appeared ? "" : " is-pending"}`}
              role="button"
              tabIndex={0}
              aria-label={
                chip.view.appeared ? chip.view.character.name : `${chip.view.character.name}（尚未登场）`
              }
              onClick={() => onSelect(chip.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(chip.id);
                }
              }}
            >
              <rect
                x={chip.x - CHIP_W / 2}
                y={chip.y - CHIP_H / 2}
                width={CHIP_W}
                height={CHIP_H}
                rx={9}
              />
              <text
                className="tree-node__name"
                x={chip.x}
                y={chip.view.appeared ? chip.y + 5 : chip.y - 1}
                textAnchor="middle"
              >
                {chip.view.character.name}
              </text>
              {!chip.view.appeared ? (
                <text className="tree-node__sub" x={chip.x} y={chip.y + 15} textAnchor="middle">
                  尚未登场
                </text>
              ) : null}
              {glyph ? (
                <g className={`tree-badge tree-badge--${status?.kind ?? "unknown"}`}>
                  <circle cx={chip.x + CHIP_W / 2 - 4} cy={chip.y - CHIP_H / 2 + 4} r={9} />
                  <text
                    x={chip.x + CHIP_W / 2 - 4}
                    y={chip.y - CHIP_H / 2 + 7.5}
                    textAnchor="middle"
                  >
                    {glyph}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
