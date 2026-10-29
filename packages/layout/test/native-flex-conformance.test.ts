import { beforeAll, expect, it } from 'vitest';
import { createLayoutTree, prepareLayout, type LayoutStyle } from '../src/index.js';

beforeAll(prepareLayout);

it.each([
  { name: 'shrinking', basis: 90, grow: 0, shrink: 1 },
  { name: 'growing', basis: 20, grow: 1, shrink: 0 },
])('keeps the solved parent main allocation authoritative when $name declared boxes', ({ basis, grow, shrink }) => {
  const tree = createLayoutTree();
  try {
    const root = tree.createNode({ style: { width: 100, height: 30, flexDirection: 'row' } });
    const first = tree.createNode({ style: { width: basis, height: 20, flexGrow: grow, flexShrink: shrink } });
    const second = tree.createNode({ style: { width: basis, height: 20, flexGrow: grow, flexShrink: shrink } });
    tree.appendChild(root, first); tree.appendChild(root, second);
    const result = tree.calculateLayout({ root, width: 100, height: 30 });
    expect(result.getBox(first)).toEqual({ x: 0, y: 0, width: 50, height: 20 });
    expect(result.getBox(second)).toEqual({ x: 50, y: 0, width: 50, height: 20 });
  } finally { tree.dispose(); }
});

it('wraps source-order children into native lines with separate main and cross gaps', () => {
  const tree = createLayoutTree();
  try {
    const root = tree.createNode({ style: { width: 100, height: 60, flexWrap: 'wrap', columnGap: 10, rowGap: 5, alignItems: 'flex-start', alignContent: 'flex-start' } });
    const children = [0, 1, 2].map(() => tree.createNode({ style: { width: 40, height: 10, flexShrink: 0 } }));
    for (const child of children) tree.appendChild(root, child);
    const result = tree.calculateLayout({ root, width: 100, height: 60 });
    expect(children.map(child => result.getBox(child))).toEqual([
      { x: 0, y: 0, width: 40, height: 10 },
      { x: 50, y: 0, width: 40, height: 10 },
      { x: 0, y: 15, width: 40, height: 10 },
    ]);
  } finally { tree.dispose(); }
});

it.each([
  { justifyContent: 'flex-end', alignItems: 'flex-end', x: 80, y: 40 },
  { justifyContent: 'center', alignItems: 'center', x: 40, y: 20 },
] as const)('applies $justifyContent main and $alignItems cross alignment', ({ justifyContent, alignItems, x, y }) => {
  const tree = createLayoutTree();
  try {
    const style: LayoutStyle = { width: 100, height: 50, justifyContent, alignItems };
    const root = tree.createNode({ style });
    const child = tree.createNode({ style: { width: 20, height: 10 } });
    tree.appendChild(root, child);
    const result = tree.calculateLayout({ root, width: 100, height: 50 });
    expect(result.getBox(child)).toEqual({ x, y, width: 20, height: 10 });
  } finally { tree.dispose(); }
});

it('remeasures dependent cross size at the native final main allocation', () => {
  const tree = createLayoutTree();
  const widths: number[] = [];
  try {
    const root = tree.createNode({ style: { width: 100, height: 60, alignItems: 'flex-start' } });
    const measured = tree.createNode({
      style: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
      measure: ({ width }) => {
        widths.push(width.maximum);
        return { width: Math.min(80, width.maximum), height: Math.ceil(80 / Math.max(1, width.maximum)) * 10 };
      },
    });
    const fixed = tree.createNode({ style: { width: 50, height: 10, flexShrink: 0 } });
    tree.appendChild(root, measured); tree.appendChild(root, fixed);
    const result = tree.calculateLayout({ root, width: 100, height: 60 });
    expect(result.getBox(measured)).toEqual({ x: 0, y: 0, width: 50, height: 20 });
    expect(result.getBox(fixed)).toEqual({ x: 50, y: 0, width: 50, height: 10 });
    expect(widths).toContain(50);
  } finally { tree.dispose(); }
});

it('replaces wrapped line placement after the settled main-width measurement', () => {
  const tree = createLayoutTree();
  try {
    const root = tree.createNode({ style: { width: 100, height: 80, flexWrap: 'wrap', alignItems: 'flex-start' } });
    const measured = tree.createNode({ style: { width: 50, flexShrink: 0 }, measure: ({ width }) => ({ width: width.maximum, height: width.maximum === 50 ? 20 : 10 }) });
    const first = tree.createNode({ style: { width: 50, height: 10, flexShrink: 0 } });
    const following = tree.createNode({ style: { width: 50, height: 10, flexShrink: 0 } });
    tree.appendChild(root, measured); tree.appendChild(root, first); tree.appendChild(root, following);
    const result = tree.calculateLayout({ root, width: 100, height: 80 });
    expect(result.getBox(following)).toEqual({ x: 0, y: 20, width: 50, height: 10 });
  } finally { tree.dispose(); }
});

it('remeasures an auto Grid row at its final column width before placing the following row', () => {
  const tree = createLayoutTree();
  try {
    const root = tree.createNode({ style: { layout: 'grid', width: 100, height: 80, gridTemplateColumns: ['1fr', '1fr'], gridTemplateRows: ['auto', 'auto'] } });
    const measured = tree.createNode({ style: { gridColumnStart: 1, gridRowStart: 1 }, measure: ({ width, height }) => ({ width: width.maximum, height: Math.min(height.maximum, width.maximum <= 50 ? 20 : 10) }) });
    const following = tree.createNode({ style: { gridColumnStart: 1, gridRowStart: 2, width: 50, height: 10 } });
    tree.appendChild(root, measured); tree.appendChild(root, following);
    const result = tree.calculateLayout({ root, width: 100, height: 80 });
    expect(result.getBox(measured)).toEqual({ x: 0, y: 0, width: 50, height: 20 });
    expect(result.getBox(following)).toEqual({ x: 0, y: 20, width: 50, height: 10 });
  } finally { tree.dispose(); }
});

it('does not reinvoke an unchanged settled measurement envelope', () => {
  const tree = createLayoutTree();
  let calls = 0;
  try {
    const root = tree.createNode({ style: { width: 100, height: 40 } });
    const child = tree.createNode({ style: { width: 50 }, measure: ({ width }) => { calls++; return { width: width.maximum, height: 10 }; } });
    tree.appendChild(root, child);
    tree.calculateLayout({ root, width: 100, height: 40 });
    expect(calls).toBe(1);
  } finally { tree.dispose(); }
});
