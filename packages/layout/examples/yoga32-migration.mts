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
} from '@pibbl/layout';

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

function migrateNode(tree: LayoutTree, source: YogaHostNode): LayoutNode {
  const node = tree.createNode({
    style: assertYoga32Converted(convertYoga32Style(source.style ?? {}, profile)).style,
    measure: source.measure,
  });
  for (const child of source.children ?? []) tree.appendChild(node, migrateNode(tree, child));
  return node;
}

const source: YogaHostNode = {
  style: { flex_direction: 'row', gap: 8 },
  children: [
    { style: { width: 80, height: 80, flex_shrink: 0 } },
    {
      style: { flex_direction: 'column', flex_grow: 1, min_width: 80, height: 80 },
      children: [
        {
          style: { flex_direction: 'column', min_height: 20 },
          measure: ({ width }) => ({ width: width.maximum, height: 24 }),
        },
      ],
    },
  ],
};

const report = analyzeYoga32Tree(analyzeNode(source), profile);
if (!report.convertible) throw new Error('Review Yoga diagnostics before constructing an owned tree.');

await prepareLayout();
const tree = createLayoutTree();
const root = migrateNode(tree, source);
const before = tree.calculateLayout({ root, width: 320, height: 80 });
const after = tree.calculateLayout({ root, width: 240, height: 80 });

// Snapshots remain immutable while callers apply the old or new geometry.
void before;
void after;
tree.dispose();
