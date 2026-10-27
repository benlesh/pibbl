import { Flex, Flow, Group, Rectangle, Text, computed, definePrimitive, signal, untracked, useCanvasContext, useConst, useLayoutBox, useReaction, type PibblNode, type SystemStyle } from '@pibbl/core';

type Name = 'flow' | 'peer';
interface LeafStyle extends SystemStyle {
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

function createFlowBaselineContent() {
  const first = signal(12), relative = signal(false), empty = signal(false);
  const firstLabel = computed(() => `First ${first.get()}`);
  const relativeLabel = computed(() => relative.get() ? 'Relative off' : 'Relative +10');
  const emptyLabel = computed(() => empty.get() ? 'Leaf mode' : 'Empty Flow');
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
  function FlowPanel() {
    const isEmpty = empty.get(), isRelative = relative.get();
    return <Flex style={{ left: 8, top: 56, width: 100, height: 80, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'first-baseline' }}>
      {isEmpty
        ? <Flow key="flow" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, direction: 'horizontal', wrap: false, alignItems: 'start' }} children={null} />
        : <Flow key="flow" style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, position: isRelative ? 'relative' : undefined, top: isRelative ? 10 : undefined, direction: 'horizontal', wrap: false, alignItems: 'start' }}><Leaf key="flow-leaf" name="flow" first={first.get()} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#a63758' }} /></Flow>}
      <Leaf key="peer" name="peer" first={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#19375b' }} />
    </Flex>;
  }
  const root = <CanvasBasis><Group>
    <Rectangle pointerEvents="none" style={{ width: 240, height: 180, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 8, top: 8, font: 'bold 16px sans-serif', fill: '#19375b' }}>Flow source baseline</Text>
    <Text pointerEvents="none" style={{ left: 8, top: 28, width: 220, wrap: true, lineHeight: 10, font: '9px sans-serif', fill: '#475569' }}>The first in-flow leaf supplies Flow’s baseline. An empty Flow falls back to its content bottom.</Text>
    <FlowPanel />
    <Rectangle onClick={() => first.update(value => value === 12 ? 22 : 12)} style={{ left: 8, top: 146, width: 68, height: 24, fill: '#19375b', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 13, top: 153, font: '9px sans-serif', fill: '#ffffff' }}>{firstLabel}</Text>
    <Rectangle onClick={() => relative.update(value => !value)} style={{ left: 82, top: 146, width: 72, height: 24, fill: '#426b61', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 87, top: 153, font: '9px sans-serif', fill: '#ffffff' }}>{relativeLabel}</Text>
    <Rectangle onClick={() => empty.update(value => !value)} style={{ left: 160, top: 146, width: 72, height: 24, fill: '#a63758', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 165, top: 153, font: '9px sans-serif', fill: '#ffffff' }}>{emptyLabel}</Text>
  </Group></CanvasBasis>;
  return { root, read: () => { const snapshot = Object.fromEntries(boxes); if (empty.get()) delete snapshot.flow; return JSON.stringify({ first: first.get(), relative: relative.get(), empty: empty.get(), boxes: snapshot, hits, basis }); } };
}

export function WasmFlowBaselineExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const content = useConst(createFlowBaselineContent);
  useReaction(() => {
    const panel = document.createElement('pre'); panel.style.cssText = 'font:10px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;box-sizing:border-box;padding:6px;background:#e7e5df;color:#19375b'; canvas.insertAdjacentElement('afterend', panel);
    const refresh = () => { panel.textContent = untracked(content.read); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.root;
}
