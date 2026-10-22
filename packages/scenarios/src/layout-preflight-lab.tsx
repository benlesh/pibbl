import { Absolute, Flex, Rectangle, useLayoutBox, type Signal } from '@pibbl/core';

interface LabProps {
  width: Signal<number>; grow: Signal<number>; minimum: Signal<number>; nested: Signal<boolean>; direct: Signal<boolean>;
  evaluate: (width: number) => void; hit: () => void;
}
function PreflightProbe({ evaluate, hit }: {
  evaluate: (width: number) => void; hit: () => void;
  style: { width: number; height: number; minWidth: number; flexGrow: number };
}) {
  const box = useLayoutBox(); evaluate(box.width);
  return <Rectangle style={{ width: box.width, height: 30, fill: '#c45139' }} onClick={hit} />;
}

/** Deterministic public-surface fixture; the host owns fault/recovery controls. */
export function LayoutPreflightLab({ width, grow, minimum, nested, direct, evaluate, hit }: LabProps) {
  const probe = <PreflightProbe evaluate={evaluate} hit={hit} style={{ width: 80, height: 30, minWidth: 0, flexGrow: 1 }} />;
  const blue = <Rectangle style={{ width: 80, height: 30, minWidth: minimum, maxWidth: 80, flexGrow: grow, fill: '#344c77' }} />;
  const directRoot = direct.get();
  const content = nested.get() || directRoot ? <Flex style={{ width: width.get() + 80, height: 30 }}>
    {probe}
    <Flex key="inner" style={{ width: 80, height: 30, minWidth: 0, flexShrink: 0 }}>{blue}</Flex>
  </Flex> : <>
    <Flex style={{ width, height: 30 }}>{probe}</Flex>
    <Flex style={{ left: 140, width: 80, height: 30 }}>{blue}</Flex>
  </>;
  return directRoot ? content : <Absolute style={{ width: 240, height: 40 }}>{content}</Absolute>;
}
