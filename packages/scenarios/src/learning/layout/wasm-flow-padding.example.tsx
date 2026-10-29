import { Absolute, Flow, Grid, Group, Overlay, Rectangle, Text, computed, definePrimitive, signal, untracked, useCanvasContext, useConst, useLayoutBox, useReaction, type BoxStyle, type GridItemStyle, type PibblNode, type Signal, type SystemStyle } from '@pibbl/core';

function createFlowPaddingContent() {
  const containerWidth = signal(200), padding = signal<0 | 20 | '10%'>(0), container = signal<'flow' | 'grid' | 'absolute' | 'overlay'>('flow'), paddingOwner = signal<'own' | 'child'>('own'), ink = signal('#a63758');
  const paddingLabel = computed(() => padding.get() === 0 ? 'Pad 20' : padding.get() === 20 ? 'Pad 10%' : 'Pad 0');
  const widthLabel = computed(() => containerWidth.get() === 200 ? 'Width 160' : 'Width 200');
  const containerLabel = computed(() => container.get() === 'flow' ? 'Grid' : container.get() === 'grid' ? 'Absolute' : container.get() === 'absolute' ? 'Overlay' : 'Flow');
  const paddingOwnerLabel = computed(() => paddingOwner.get() === 'own' ? 'Child pad' : 'Own pad');
  let serial = 0, hits = 0, basis = new DOMMatrix(), box = { x: 0, y: 0, width: 0, height: 0, stamp: 0 };
  const diagnostics = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const CanvasBasis = definePrimitive<{ children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  const Content = definePrimitive<{}, BoxStyle & GridItemStyle, BoxStyle & GridItemStyle, SystemStyle & { width: number; height: number }>((_props, style) => {
    const allocation = useLayoutBox(), transform = useCanvasContext().getTransform(), stamp = useConst(() => ++serial);
    const point = basis.inverse().transformPoint({ x: transform.e, y: transform.f });
    box = { x: point.x, y: point.y, width: allocation.width, height: allocation.height, stamp };
    return <Rectangle onClick={() => { hits++; }} style={{ width: style.width, height: style.height, fill: ink, cursor: 'pointer' }} />;
  }, { resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }) });
  function Button({ x, label, onClick }: { readonly x: number; readonly label: string | Signal<string>; onClick(): void }) {
    return <><Rectangle onClick={onClick} style={{ left: x, top: 104, width: 56, height: 28, fill: '#19375b', cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: x + 5, top: 113, font: '9px sans-serif', fill: '#ffffff' }}>{label}</Text></>;
  }
  function ContainerButton() {
    return <><Rectangle onClick={() => container.update(value => value === 'flow' ? 'grid' : value === 'grid' ? 'absolute' : value === 'absolute' ? 'overlay' : 'flow')} style={{ left: 136, top: 76, width: 56, height: 24, fill: '#19375b', cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: 140, top: 83, font: '9px sans-serif', fill: '#ffffff' }}>{containerLabel}</Text></>;
  }
  function PaddingOwnerButton() {
    return <><Rectangle onClick={() => paddingOwner.update(value => value === 'own' ? 'child' : 'own')} style={{ left: 8, top: 76, width: 112, height: 24, fill: '#19375b', cursor: 'pointer' }} /><Text pointerEvents="none" style={{ left: 16, top: 83, font: '9px sans-serif', fill: '#ffffff' }}>{paddingOwnerLabel}</Text></>;
  }
  function childPadding(grid: boolean) {
    return <Flow key="child-box" style={{ width: 160, height: 80, boxSizing: 'border-box', padding, direction: 'horizontal', wrap: false, alignItems: 'start', gridColumnStart: grid ? 1 : undefined, gridRowStart: grid ? 1 : undefined }}><Content key="content" style={{ width: '100%', height: '100%' }} /></Flow>;
  }
  function FlowPadding() {
    const childMode = paddingOwner.get() === 'child';
    return <Flow style={{ width: containerWidth, height: 80, boxSizing: 'border-box', padding: childMode ? 0 : padding, direction: 'horizontal', wrap: false, alignItems: 'start' }}>{childMode ? childPadding(false) : <Content key="content" style={{ width: 100, height: 40 }} />}</Flow>;
  }
  function GridPadding() {
    const childMode = paddingOwner.get() === 'child';
    return <Grid style={{ width: containerWidth, height: 80, boxSizing: 'border-box', padding: childMode ? 0 : padding, gridTemplateColumns: [childMode ? 160 : 100], gridTemplateRows: [childMode ? 80 : 40] }}>{childMode ? childPadding(true) : <Content key="content" style={{ width: 100, height: 40, gridColumnStart: 1, gridRowStart: 1 }} />}</Grid>;
  }
  function AbsolutePadding() {
    const childMode = paddingOwner.get() === 'child';
    return <Absolute style={{ width: containerWidth, height: 80, boxSizing: 'border-box', padding: childMode ? 0 : padding }}>{childMode ? childPadding(false) : <Content key="content" style={{ width: 100, height: 40 }} />}</Absolute>;
  }
  function OverlayPadding() {
    const childMode = paddingOwner.get() === 'child';
    return <Overlay style={{ width: containerWidth, height: 80, boxSizing: 'border-box', padding: childMode ? 0 : padding, alignItems: 'start', justifyItems: 'start' }}>{childMode ? childPadding(false) : <Content key="content" style={{ width: 100, height: 40 }} />}</Overlay>;
  }
  function PaddingContainer() {
    const kind = container.get();
    if (kind === 'flow') return <FlowPadding />;
    if (kind === 'grid') return <GridPadding />;
    if (kind === 'absolute') return <AbsolutePadding />;
    return <OverlayPadding />;
  }
  const node = <CanvasBasis><Group>
    <Rectangle pointerEvents="none" style={{ width: 200, height: 160, fill: '#f3f0e8' }} />
    <Text pointerEvents="none" style={{ left: 8, top: 138, width: 184, wrap: true, lineHeight: 10, font: '9px sans-serif', fill: '#475569' }}>Own: surface width. Child: parent content or Grid cell width.</Text>
    <Rectangle pointerEvents="none" style={{ width: containerWidth, height: 80, stroke: '#a0aab8', strokeWidth: 1 }} />
    <PaddingContainer />
    <PaddingOwnerButton />
    <ContainerButton />
    <Button x={8} label={paddingLabel} onClick={() => padding.update(value => value === 0 ? 20 : value === 20 ? '10%' : 0)} />
    <Button x={72} label={widthLabel} onClick={() => containerWidth.update(value => value === 200 ? 160 : 200)} />
    <Button x={136} label="Paint" onClick={() => ink.update(value => value === '#a63758' ? '#426b61' : '#a63758')} />
  </Group></CanvasBasis>;
  return { node, read: () => JSON.stringify({ allocationWidth: 200, container: container.get(), paddingOwner: paddingOwner.get(), containerWidth: containerWidth.get(), padding: padding.get(), box, hits, basis, layout: diagnostics?.() ?? {} }) };
}

export function WasmFlowPaddingExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const content = useConst(createFlowPaddingContent);
  useReaction(() => {
    const panel = document.createElement('pre'); panel.style.cssText = 'font:10px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;box-sizing:border-box;padding:6px;background:#e7e5df;color:#19375b'; canvas.insertAdjacentElement('afterend', panel);
    const refresh = () => { panel.textContent = untracked(content.read); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.node;
}
