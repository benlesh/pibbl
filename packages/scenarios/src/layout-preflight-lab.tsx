import { Absolute, Flex, Rectangle, useLayoutBox, type Signal } from '@pibbl/core';

/** Deterministic public-surface fixture; the host owns fault/recovery controls. */
export function LayoutPreflightLab({ width, grow, minimum, evaluate, hit }: {
  width: Signal<number>; grow: Signal<number>; minimum: Signal<number>;
  evaluate: (width: number) => void; hit: () => void;
}) {
  function Probe(_props: { style: { width: number; height: number; minWidth: number; flexGrow: number } }) {
    const box = useLayoutBox(); evaluate(box.width);
    return <Rectangle style={{ width: box.width, height: 30, fill: '#c45139' }} onClick={hit} />;
  }
  return <Absolute style={{ width: 240, height: 40 }}>
    <Flex style={{ width, height: 30 }}><Probe style={{ width: 80, height: 30, minWidth: 0, flexGrow: 1 }} /></Flex>
    <Flex style={{ left: 140, width: 80, height: 30 }}><Rectangle style={{ width: 80, height: 30, minWidth: minimum, maxWidth: 80, flexGrow: grow, fill: '#344c77' }} /></Flex>
  </Absolute>;
}
