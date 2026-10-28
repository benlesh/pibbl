import { Flex, Group, Rectangle, Text, computed, definePrimitive, signal, untracked, useCanvasContext, useConst, useLayoutBox, useReaction, type PibblNode, type SystemStyle } from '@pibbl/core';

type Name = 'A' | 'B';
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

function createColumnBaselineFallbackContent() {
  const mode = signal(0), wrapMode = signal(0);
  const modes = [
    { label: 'Column LTR', flexDirection: 'column' as const, layoutDirection: 'ltr' as const },
    { label: 'Column RTL', flexDirection: 'column' as const, layoutDirection: 'rtl' as const },
    { label: 'Column reverse LTR', flexDirection: 'column-reverse' as const, layoutDirection: 'ltr' as const },
    { label: 'Column reverse RTL', flexDirection: 'column-reverse' as const, layoutDirection: 'rtl' as const },
  ] as const;
  const wraps = ['nowrap', 'wrap', 'wrap-reverse'] as const;
  const modeLabel = computed(() => modes[mode.get()]!.label);
  const wrapLabel = computed(() => wraps[wrapMode.get()]!);
  const boxes = new Map<Name, Box>(), hits: Name[] = [];
  let serial = 0, baselineQueries = 0, basis = new DOMMatrix();
  const CanvasBasis = definePrimitive<{ readonly children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  const Leaf = definePrimitive<{ readonly name: Name }, LeafStyle, LeafStyle, ResolvedLeafStyle>((props, style) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    const point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    boxes.set(props.name, { x: point.x, y: point.y, width: box.width, height: box.height, stamp });
    return <><Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: 3, top: 3, font: '12px monospace', fill: '#ffffff' }}>{props.name}</Text></>;
  }, {
    resolveStyle: (style, context) => ({ ...style, width: context.allocation.width, height: context.allocation.height }),
    measureBaselines: () => { baselineQueries++; throw new Error('outer-column baseline fallback must not query child baselines'); },
  });
  function Panel() {
    const selected = modes[mode.get()]!, wrap = wraps[wrapMode.get()]!, isWrapped = wrap !== 'nowrap';
    return <Flex style={{ left: 8, top: 48, width: 100, height: 100, flexDirection: selected.flexDirection, flexWrap: wrap, layoutDirection: selected.layoutDirection, alignItems: 'first-baseline' }}>
      <Leaf key="A" name="A" style={{ width: 40, height: isWrapped ? 60 : 20, minWidth: 0, minHeight: 0, flexBasis: isWrapped ? 60 : 20, flexGrow: 0, flexShrink: 0, fill: '#a63758' }} />
      <Leaf key="B" name="B" style={{ width: 60, height: isWrapped ? 60 : 40, minWidth: 0, minHeight: 0, flexBasis: isWrapped ? 60 : 40, flexGrow: 0, flexShrink: 0, fill: '#19375b' }} />
    </Flex>;
  }
  const root = <CanvasBasis><Group>
    <Rectangle pointerEvents="none" style={{ width: 260, height: 185, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 8, top: 8, font: 'bold 16px sans-serif', fill: '#19375b' }}>Column baseline fallback</Text>
    <Text pointerEvents="none" style={{ left: 8, top: 28, width: 244, wrap: true, lineHeight: 10, font: '9px sans-serif', fill: '#475569' }}>Outer columns treat first baseline as logical flex-start. Their child baseline providers are not queried.</Text>
    <Panel />
    <Rectangle onClick={() => mode.update(value => (value + 1) % modes.length)} style={{ left: 8, top: 155, width: 120, height: 24, fill: '#19375b', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 13, top: 162, font: '9px sans-serif', fill: '#ffffff' }}>{modeLabel}</Text>
    <Rectangle onClick={() => wrapMode.update(value => (value + 1) % wraps.length)} style={{ left: 136, top: 155, width: 116, height: 24, fill: '#426b61', cursor: 'pointer' }} />
    <Text pointerEvents="none" style={{ left: 141, top: 162, font: '9px sans-serif', fill: '#ffffff' }}>{wrapLabel}</Text>
  </Group></CanvasBasis>;
  return {
    root,
    read: () => JSON.stringify({ mode: mode.get(), wrap: wraps[wrapMode.get()]!, boxes: Object.fromEntries(boxes), hits, baselineQueries, basis }),
  };
}

export function WasmColumnBaselineFallbackExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const content = useConst(createColumnBaselineFallbackContent);
  useReaction(() => {
    const panel = document.createElement('pre'); panel.style.cssText = 'font:10px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;box-sizing:border-box;padding:6px;background:#e7e5df;color:#19375b'; canvas.insertAdjacentElement('afterend', panel);
    const refresh = () => { panel.textContent = untracked(content.read); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.root;
}
