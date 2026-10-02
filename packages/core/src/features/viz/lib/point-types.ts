import type {
  CRCEventHandlers,
  CRCEventParticipationOptions,
  FillStyle,
  SignalValue,
  StrokeStyle,
} from "@crc/core";
import type { SignalStyle } from "@crc/core/internal";
import type { LineAccessor, ScaleId } from "./types.js";
export type PointAccessor<D> = LineAccessor<D>;
export interface PointMarkStyle {
  readonly radius?: number;
  readonly fill?: FillStyle;
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly opacity?: number;
}
export interface PointSeriesStyle extends PointMarkStyle {
  readonly cursor?: string;
}
export type PointStyleResolver<D> = (
  datum: D,
  index: number,
  data: readonly D[],
) => Readonly<PointMarkStyle>;
export interface PointSeriesProps<D>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly data: SignalValue<readonly D[]>;
  readonly x: PointAccessor<D>;
  readonly y: PointAccessor<D>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly style?: SignalValue<
    SignalStyle<PointSeriesStyle> | PointStyleResolver<D>
  >;
}
