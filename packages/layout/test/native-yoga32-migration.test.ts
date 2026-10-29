import { beforeAll, describe, expect, it } from 'vitest';
import {
  analyzeYoga32Tree,
  assertYoga32Converted,
  convertYoga32Style,
  createLayoutTree,
  prepareLayout,
  type LayoutMeasure,
  type LayoutNode,
  type LayoutTree,
  type Yoga32ConversionOptions,
  type Yoga32StyleInput,
  type Yoga32TreeInput,
} from '../src/index.js';

type YogaHostNode = Readonly<{
  style?: Yoga32StyleInput;
  children?: readonly YogaHostNode[];
  measure?: LayoutMeasure;
}>;

const profile: Yoga32ConversionOptions = {
  useWebDefaults: false,
  direction: 'ltr',
  pointScaleFactor: 0,
};

function analyzeNode(source: YogaHostNode): Yoga32TreeInput {
  return {
    style: source.style,
    children: source.children?.map(analyzeNode),
    measure: source.measure ? 'present' : undefined,
  };
}

function migrateNode(tree: LayoutTree, source: YogaHostNode): Readonly<{
  node: LayoutNode;
  children: readonly ReturnType<typeof migrateNode>[];
}> {
  const node = tree.createNode({
    style: assertYoga32Converted(convertYoga32Style(source.style ?? {}, profile)).style,
    measure: source.measure,
  });
  const children = (source.children ?? []).map(child => migrateNode(tree, child));
  for (const child of children) tree.appendChild(node, child.node);
  return Object.freeze({ node, children: Object.freeze(children) });
}

beforeAll(async () => {
  await prepareLayout();
});

describe('Yoga 3.2 owned-tree migration', () => {
  it('materializes Yoga non-web defaults on every converted node', () => {
    expect(assertYoga32Converted(convertYoga32Style({}, profile)).style).toMatchObject({
      flexDirection: 'column',
      flexShrink: 0,
    });
  });

  it('converts a recursive host tree into native owned nodes with stable snapshots across resize', () => {
    const labelMeasure: LayoutMeasure = ({ width }) => ({ width: width.maximum, height: 24 });
    const source: YogaHostNode = {
      style: { flex_direction: 'row', gap: 8 },
      children: [
        { style: { width: 80, height: 80, flex_shrink: 0 } },
        {
          style: { flex_direction: 'column', flex_grow: 1, min_width: 80, height: 80 },
          children: [{ style: { flex_direction: 'column', min_height: 20 }, measure: labelMeasure }],
        },
      ],
    };
    expect(analyzeYoga32Tree(analyzeNode(source), profile)).toMatchObject({ convertible: true, nodeCount: 4 });

    const tree = createLayoutTree();
    const migrated = migrateNode(tree, source);
    const sidebar = migrated.children[0]!.node;
    const main = migrated.children[1]!.node;
    const label = migrated.children[1]!.children[0]!.node;

    const before = tree.calculateLayout({ root: migrated.node, width: 320, height: 80 });
    expect(before.getBox(sidebar)).toEqual({ x: 0, y: 0, width: 80, height: 80 });
    expect(before.getBox(main)).toEqual({ x: 88, y: 0, width: 232, height: 80 });
    expect(before.getBox(label)).toEqual({ x: 88, y: 0, width: 232, height: 24 });

    const after = tree.calculateLayout({ root: migrated.node, width: 240, height: 80 });
    expect(after.getBox(main)).toEqual({ x: 88, y: 0, width: 152, height: 80 });
    expect(after.getBox(label)).toEqual({ x: 88, y: 0, width: 152, height: 24 });
    expect(before.getBox(label)).toEqual({ x: 88, y: 0, width: 232, height: 24 });
    expect(after.changes.map(change => change.node)).toEqual([migrated.node, main, label]);

    tree.dispose();
    expect(() => after.getBox(label)).toThrow(/disposed/);
  });

  it('keeps unsupported Yoga reference-baseline and unknown inputs fail-closed before allocation', () => {
    const reference = convertYoga32Style({ isReferenceBaseline: true }, profile);
    const unknown = convertYoga32Style({ display: 'none' }, profile);
    expect(reference.value).toBeUndefined();
    expect(unknown.value).toBeUndefined();
    expect(() => assertYoga32Converted(reference)).toThrow(/reference-baseline/);
    expect(() => assertYoga32Converted(unknown)).toThrow(/migration policy/);
  });
});
