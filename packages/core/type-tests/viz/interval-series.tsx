import { createElement, signal, type PibblNode } from "@pibbl/core";
import {
  HorizontalIntervalSeries,
  VerticalIntervalSeries,
  type HorizontalIntervalSeriesProps,
  type VerticalIntervalSeriesProps,
} from "@pibbl/core/viz";

interface Row {
  study: string;
  estimate: number | null;
  lower: number;
  upper: number;
}
const props: HorizontalIntervalSeriesProps<Row> = {
  data: signal<readonly Row[]>([]),
  category: "study",
  estimate: "estimate",
  lower: "lower",
  upper: "upper",
  categoryScale: "study",
  valueScale: "effect",
  style: { radius: signal(4), capSize: signal(8), strokeWidth: 2 },
};
const vertical: VerticalIntervalSeriesProps<Row> = props;
const nodes: PibblNode[] = [
  <HorizontalIntervalSeries {...props} />,
  createElement(VerticalIntervalSeries<Row>, vertical),
];
void nodes;
const badEstimate: HorizontalIntervalSeriesProps<Row> = {
  ...props,
  // @ts-expect-error A string field cannot supply a numeric estimate.
  estimate: "study",
};
void badEstimate;
// @ts-expect-error Both explicit supplied bounds are required.
const missingBounds: VerticalIntervalSeriesProps<Row> = {
  data: [],
  category: "study",
  estimate: "estimate",
  categoryScale: "study",
  valueScale: "effect",
};
void missingBounds;
const badBound: HorizontalIntervalSeriesProps<Row> = {
  ...props,
  // @ts-expect-error Bounds require numeric fields, just like estimates.
  lower: "study",
};
void badBound;
const badStyle: VerticalIntervalSeriesProps<Row> = {
  ...props,
  // @ts-expect-error Interval marks do not silently accept layout styles.
  style: { width: 100 },
};
void badStyle;
const callbacks: HorizontalIntervalSeriesProps<Row> = {
  ...props,
  category: (datum, index, records) => records[index].study + datum.study,
  estimate: (datum) => datum.estimate,
  lower: (datum) => datum.lower,
  upper: (datum) => datum.upper,
  defined: (_datum, index) => index % 2 === 0,
};
void callbacks;
