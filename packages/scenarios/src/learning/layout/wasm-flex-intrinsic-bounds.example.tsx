import { Flex, Rectangle, Text, computed, definePrimitive, fitContent, signal, untracked, useCanvasContext, useConst, useLayoutBox, useReaction, type BoxStyle, type FlexItemStyle, type PibblNode, type Signal, type SystemStyle } from '@pibbl/core';

type BoundStyle = SystemStyle & BoxStyle & FlexItemStyle;
type Resolved = SystemStyle & Readonly<{ width: number; height: number }>;
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

function createContent() {
  const phase = signal<0 | 1 | 2>(0), minimum = signal(40), maximum = signal(120), paint = signal('#426b61'), hits: string[] = [], boxes = new Map<string, Box>();
  let serial = 0, basis = new DOMMatrix(), calls: number[] = [];
  const label = computed(() => phase.get() === 0 ? 'Content 40 / 120' : phase.get() === 1 ? 'Content 60 / 140' : 'Content 100 / 160');
  const Basis = definePrimitive<{ readonly children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  const Leaf = definePrimitive<{ readonly minimum: Signal<number>; readonly maximum: Signal<number> }, BoundStyle, BoundStyle, Resolved>((_props) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial), point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    boxes.set('A', { x: point.x, y: point.y, width: box.width, height: box.height, stamp });
    return <Rectangle onClick={() => hits.push('A')} style={{ width: box.width, height: box.height, fill: '#a63758', cursor: 'pointer' }} />;
  }, {
    preserveSignalProps: ['minimum', 'maximum'],
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: ({ props }) => ({ status: 'measured' as const, minContent: { width: props.minimum.get(), height: 20 }, maxContent: { width: props.maximum.get(), height: 20 } }),
    measure: ({ constraints }) => { calls.push(constraints.maxWidth); return { status: 'measured' as const, size: { width: constraints.maxWidth, height: 20 } }; },
  });
  const Tail = definePrimitive<{}, BoundStyle, BoundStyle, Resolved>((_props) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial), point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    boxes.set('tail', { x: point.x, y: point.y, width: box.width, height: box.height, stamp });
    return <Rectangle onClick={() => hits.push('tail')} style={{ width: box.width, height: box.height, fill: paint, cursor: 'pointer' }} />;
  }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
  const children = [
    <Leaf key="A" minimum={minimum} maximum={maximum} style={{ width: 100, height: 'auto', minWidth: 'min-content', maxWidth: fitContent(80), flexGrow: 0, flexShrink: 0 }} />,
    <Tail key="tail" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />,
  ];
  function Button({ x, label: text, click, fill = '#19375b' }: { readonly x: number; readonly label: Signal<string> | string; readonly click: () => void; readonly fill?: string }) {
    return <><Rectangle onClick={click} style={{ left: x, top: 190, width: 100, height: 28, fill, cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: x + 7, top: 200, font: '10px sans-serif', fill: '#fff' }}>{text}</Text></>;
  }
  const root = <Basis><Rectangle pointerEvents="none" style={{ width: 240, height: 280, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 16, top: 14, font: 'bold 16px sans-serif', fill: '#19375b' }}>Intrinsic width bounds</Text>
    <Text pointerEvents="none" style={{ left: 16, top: 38, width: 208, wrap: true, lineHeight: 12, font: '10px sans-serif', fill: '#475569' }}>The red provider has width 100, but its min-content floor and fit-content cap resolve first. Green follows the final bound.</Text>
    <Flex style={{ left: 16, top: 108, width: 200, height: 20, flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'flex-start' }} children={children} />
    <Text pointerEvents="none" style={{ left: 16, top: 142, font: '11px monospace', fill: '#19375b' }}>{label}</Text>
    <Text pointerEvents="none" style={{ left: 16, top: 160, width: 208, wrap: true, lineHeight: 11, font: '9px sans-serif', fill: '#475569' }}>40 / 120 and 60 / 140 both cap at 80. At 100 / 160, the floor moves the green target.</Text>
    <Button x={16} label={label} click={() => { const next = ((phase.get() + 1) % 3) as 0 | 1 | 2; phase.set(next); minimum.set(next === 0 ? 40 : next === 1 ? 60 : 100); maximum.set(next === 0 ? 120 : next === 1 ? 140 : 160); }} />
    <Button x={124} label="Paint green" fill="#426b61" click={() => paint.update(value => value === '#426b61' ? '#39805d' : '#426b61')} />
  </Basis>;
  return { root, read: () => JSON.stringify({ phase: phase.get(), minimum: minimum.get(), maximum: maximum.get(), boxes: Object.fromEntries(boxes), hits, calls, basis }) };
}

export function WasmFlexIntrinsicBoundsExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement, content = useConst(createContent);
  useReaction(() => { const panel = document.createElement('pre'); panel.style.cssText = 'font:10px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;box-sizing:border-box;padding:6px;background:#e7e5df;color:#19375b'; canvas.insertAdjacentElement('afterend', panel); const refresh = () => { panel.textContent = untracked(content.read); }; refresh(); const timer = window.setInterval(refresh, 100); return () => { window.clearInterval(timer); panel.remove(); }; }, []);
  return content.root;
}
