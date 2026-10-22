import { Absolute, Flex, Group, HtmlBox, Rectangle, useLayoutBox, defineLayoutComponent, type FlexStyle, type PibblNodeInput, type Signal } from '@pibbl/core';

interface LabProps {
  width: Signal<number>; grow: Signal<number>; minimum: Signal<number>; nested: Signal<boolean>; direct: Signal<boolean>; described: Signal<boolean>;
  evaluate: (width: number) => void; hit: () => void;
}
function PreflightProbe({ evaluate, hit }: {
  evaluate: (width: number) => void; hit: () => void;
  style: { width: number; height: number; minWidth: number; flexGrow: number };
}) {
  const box = useLayoutBox(); evaluate(box.width);
  return <Rectangle style={{ width: box.width, height: 30, fill: '#c45139' }} onClick={hit} />;
}

const DescribedCard = defineLayoutComponent((props: { style: FlexStyle; children: PibblNodeInput }) => <Flex style={props.style}>{props.children}</Flex>);

/** Deterministic public-surface fixture; the host owns fault/recovery controls. */
export function LayoutPreflightLab({ width, grow, minimum, nested, direct, described, evaluate, hit }: LabProps) {
  const probe = <PreflightProbe evaluate={evaluate} hit={hit} style={{ width: 80, height: 30, minWidth: 0, flexGrow: 1 }} />;
  const blue = <Rectangle style={{ width: 80, height: 30, minWidth: minimum, maxWidth: 80, flexGrow: grow, fill: '#344c77' }} />;
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
