import { Flex, Group, Rectangle, Text, computed, definePrimitive, signal, untracked, useCanvasContext, useConst, useLayoutBox, useReaction, type PibblNode, type SystemStyle } from '@pibbl/core';

type Name = 'A' | 'B' | 'C' | 'D';
interface LeafStyle extends SystemStyle { readonly width?: number; readonly height?: number; readonly minWidth?: number; readonly minHeight?: number; readonly flexBasis?: number; readonly flexGrow?: number; readonly flexShrink?: number; readonly fill?: string; }
type ResolvedLeafStyle = LeafStyle & { readonly width: number; readonly height: number };
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

function createLastBaselineContent() {
  const lastA = signal(30), direction = signal(0), wrapped = signal(false), structural = signal(false);
  const directions = [
    { label: 'Row LTR', flexDirection: 'row' as const, layoutDirection: 'ltr' as const },
    { label: 'Row RTL', flexDirection: 'row' as const, layoutDirection: 'rtl' as const },
    { label: 'Row reverse LTR', flexDirection: 'row-reverse' as const, layoutDirection: 'ltr' as const },
    { label: 'Row reverse RTL', flexDirection: 'row-reverse' as const, layoutDirection: 'rtl' as const },
  ] as const;
  const directionLabel = computed(() => directions[direction.get()]!.label);
  const wrapLabel = computed(() => wrapped.get() ? 'Wrap on' : 'Wrap off');
  const sourceLabel = computed(() => structural.get() ? 'Source: Flex root' : 'Source: direct');
  const lastLabel = computed(() => `A last ${lastA.get()}`);
  const boxes = new Map<Name, Box>(), hits: Name[] = [];
  let serial = 0, basis = new DOMMatrix();
  const CanvasBasis = definePrimitive<{ readonly children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  const Leaf = definePrimitive<{ readonly name: Name; readonly last: number }, LeafStyle, LeafStyle, ResolvedLeafStyle>((props, style) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    const point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    boxes.set(props.name, { x: point.x, y: point.y, width: box.width, height: box.height, stamp });
    return <><Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: 3, top: 3, font: '12px monospace', fill: '#ffffff' }}>{props.name}</Text></>;
  }, {
    resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
    measureBaselines: ({ props }) => ({ status: 'measured' as const, first: 0, last: props.last }),
  });
  function Panel() {
    const selected = directions[direction.get()]!, isWrapped = wrapped.get(), structuralRoot = structural.get();
    return <Flex style={{ left: 8, top: 48, width: 100, height: isWrapped ? 100 : 80, flexDirection: selected.flexDirection, flexWrap: isWrapped ? 'wrap' : 'nowrap', layoutDirection: selected.layoutDirection, alignItems: 'last-baseline', alignContent: 'flex-start' }}>
      {isWrapped ? <>
        <Leaf key="A" name="A" last={lastA.get() === 30 ? 10 : 20} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, fill: '#a63758' }} />
        <Leaf key="B" name="B" last={30} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#19375b' }} />
        <Leaf key="C" name="C" last={5} style={{ width: 60, height: 20, minWidth: 0, minHeight: 0, flexBasis: 60, flexGrow: 0, flexShrink: 0, fill: '#426b61' }} />
        <Leaf key="D" name="D" last={20} style={{ width: 40, height: 30, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#5f4b8b' }} />
      </> : <>
        {structuralRoot
          ? <Flex key="structural-root" style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <Rectangle key="badge" pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 8, fill: '#ffffff' }} />
              <Leaf key="A" name="A" last={lastA.get()} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#a63758' }} />
            </Flex>
          : <Leaf key="A" name="A" last={lastA.get()} style={{ width: 40, height: 40, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#a63758' }} />}
        <Leaf key="B" name="B" last={50} style={{ width: 40, height: 60, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, fill: '#19375b' }} />
      </>}
    </Flex>;
  }
  const root = <CanvasBasis><Group>
    <Rectangle pointerEvents="none" style={{ width: 280, height: 220, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 8, top: 8, font: 'bold 16px sans-serif', fill: '#19375b' }}>Last baseline</Text>
    <Text pointerEvents="none" style={{ left: 8, top: 28, width: 264, wrap: true, lineHeight: 10, font: '9px sans-serif', fill: '#475569' }}>Last offsets align each row at its safe end. Change A to move the shared baseline.</Text>
    <Panel />
    <Rectangle onClick={() => lastA.update(value => value === 30 ? 20 : 30)} style={{ left: 8, top: 160, width: 76, height: 24, fill: '#19375b', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 13, top: 167, font: '9px sans-serif', fill: '#ffffff' }}>{lastLabel}</Text>
    <Rectangle onClick={() => direction.update(value => (value + 1) % directions.length)} style={{ left: 90, top: 160, width: 104, height: 24, fill: '#426b61', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 95, top: 167, font: '9px sans-serif', fill: '#ffffff' }}>{directionLabel}</Text>
    <Rectangle onClick={() => { structural.set(false); wrapped.update(value => !value); }} style={{ left: 200, top: 160, width: 72, height: 24, fill: '#a63758', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 205, top: 167, font: '9px sans-serif', fill: '#ffffff' }}>{wrapLabel}</Text>
    <Rectangle onClick={() => { wrapped.set(false); structural.update(value => !value); }} style={{ left: 8, top: 190, width: 140, height: 24, fill: '#5f4b8b', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 13, top: 197, font: '9px sans-serif', fill: '#ffffff' }}>{sourceLabel}</Text>
  </Group></CanvasBasis>;
  return { root, read: () => JSON.stringify({ last: lastA.get(), direction: directions[direction.get()]!.label, wrapped: wrapped.get(), structural: structural.get(), boxes: Object.fromEntries(boxes), hits, basis }) };
}

export function WasmFlexLastBaselineExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const content = useConst(createLastBaselineContent);
  useReaction(() => {
    const panel = document.createElement('pre'); panel.style.cssText = 'font:10px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;box-sizing:border-box;padding:6px;background:#e7e5df;color:#19375b'; canvas.insertAdjacentElement('afterend', panel);
    const refresh = () => { panel.textContent = untracked(content.read); }; refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.root;
}
