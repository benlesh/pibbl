import { createElement, signal, type PibblNode } from "@pibbl/core";
import {
  CensoredPointSeries,
  type CensoredPointSeriesProps,
  type CensoringStatus,
} from "@pibbl/core/viz";

interface AssayRecord {
  time: number;
  concentration: number | null;
  reporting: CensoringStatus;
}

const props: CensoredPointSeriesProps<AssayRecord> = {
  data: signal<readonly AssayRecord[]>([]),
  x: "time",
  y: "concentration",
  censoring: "reporting",
  xScale: "time",
  yScale: "concentration",
  style: { radius: signal(4), strokeWidth: 1.5 },
};
const nodes: PibblNode[] = [
  <CensoredPointSeries {...props} />,
  createElement(CensoredPointSeries<AssayRecord>, props),
];
void nodes;
const callbacks: CensoredPointSeriesProps<AssayRecord> = {
  ...props,
  x: (datum) => datum.time,
  y: (datum) => datum.concentration,
  censoring: (datum, index, records) =>
    records[index].reporting ?? datum.reporting,
};
void callbacks;
const badStatus: CensoredPointSeriesProps<AssayRecord> = {
  ...props,
  // @ts-expect-error Numeric coordinates cannot be used as censoring statuses.
  censoring: "time",
};
void badStatus;
const badCoordinate: CensoredPointSeriesProps<AssayRecord> = {
  ...props,
  // @ts-expect-error A reporting status cannot be used as a numeric coordinate.
  y: "reporting",
};
void badCoordinate;
