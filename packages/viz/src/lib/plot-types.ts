import type { CRCEventHandlers, CRCNode, SignalValue } from "@crc/core";
import type { PointAccessor } from "./point-types.js";
import type { ScaleId } from "./types.js";
export type PlotKeyAccessor<D> =
  | { [K in keyof D]-?: D[K] extends string | number ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => string | number);
export interface PlotSeriesProps<D> extends CRCEventHandlers {
  readonly data: SignalValue<readonly D[]>;
  readonly x: PointAccessor<D>;
  readonly y: PointAccessor<D>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly keyBy?: PlotKeyAccessor<D>;
  readonly render: (datum: D, index: number, data: readonly D[]) => CRCNode;
}
