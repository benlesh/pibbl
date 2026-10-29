import { beforeAll, expect, it } from 'vitest';
import { createLayoutTree, prepareLayout, fitContent, convertYoga32Style, type LayoutStyle } from '../src/index.js';
beforeAll(prepareLayout);
function boxes(style: LayoutStyle, children: LayoutStyle[]) {
  const tree = createLayoutTree();
  try { const root = tree.createNode({ style }), nodes = children.map(style => tree.createNode({ style })); for (const node of nodes) tree.appendChild(root, node); const snapshot = tree.calculateLayout({ root, width: 400, height: 200 }); return { root: snapshot.getBox(root), children: nodes.map(node => snapshot.getBox(node)) }; }
  finally { tree.dispose(); }
}
it('includes padding in a declared content-box size', () => { expect(boxes({ width: 100, height: 40, boxSizing: 'content-box', padding: 10 }, []).root).toEqual({ x: 0, y: 0, width: 120, height: 60 }); });
it('keeps absolute Grid children out of cells and honors their physical insets', () => { expect(boxes({ layout: 'grid', width: 100, height: 40, gridTemplateColumns: [50, 50], gridTemplateRows: [20, 20] }, [{ position: 'absolute', left: 70, top: 5, width: 10, height: 10 }, { width: 50, height: 20 }]).children).toEqual([{ x: 70, y: 5, width: 10, height: 10 }, { x: 0, y: 0, width: 50, height: 20 }]); });
it('preserves percentage inset units and applies relative offsets once', () => { expect(boxes({ width: 400, height: 200 }, [{ position: 'absolute', left: '50%', top: '50%', width: 20, height: 10 }, { position: 'relative', left: 30, top: 5, width: 20, height: 10 }]).children).toEqual([{ x: 200, y: 100, width: 20, height: 10 }, { x: 30, y: 5, width: 20, height: 10 }]); });
it('preserves percentage fit-content caps', () => {
  const tree = createLayoutTree(); try { const root = tree.createNode({ style: { layout: 'grid', width: 400, height: 40, gridTemplateColumns: [fitContent('50%'), '1fr'], gridTemplateRows: [40] } }), child = tree.createNode({ measureIntrinsic: () => ({ minWidth: 20, maxWidth: 300, minHeight: 20, maxHeight: 20 }) }); tree.appendChild(root, child); expect(tree.calculateLayout({ root, width: 400, height: 40 }).getBox(child).width).toBe(200); } finally { tree.dispose(); }
});
it('reverses wrapped lines and honors content distribution', () => {
  const children = [{ width: 60, height: 20 }, { width: 60, height: 20 }];
  expect(boxes({ width: 100, height: 100, flexWrap: 'wrap-reverse', alignItems: 'flex-start', alignContent: 'flex-start' }, children).children.map(box => box.y)).toEqual([80, 60]);
  expect(boxes({ width: 100, height: 100, flexWrap: 'wrap', alignItems: 'flex-start', alignContent: 'flex-end' }, children).children.map(box => box.y)).toEqual([60, 80]);
});
it('excludes absolute source children from wrapped line heights', () => { expect(boxes({ width: 100, height: 100, flexWrap: 'wrap', alignItems: 'flex-start' }, [{ position: 'absolute', width: 10, height: 70 }, { width: 60, height: 20 }, { width: 60, height: 20 }]).children[2]!.y).toBe(20); });
it('honors an explicit zero axis-gap override', () => { expect(boxes({ width: 200, height: 40, gap: 10, columnGap: 0 }, [{ width: 20, height: 10 }, { width: 20, height: 10 }]).children[1]!.x).toBe(20); });
it('diagnoses unsupported Yoga enum values instead of returning executable styles', () => { expect(convertYoga32Style({ overflow: 'hidden' }).value).toBeUndefined(); expect(convertYoga32Style({ alignItems: 'bogus' }).value).toBeUndefined(); });

it('diagnoses unsupported standalone baseline alignment', () => {
  expect(() => boxes({ width: 100, height: 40, alignItems: 'baseline' }, [{ width: 20, height: 10 }])).toThrow(/baseline provider/);
  expect(convertYoga32Style({ alignItems: 'baseline' }).value).toBeUndefined();
});
