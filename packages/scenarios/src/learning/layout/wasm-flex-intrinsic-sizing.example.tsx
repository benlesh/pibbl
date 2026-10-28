import {
  Flex,
  Group,
  Rectangle,
  Text,
  computed,
  definePrimitive,
  fitContent,
  signal,
  untracked,
  useCanvasContext,
  useConst,
  useLayoutBox,
  useReaction,
  type BoxStyle,
  type FlexItemStyle,
  type PibblNode,
  type Signal,
  type SystemStyle,
} from '@pibbl/core';

type Name = 'min' | 'fit' | 'tail';
type Direction = Readonly<{ flexDirection: 'row' | 'row-reverse'; layoutDirection: 'ltr' | 'rtl'; label: string }>;
type LeafStyle = SystemStyle & BoxStyle & FlexItemStyle;
type ResolvedLeafStyle = SystemStyle & Readonly<{ width: number; height: number }>;
type Box = Readonly<{ x: number; y: number; width: number; height: number; stamp: number }>;

const directions: readonly Direction[] = [
  { flexDirection: 'row', layoutDirection: 'ltr', label: 'Row · LTR' },
  { flexDirection: 'row-reverse', layoutDirection: 'ltr', label: 'Reverse · LTR' },
  { flexDirection: 'row', layoutDirection: 'rtl', label: 'Row · RTL' },
  { flexDirection: 'row-reverse', layoutDirection: 'rtl', label: 'Reverse · RTL' },
];

function createIntrinsicSizingContent() {
  const minimum = signal(40), maximum = signal(120), direction = signal(0), paint = signal('#426b61');
  const boxes = new Map<Name, Box>(), hits: Name[] = [];
  let serial = 0, basis = new DOMMatrix(), intrinsicCalls = 0;
  const ContentLabel = computed(() => minimum.get() === 40 ? 'Content 40 / 120' : 'Content 60 / 140');
  const DirectionLabel = computed(() => directions[direction.get()]!.label);
  const CanvasBasis = definePrimitive<{ readonly children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  const IntrinsicLeaf = definePrimitive<{ readonly name: 'min' | 'fit'; readonly minimum: Signal<number>; readonly maximum: Signal<number> }, LeafStyle, LeafStyle, ResolvedLeafStyle>((props, _style) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    const point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    boxes.set(props.name, { x: point.x, y: point.y, width: box.width, height: box.height, stamp });
    return <Rectangle onClick={() => hits.push(props.name)} style={{ width: box.width, height: box.height, fill: props.name === 'min' ? '#a63758' : '#426b61', cursor: 'pointer' }} />;
  }, {
    preserveSignalProps: ['minimum', 'maximum'],
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measure: ({ constraints }) => ({ status: 'measured' as const, size: { width: constraints.maxWidth, height: 20 } }),
    measureIntrinsic: ({ props }) => {
      intrinsicCalls++;
      return { status: 'measured' as const, minContent: { width: props.minimum.get(), height: 20 }, maxContent: { width: props.maximum.get(), height: 20 } };
    },
  });
  const Tail = definePrimitive<{ readonly fill: Signal<string> }, LeafStyle, LeafStyle, ResolvedLeafStyle>((props, _style) => {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    const point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    boxes.set('tail', { x: point.x, y: point.y, width: box.width, height: box.height, stamp });
    return <Rectangle onClick={() => hits.push('tail')} style={{ width: box.width, height: box.height, fill: props.fill, cursor: 'pointer' }} />;
  }, { preserveSignalProps: ['fill'], resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
  function Button({ x, y = 170, label, click, fill = '#19375b' }: { readonly x: number; readonly y?: number; readonly label: Signal<string> | string; readonly click: () => void; readonly fill?: string }) {
    return <><Rectangle onClick={click} style={{ left: x, top: y, width: 104, height: 28, fill, cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: x + 7, top: y + 10, font: '10px sans-serif', fill: '#ffffff' }}>{label}</Text></>;
  }
  // These authored descriptors are stable across direction and paint updates. The
  // Flex owner still resolves its live direction, while the measurement cache can
  // safely retain scalar paired-provider inputs.
  const sizingChildren = [
    <IntrinsicLeaf key="min" name="min" minimum={minimum} maximum={maximum} style={{ width: 'min-content', height: 20, flexGrow: 0, flexShrink: 0 }} />,
    <IntrinsicLeaf key="fit" name="fit" minimum={minimum} maximum={maximum} style={{ flexBasis: fitContent(80), height: 20, flexGrow: 0, flexShrink: 0 }} />,
    <Tail key="tail" fill={paint} style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />,
  ];
  function SizingRow() {
    const current = directions[direction.get()]!;
    return <Flex style={{ left: 16, top: 84, width: 220, height: 20, flexDirection: current.flexDirection, layoutDirection: current.layoutDirection, flexWrap: 'nowrap', alignItems: 'flex-start' }} children={sizingChildren} />;
  }
  const root = <CanvasBasis><Group>
    <Rectangle pointerEvents="none" style={{ width: 260, height: 250, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 16, top: 14, font: 'bold 16px sans-serif', fill: '#19375b' }}>Intrinsic sizing</Text>
    <Text pointerEvents="none" style={{ left: 16, top: 36, width: 228, wrap: true, lineHeight: 11, font: '10px sans-serif', fill: '#475569' }}>Red uses min-content. Blue uses fitContent(80), capped between the same measured contributions. Green follows the resolved allocation.</Text>
    <SizingRow />
    <Text pointerEvents="none" style={{ left: 16, top: 116, font: '11px monospace', fill: '#19375b' }}>{ContentLabel}</Text>
    <Text pointerEvents="none" style={{ left: 16, top: 134, font: '11px monospace', fill: '#19375b' }}>{DirectionLabel}</Text>
    <Text pointerEvents="none" style={{ left: 16, top: 151, font: '9px sans-serif', fill: '#475569' }}>Click each allocation; paint changes only green.</Text>
    <Button x={16} label={ContentLabel} click={() => { minimum.update(value => value === 40 ? 60 : 40); maximum.update(value => value === 120 ? 140 : 120); }} />
    <Button x={128} label={DirectionLabel} click={() => direction.update(value => (value + 1) % directions.length)} fill="#426b61" />
    <Button x={16} y={208} label="Paint green" click={() => paint.update(value => value === '#426b61' ? '#39805d' : '#426b61')} fill="#6e3e79" />
  </Group></CanvasBasis>;
  return {
    root,
    read: () => JSON.stringify({ minimum: minimum.get(), maximum: maximum.get(), direction: directions[direction.get()]!.label, boxes: Object.fromEntries(boxes), hits, intrinsicCalls, basis }),
  };
}

export function WasmFlexIntrinsicSizingExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const content = useConst(createIntrinsicSizingContent);
  useReaction(() => {
    const panel = document.createElement('pre');
    panel.style.cssText = 'font:10px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;box-sizing:border-box;padding:6px;background:#e7e5df;color:#19375b';
    canvas.insertAdjacentElement('afterend', panel);
    const refresh = () => { panel.textContent = untracked(content.read); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.root;
}
