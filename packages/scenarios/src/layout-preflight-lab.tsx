import { Absolute, Flex, Flow, Grid, Group, HtmlBox, Layer, Overlay, Rectangle, useLayoutBox, defineLayoutComponent, type FlexStyle, type PibblNodeInput, type Signal } from '@pibbl/core';

interface LabProps {
  width: Signal<number>; grow: Signal<number>; minimum: Signal<number>; nested: Signal<boolean>; direct: Signal<boolean>; described: Signal<boolean>; layer: Signal<boolean>; grid: Signal<boolean>; gridRoot: Signal<boolean>; flowRoot: Signal<boolean>; overlayRoot: Signal<boolean>; absoluteRoot: Signal<boolean>; layerGrid: Signal<boolean>; directLayer: Signal<boolean>; flow: Signal<boolean>; nativeGrid: Signal<boolean>; nativeFlow: Signal<boolean>; nativeSpan: Signal<boolean>; nativeFill: Signal<string>; nativeWidth: (index: number, width: number) => void; nativeHit: () => void;
  evaluate: (width: number) => void; hit: () => void; layerHit: () => void;
}
function PreflightProbe({ evaluate, hit }: {
  evaluate: (width: number) => void; hit: () => void;
  style: { width: number; height: number; minWidth: number; flexGrow: number; gridColumnStart?: number; gridRowStart?: number };
}) {
  const box = useLayoutBox(); evaluate(box.width);
  return <Rectangle style={{ width: box.width, height: 30, fill: '#c45139' }} onClick={hit} />;
}

const DescribedCard = defineLayoutComponent((props: { style: FlexStyle; children: PibblNodeInput }) => <Flex style={props.style}>{props.children}</Flex>);

/** Deterministic public-surface fixture; the host owns fault/recovery controls. */
export function LayoutPreflightLab({ width, grow, minimum, nested, direct, described, layer, grid, gridRoot, flowRoot, overlayRoot, absoluteRoot, layerGrid, directLayer, flow, nativeGrid, nativeFlow, nativeSpan, nativeFill, nativeWidth, nativeHit, evaluate, hit, layerHit }: LabProps) {
  if (nativeFlow.get()) return <Flow style={{ width, height: 60, direction: 'horizontal', wrap: true, gap: 5, lineGap: 7, alignItems: 'center' }}>
    <Rectangle style={{ width: 30, height: 20, fill: 'red' }} />
    <Rectangle style={{ width: 20, height: 10, fill: 'green' }} />
    <Rectangle style={{ width: 30, height: 15, fill: nativeFill }} onClick={nativeHit} />
  </Flow>;
  if (nativeGrid.get()) return <NativeGridTracksLab width={width} span={nativeSpan} fill={nativeFill} report={nativeWidth} hit={nativeHit} />;
  const probe = <PreflightProbe evaluate={evaluate} hit={hit} style={{ width: 80, height: 30, minWidth: 0, flexGrow: 1 }} />;
  const blue = <Rectangle style={{ width: 80, height: 30, minWidth: minimum, maxWidth: 80, flexGrow: grow, fill: '#344c77' }} onClick={layerHit} />;
  if (absoluteRoot.get()) return <Absolute style={{ width: 240, height: 40 }}>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Overlay style={{ left: 130, width: 100, height: 40, justifyItems: 'center', alignItems: 'end' }}>
      <Absolute style={{ width: 80, height: 30 }}><Grid style={{ width: 80, height: 30, gridTemplateColumns: ['1fr'], gridTemplateRows: [30] }}>
        <Flex style={{ width: '100%', height: 30, gridColumnStart: 1, gridRowStart: 1 }}>{blue}</Flex>
      </Grid></Absolute>
    </Overlay>
  </Absolute>;
  if (overlayRoot.get()) return <Absolute style={{ width: 240, height: 40 }}>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Overlay style={{ left: 130, width: 100, height: 40, justifyItems: 'center', alignItems: 'end' }}>
      <Grid style={{ width: 80, height: 30, gridTemplateColumns: ['1fr'], gridTemplateRows: [30] }}>
        <Flex style={{ width: '100%', height: 30, gridColumnStart: 1, gridRowStart: 1 }}>{blue}</Flex>
      </Grid>
    </Overlay>
  </Absolute>;
  if (flowRoot.get()) return <Absolute style={{ width: 240, height: 40 }}>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Flow style={{ left: 140, width: 80, height: 30 }}><Flex style={{ width: '100%', height: 30 }}>{blue}</Flex></Flow>
  </Absolute>;
  if (gridRoot.get()) return <Absolute style={{ width: 240, height: 40 }}>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Grid style={{ left: 140, width: 80, height: 30, gridTemplateColumns: ['1fr'], gridTemplateRows: [30] }}>
      <Flex style={{ width: '100%', height: 30, gridColumnStart: 1, gridRowStart: 1 }}>{blue}</Flex>
    </Grid>
  </Absolute>;
  if (flow.get()) return <Flow style={{ width: 240, height: 30, direction: 'horizontal', wrap: false }}>
    <PreflightProbe evaluate={evaluate} hit={hit} style={{ width: width.get(), height: 30, minWidth: 0, flexGrow: 0 }} />
    <Flex style={{ width: 80, height: 30 }}>{blue}</Flex>
  </Flow>;
  if (grid.get()) return <Grid style={{ width: width.get() + 80, height: 30, gridTemplateColumns: [width.get(), 80], gridTemplateRows: [30] }}>
    <PreflightProbe evaluate={evaluate} hit={hit} style={{ width: width.get(), height: 30, minWidth: 0, flexGrow: 0, gridColumnStart: 1, gridRowStart: 1 }} />
    <Flex style={{ width: 80, height: 30, gridColumnStart: 2, gridRowStart: 1 }}>{blue}</Flex>
  </Grid>;
  const LayerEntry = directLayer.get() ? Layer : Absolute;
  if (layerGrid.get() || directLayer.get()) return <LayerEntry style={{ width: 240, height: 40 }}>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Layer style={{ left: 130, width: 100, height: 40 }}>
      <Grid style={{ left: 10, top: 10, width: 80, height: 30, gridTemplateColumns: ['1fr'], gridTemplateRows: [30] }}>
        <Flex style={{ width: '100%', height: 30, gridColumnStart: 1, gridRowStart: 1 }}>{blue}</Flex>
      </Grid>
    </Layer>
  </LayerEntry>;
  if (layer.get()) return <Absolute style={{ width: 240, height: 40 }}>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Layer style={{ left: 140, width: 100, height: 30 }}><Flex style={{ width: 80, height: 30 }}>{blue}</Flex></Layer>
  </Absolute>;
  const directRoot = direct.get(), describedRoot = described.get();
  const inner = describedRoot ? <DescribedCard key="inner" style={{ width: 80, height: 30, minWidth: 0, flexShrink: 0 }}>{blue}</DescribedCard> :
    <Flex key="inner" style={{ width: 80, height: 30, minWidth: 0, flexShrink: 0 }}>{blue}</Flex>;
  const content = nested.get() || directRoot || describedRoot ? <Flex style={{ width: width.get() + 80, height: 30 }}>
    {probe}
    {inner}
  </Flex> : <>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Flex style={{ left: 140, width: 80, height: 30 }}>{blue}</Flex>
  </>;
  return directRoot ? content : <Absolute style={{ width: 240, height: 40 }}>{content}</Absolute>;
}


/** Public HTML publication failure fixture; overlay ownership stays with the host. */
export function HtmlProjectionLab({ overflow, mount, laterMount }: {
  overflow: Signal<boolean>;
  mount: (element: HTMLDivElement, data: boolean, signal: AbortSignal) => (data: boolean) => void;
  laterMount: (element: HTMLDivElement, data: number, signal: AbortSignal) => (data: number) => void;
}) {
  const failed = overflow.get();
  return <Group>
    <HtmlBox key="earlier" mount={mount} data={failed} style={{ width: 100, height: 30 }} />
    <Absolute><HtmlBox mount={laterMount} data={0} pointerEvents="none" style={{ left: 110, width: 1e300, height: 2, scaleX: failed ? 1e20 : 1 }} /></Absolute>
  </Group>;
}


function NativeGridCell({ index, color, report, hit }: {
  index: number; color: string | Signal<string>; report: (index: number, width: number) => void; hit: () => void;
  style: { width: string; height: number; gridColumnStart: number; gridRowStart: number; gridColumnSpan?: number; gridRowSpan?: number };
}) {
  const box = useLayoutBox(); report(index, box.width);
  return <Rectangle style={{ width: box.width, height: box.height, fill: color }} onClick={index === 2 ? hit : undefined} />;
}
function NativeGridTracksLab({ width, span, fill, report, hit }: {
  width: Signal<number>; span: Signal<boolean>; fill: Signal<string>; report: (index: number, width: number) => void; hit: () => void;
}) {
  if (span.get()) return <Grid style={{ width, height: 45, gridTemplateColumns: [20, '25%', '1fr'], gridTemplateRows: [20,20], columnGap: 10, rowGap: 5 }}>
    <NativeGridCell index={2} color={fill} report={report} hit={hit} style={{ width: '100%', height: 45, gridColumnStart: 2, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 2 }} />
  </Grid>;
  return <Grid style={{ width, height: 30, gridTemplateColumns: [20, '25%', '1fr'], gridTemplateRows: [30], columnGap: 10 }}>
    <NativeGridCell index={0} color={fill} report={report} hit={hit} style={{ width: '100%', height: 30, gridColumnStart: 1, gridRowStart: 1 }} />
    <NativeGridCell index={1} color="green" report={report} hit={hit} style={{ width: '100%', height: 30, gridColumnStart: 2, gridRowStart: 1 }} />
    <NativeGridCell index={2} color="blue" report={report} hit={hit} style={{ width: '100%', height: 30, gridColumnStart: 3, gridRowStart: 1 }} />
  </Grid>;
}
