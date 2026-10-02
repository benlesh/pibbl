import type {
  BoxStyle,
  CRCNode,
  LayoutItemStyle,
  LayoutBox,
  SignalValue,
} from "@crc/core";
import type { SignalStyle } from "@crc/core/internal";
export type ScaleId = string | symbol;
export type LinearDomain = readonly [number, number];
export type ScaleRange = "width" | "height" | readonly [number, number];
export type ScaleLayoutStyle = Pick<BoxStyle, "width" | "height"> &
  LayoutItemStyle;
export interface LinearScaleProps {
  readonly id: ScaleId;
  readonly type: "linear";
  readonly domain: SignalValue<LinearDomain>;
  readonly range: SignalValue<ScaleRange>;
  readonly reverse?: SignalValue<boolean>;
  readonly style?: SignalValue<SignalStyle<ScaleLayoutStyle>>;
  readonly children?: CRCNode;
}
export type ScaleProps = LinearScaleProps;
export interface ResolvedLinearScale {
  readonly type: "linear";
  readonly domain: LinearDomain;
  readonly range: readonly [number, number];
  readonly frame: Readonly<LayoutBox>;
  map(value: number): number;
  invert(pixel: number): number;
  ticks(count?: number): readonly number[];
}
export type ResolvedScale = ResolvedLinearScale;

import type {
  CRCEventHandlers,
  CRCEventParticipationOptions,
  FillStyle,
  StrokeStyle,
} from "@crc/core";
export interface AxisStyle {
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly fill?: FillStyle;
  readonly font?: string;
  readonly opacity?: number;
}
export interface AxisProps {
  readonly scale: ScaleId;
  readonly position: "bottom" | "left";
  readonly tickCount?: SignalValue<number>;
  readonly tickFormat?: (value: number, index: number) => string;
  readonly style?: SignalValue<SignalStyle<AxisStyle>>;
}
export type LineCoordinate = number | null | undefined;
export type LineAccessor<D> =
  | { [K in keyof D]-?: D[K] extends LineCoordinate ? K : never }[keyof D]
  | ((datum: D, index: number, data: readonly D[]) => LineCoordinate);
export type LineCurve = "linear";
export interface LineSeriesStyle {
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly opacity?: number;
  readonly cursor?: string;
  readonly lineInteractionWidth?: number;
}
export interface LineSeriesProps<D>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly data: SignalValue<readonly D[]>;
  readonly x: LineAccessor<D>;
  readonly y: LineAccessor<D>;
  readonly xScale: ScaleId;
  readonly yScale: ScaleId;
  readonly defined?: (datum: D, index: number, data: readonly D[]) => boolean;
  readonly curve?: LineCurve;
  readonly style?: SignalValue<SignalStyle<LineSeriesStyle>>;
}
type ScaleAdjustX =
  | { readonly x: SignalValue<number>; readonly xScale: ScaleId }
  | { readonly x?: never; readonly xScale?: never };
type ScaleAdjustY =
  | { readonly y: SignalValue<number>; readonly yScale: ScaleId }
  | { readonly y?: never; readonly yScale?: never };
export type ScaleAdjustProps = ScaleAdjustX &
  ScaleAdjustY & { readonly children?: CRCNode };
