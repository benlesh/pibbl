import { createElement, signal, type PibblNode } from "@pibbl/core";
import {
  WeightedPointSeries,
  type WeightedPointSeriesProps,
  type WeightedPointSeriesStyle,
} from "@pibbl/core/viz";

interface Observation {
  label: string;
  concentration: number;
  inhibition: number;
  precision: number | null;
}
const style: WeightedPointSeriesStyle = { fill: "#087f8c", strokeWidth: 1 };
const props: WeightedPointSeriesProps<Observation> = {
  data: signal<readonly Observation[]>([]),
  x: "concentration",
  y: "inhibition",
  weight: "precision",
  xScale: "concentration",
  yScale: "inhibition",
  weightDomain: [0, 100],
  radiusRange: [0, 8],
  style,
};
const nodes: PibblNode[] = [
  <WeightedPointSeries {...props} />,
  createElement(WeightedPointSeries<Observation>, props),
];
void nodes;
const callbacks: WeightedPointSeriesProps<Observation> = {
  ...props,
  x: (observation) => observation.concentration,
  y: (observation) => observation.inhibition,
  weight: (observation) => observation.precision,
};
void callbacks;
const badWeight: WeightedPointSeriesProps<Observation> = {
  ...props,
  // @ts-expect-error Text cannot supply a scientific weight.
  weight: "label",
};
void badWeight;
const missingZero: WeightedPointSeriesProps<Observation> = {
  ...props,
  // @ts-expect-error Proportional weight domains must visibly begin at zero.
  weightDomain: [1, 100],
};
void missingZero;
const badStyle: WeightedPointSeriesProps<Observation> = {
  ...props,
  // @ts-expect-error Radius is derived from the supplied weight, not style.
  style: { radius: 4 },
};
void badStyle;
