import type {
  CRCNode,
  CRCEventHandlers,
  CRCEventParticipationOptions,
  SignalValue,
  FillStyle,
  StrokeStyle,
  WedgeProps,
  WedgeStyle,
} from "@crc/core";
import type { SignalStyle } from "@crc/core/internal";
import type { PieOptions, PieSliceGeometry } from "./pie-slices.js";
import type { HoverBounds } from "./hover-placement.js";
export type PieLabelPlacement = "inside" | "outside" | "auto";
export interface PieLabelBox {
  readonly width: number;
  readonly height: number;
}
export type PieLabelLayout =
  | Readonly<{
      kind: "text";
      status: "hidden";
      reason: "empty" | "inside-fit" | "space";
      text: string;
    }>
  | Readonly<{
      kind: "text";
      status: "placed";
      placement: "inside" | "outside";
      text: string;
      font: string;
      x: number;
      y: number;
      width: number;
      height: number;
      textX: number;
      textY: number;
      leader?: readonly (readonly [number, number])[];
    }>
  | Readonly<{
      kind: "content";
      status: "hidden";
      reason: "inside-fit" | "space";
    }>
  | Readonly<{
      kind: "content";
      status: "placed";
      placement: "inside" | "outside";
      x: number;
      y: number;
      width: number;
      height: number;
      leader?: readonly (readonly [number, number])[];
    }>;
export interface PieLayoutSlice<D> extends PieSliceGeometry<D> {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly innerRadius: number;
  readonly label?: PieLabelLayout;
}
export interface PieLayoutStyle {
  readonly cx?: number;
  readonly cy?: number;
  readonly radius?: number;
  readonly innerRadius?: number;
  readonly labelFont?: string;
  readonly labelGap?: number;
}
interface PieLayoutBaseProps<D> extends PieOptions<D> {
  readonly data: SignalValue<readonly D[]>;
  /** Opts into cached geometry for mutable inputs; advance after nonreactive changes. */
  readonly revision?: SignalValue<number>;
  readonly placement?: SignalValue<PieLabelPlacement>;
  readonly bounds?: SignalValue<HoverBounds>;
  readonly style?: SignalValue<SignalStyle<PieLayoutStyle>>;
  readonly children: (slice: PieLayoutSlice<D>) => CRCNode;
}
type PieTextLabelSource<D> = Readonly<{
  readonly label?: ((slice: PieSliceGeometry<D>) => string) | undefined;
  readonly labelBox?: undefined;
}>;
type PieContentLabelSource<D> = Readonly<{
  readonly label?: undefined;
  readonly labelBox?:
    | ((slice: PieSliceGeometry<D>) => PieLabelBox | null | undefined)
    | undefined;
}>;
export type PieLayoutProps<D> = PieLayoutBaseProps<D> &
  (PieTextLabelSource<D> | PieContentLabelSource<D>);
export type PieSliceStyle = Omit<
  WedgeStyle,
  "cx" | "cy" | "radius" | "startAngle" | "endAngle" | "counterclockwise"
>;
export interface PieSliceProps<D> extends WedgeProps {
  readonly slice: PieLayoutSlice<D>;
  readonly style?: SignalValue<SignalStyle<PieSliceStyle>>;
  readonly children?: CRCNode;
}
export interface PieLabelStyle {
  readonly fill?: FillStyle;
  readonly leaderStroke?: StrokeStyle;
  readonly leaderWidth?: number;
}
export interface PieLabelProps<D>
  extends CRCEventHandlers, CRCEventParticipationOptions {
  readonly slice: PieLayoutSlice<D>;
  readonly style?: SignalValue<SignalStyle<PieLabelStyle>>;
  readonly children?: CRCNode;
}
