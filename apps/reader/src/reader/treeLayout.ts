import type { CharacterView, TreeView } from "./codex";

/**
 * Genealogy rendering from the authored row/col grid.
 *
 * Columns are half-chip units: a chip visually spans two columns, so spouses
 * sit two columns apart and a couple's child can center on the odd column
 * between them. The authoring guideline lives in the production protocol; the
 * renderer just draws whatever grid it is given.
 */
export const CHIP_W = 116;
export const CHIP_H = 48;
const COL_UNIT = 68;
const ROW_UNIT = 118;
const PAD_X = 26;
const PAD_Y = 30;

export interface TreeChip {
  id: string;
  x: number;
  y: number;
  view: CharacterView;
}

export interface CoupleBar {
  key: string;
  x1: number;
  x2: number;
  y: number;
}

export interface DescentGroup {
  key: string;
  fromX: number;
  fromY: number;
  busY: number;
  children: Array<{ x: number; topY: number }>;
}

export interface TreeLayout {
  width: number;
  height: number;
  chips: TreeChip[];
  couples: CoupleBar[];
  descents: DescentGroup[];
}

export function treeLayout(tree: TreeView): TreeLayout {
  const centerX = (col: number): number => PAD_X + CHIP_W / 2 + col * COL_UNIT;
  const centerY = (row: number): number => PAD_Y + CHIP_H / 2 + row * ROW_UNIT;

  const chips = tree.nodes.map(({ node, view }) => ({
    id: node.character_id,
    x: centerX(node.col),
    y: centerY(node.row),
    view,
  }));
  const chipById = new Map(chips.map((chip) => [chip.id, chip]));

  const couples: CoupleBar[] = [];
  for (const [a, b] of tree.couples) {
    const left = chipById.get(a);
    const right = chipById.get(b);
    // A spouse pair split across rows has no bar; the card still says so.
    if (!left || !right || left.y !== right.y) continue;
    const [near, far] = left.x <= right.x ? [left, right] : [right, left];
    couples.push({
      key: `${a}=${b}`,
      x1: near.x + CHIP_W / 2,
      x2: far.x - CHIP_W / 2,
      y: near.y,
    });
  }

  // Children group under their parent set: a couple's children descend from
  // the marriage bar's midpoint, a single known parent's from that chip.
  const parentsByChild = new Map<string, string[]>();
  for (const link of tree.parentLinks) {
    const parents = parentsByChild.get(link.child) ?? [];
    parents.push(link.parent);
    parentsByChild.set(link.child, parents);
  }
  const groups = new Map<string, { parents: string[]; children: TreeChip[] }>();
  for (const [childId, parents] of parentsByChild) {
    const child = chipById.get(childId);
    if (!child) continue;
    const key = [...parents].sort().join("+");
    const group = groups.get(key) ?? { parents, children: [] };
    group.children.push(child);
    groups.set(key, group);
  }

  const descents: DescentGroup[] = [];
  for (const [key, group] of groups) {
    const parentChips = group.parents
      .map((parent) => chipById.get(parent))
      .filter((chip): chip is TreeChip => chip !== undefined);
    if (parentChips.length === 0 || group.children.length === 0) continue;
    const fromX =
      parentChips.reduce((sum, chip) => sum + chip.x, 0) / parentChips.length;
    const fromY =
      parentChips.length > 1
        ? Math.max(...parentChips.map((chip) => chip.y))
        : parentChips[0].y + CHIP_H / 2;
    const children = [...group.children]
      .sort((left, right) => left.x - right.x)
      .map((chip) => ({ x: chip.x, topY: chip.y - CHIP_H / 2 }));
    const busY = Math.min(...children.map((child) => child.topY)) - 20;
    descents.push({ key, fromX, fromY, busY, children });
  }

  const maxX = Math.max(...chips.map((chip) => chip.x));
  const maxY = Math.max(...chips.map((chip) => chip.y));
  return {
    width: maxX + CHIP_W / 2 + PAD_X,
    height: maxY + CHIP_H / 2 + PAD_Y + 14,
    chips,
    couples: couples.sort((left, right) => left.key.localeCompare(right.key)),
    descents: descents.sort((left, right) => left.key.localeCompare(right.key)),
  };
}
