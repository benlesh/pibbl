import { Flex, Grid, Group, Rectangle, Text, computed, definePrimitive, signal, untracked, useCanvasContext, useConst, useLayoutBox, useReaction, type GridItemStyle, type PibblNode, type SystemStyle } from '@pibbl/core';

type Name = 'source' | 'peer';
interface LeafStyle extends SystemStyle, GridItemStyle {
  readonly width?: number;
  readonly height?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly flexBasis?: number;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly fill?: string;
}
type ResolvedLeafStyle = LeafStyle & { readonly width: number; readonly height: number };
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

function createGridBaselineContent() {
  const first = signal(12), empty = signal(false);
  const firstLabel = computed(() => `First ${first.get()}`);
  const emptyLabel = computed(() => empty.get() ? 'Restore Grid' : 'Empty Grid');
  const boxes = new Map<Name, Box>(), hits: Name[] = [];
  let serial = 0, basis = new DOMMatrix();
  const CanvasBasis = definePrimitive<{ readonly children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  const Leaf = definePrimitive<{ readonly name: Name; readonly first: number }, LeafStyle, LeafStyle, ResolvedLeafStyle>((props, style) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    const point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    boxes.set(props.name, { x: point.x, y: point.y, width: box.width, height: box.height, stamp });
    return <><Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: 2, top: 2, font: '12px monospace', fill: '#ffffff' }}>{String(props.first)}</Text></>;
  }, {
    resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
    measureBaselines: ({ props }) => ({ status: 'measured' as const, first: props.first, last: props.first }),
  });
  const VisualCell = definePrimitive<{}, LeafStyle, LeafStyle, ResolvedLeafStyle>((_props, style) => {
    const box = useLayoutBox();
    return <Rectangle style={{ width: box.width, height: box.height, fill: style.fill }} />;
  }, { resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }) });
  function GridPanel() {
    const isEmpty = empty.get();
    return <Flex style={{ left: 8, top: 62, width: 180, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      {isEmpty
        ? <Grid key="grid" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, gridTemplateColumns: [40], gridTemplateRows: [40] }} children={null} />
        : <Grid key="grid" style={{ width: 100, height: 60, minWidth: 0, minHeight: 0, flexBasis: 100, flexGrow: 0, flexShrink: 0, gridTemplateColumns: [40, 60], gridTemplateRows: [20, 40] }}>
          <Leaf key="source" name="source" first={first.get()} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, gridColumnStart: 2, gridRowStart: 2, fill: '#a63758' }} />
          <VisualCell key="visual" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, gridColumnStart: 1, gridRowStart: 1, fill: '#e7e5df' }} />
        </Grid>}
      <Leaf key="peer" name="peer" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#19375b' }} />
    </Flex>;
  }
  const root = <CanvasBasis><Group>
    <Rectangle pointerEvents="none" style={{ width: 280, height: 200, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 8, top: 8, font: 'bold 16px sans-serif', fill: '#19375b' }}>Grid source baseline</Text>
    <Text pointerEvents="none" style={{ left: 8, top: 28, width: 264, wrap: true, lineHeight: 10, font: '9px sans-serif', fill: '#475569' }}>Red source A is declared first but sits in row two. Pale D is visibly first in row one. The outer peer follows A’s source baseline.</Text>
    <GridPanel />
    <Text pointerEvents="none" style={{ left: 8, top: 148, font: '9px sans-serif', fill: '#475569' }}>Source A selects the baseline; cell order does not.</Text>
    <Rectangle onClick={() => first.update(value => value === 12 ? 22 : 12)} style={{ left: 8, top: 168, width: 76, height: 24, fill: '#19375b', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 14, top: 175, font: '9px sans-serif', fill: '#ffffff' }}>{firstLabel}</Text>
    <Rectangle onClick={() => empty.update(value => !value)} style={{ left: 92, top: 168, width: 88, height: 24, fill: '#426b61', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 98, top: 175, font: '9px sans-serif', fill: '#ffffff' }}>{emptyLabel}</Text>
  </Group></CanvasBasis>;
  return { root, read: () => { const snapshot = Object.fromEntries(boxes); if (empty.get()) delete snapshot.source; return JSON.stringify({ first: first.get(), empty: empty.get(), boxes: snapshot, hits, basis }); } };
}

export function WasmGridBaselineExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const content = useConst(createGridBaselineContent);
  useReaction(() => {
    const panel = document.createElement('pre'); panel.style.cssText = 'font:10px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;box-sizing:border-box;padding:6px;background:#e7e5df;color:#19375b'; canvas.insertAdjacentElement('afterend', panel);
    const refresh = () => { panel.textContent = untracked(content.read); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.root;
}
