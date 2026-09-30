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
export type PieLabelLayout =
  | Readonly<{
      status: "hidden";
      reason: "empty" | "inside-fit" | "space";
      text: string;
    }>
  | Readonly<{
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
    }>;
export interface PieLayoutSlice<D> extends PieSliceGeometry<D> {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  readonly label?: PieLabelLayout;
}
export interface PieLayoutStyle {
  readonly cx?: number;
  readonly cy?: number;
  readonly radius?: number;
  readonly labelFont?: string;
  readonly labelGap?: number;
}
export interface PieLayoutProps<D> extends PieOptions<D> {
  readonly data: SignalValue<readonly D[]>;
  readonly label?: (slice: PieSliceGeometry<D>) => string;
  readonly placement?: SignalValue<PieLabelPlacement>;
  readonly bounds?: SignalValue<HoverBounds>;
  readonly style?: SignalValue<SignalStyle<PieLayoutStyle>>;
  readonly children: (slice: PieLayoutSlice<D>) => CRCNode;
}
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
}
