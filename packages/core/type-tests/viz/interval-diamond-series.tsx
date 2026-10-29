import { createElement, signal, type PibblNode } from "@pibbl/core";
import {
  IntervalDiamondSeries,
  type IntervalDiamondSeriesProps,
} from "@pibbl/core/viz";
interface Summary {
  analysis: string;
  estimate: number;
  lower: number;
  upper: number;
}
const props: IntervalDiamondSeriesProps<Summary> = {
  data: signal<readonly Summary[]>([]),
  category: "analysis",
  estimate: "estimate",
  lower: "lower",
  upper: "upper",
  categoryScale: "analyses",
  valueScale: "effect",
  style: { height: signal(12) },
};
const nodes: PibblNode[] = [
  <IntervalDiamondSeries {...props} />,
  createElement(IntervalDiamondSeries<Summary>, props),
];
void nodes;
const bad: IntervalDiamondSeriesProps<Summary> = {
  ...props,
  // @ts-expect-error A textual field cannot supply an estimate.
  estimate: "analysis",
};
void bad;
const badStyle: IntervalDiamondSeriesProps<Summary> = {
  ...props,
  // @ts-expect-error Diamond height is supported; circle radius is not.
  style: { radius: 4 },
};
void badStyle;
