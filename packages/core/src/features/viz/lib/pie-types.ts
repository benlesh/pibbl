import type { PieLabel, PieSlice } from './pie-layout.js';
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
/**
 * Places pie labels inside, outside, or automatically according to available space.
 *
 * @see {@link PieLayoutProps}
 */
export type PieLabelPlacement = "inside" | "outside" | "auto";
/**
 * A placed label with text geometry and optional leader, or a hidden label with its reason.
 *
 * @see {@link PieLayoutSlice}
 */
export type PieLabelLayout =
  | Readonly<{
      /** The literal "hidden" identifying this variant. See {@link PieLabelLayout}. */
      status: "hidden";
      /** Reason the operation could not produce its ordinary result. See {@link PieLabelLayout}. */
      reason: "empty" | "inside-fit" | "space";
      /** Text displayed by the placed label. See {@link PieLabelLayout}. */
      text: string;
    }>
  | Readonly<{
      /** The literal "placed" identifying this variant. See {@link PieLabelLayout}. */
      status: "placed";
      /**
       * Preferred placement relative to the anchor or containing geometry. See
       * {@link PieLabelLayout}.
       */
      placement: "inside" | "outside";
      /** Text displayed by the placed label. See {@link PieLabelLayout}. */
      text: string;
      /** Canvas font string used to draw or measure text. See {@link PieLabelLayout}. */
      font: string;
      /**
       * Horizontal coordinate or displacement in the containing coordinate system. See
       * {@link PieLabelLayout}.
       */
      x: number;
      /**
       * Vertical coordinate or displacement in the containing coordinate system. See
       * {@link PieLabelLayout}.
       */
      y: number;
      /**
       * Horizontal extent in the units of the containing geometry or surface. See
       * {@link PieLabelLayout}.
       */
      width: number;
      /**
       * Vertical extent in the units of the containing geometry or surface. See
       * {@link PieLabelLayout}.
       */
      height: number;
      /** Horizontal origin used to paint the placed label text. See {@link PieLabelLayout}. */
      textX: number;
      /** Vertical origin used to paint the placed label text. See {@link PieLabelLayout}. */
      textY: number;
      /** Ordered logical points of the label's leader line. See {@link PieLabelLayout}. */
      leader?: readonly (readonly [number, number])[];
    }>;
/**
 * Pie-slice data extended with center, radii, and optional label placement.
 *
 * @see {@link PieSliceGeometry}
 * @see {@link PieLabelLayout}
 * @see {@link PieLayoutProps}
 * @see {@link PieSliceProps}
 * @see {@link PieLabelProps}
 */
export interface PieLayoutSlice<D> extends PieSliceGeometry<D> {
  /** Horizontal coordinate of the center. See {@link PieLayoutSlice}. */
  readonly cx: number;
  /** Vertical coordinate of the center. See {@link PieLayoutSlice}. */
  readonly cy: number;
  /** Radius in the coordinate system of this geometry or effect. See {@link PieLayoutSlice}. */
  readonly radius: number;
  /** Radius of the inner boundary. See {@link PieLayoutSlice}. */
  readonly innerRadius: number;
  /** Resolved label placement, or a reason that the label is hidden. See {@link PieLabelLayout}. */
  readonly label?: PieLabelLayout;
}
/**
 * Supported geometry and presentation properties for PieLayout.
 *
 * @see {@link PieLayoutProps}
 */
export interface PieLayoutStyle {
  /** Horizontal coordinate of the center. See {@link PieLayoutStyle}. */
  readonly cx?: number;
  /** Vertical coordinate of the center. See {@link PieLayoutStyle}. */
  readonly cy?: number;
  /** Radius in the coordinate system of this geometry or effect. See {@link PieLayoutStyle}. */
  readonly radius?: number;
  /** Radius of the inner boundary. See {@link PieLayoutStyle}. */
  readonly innerRadius?: number;
  /** Canvas font used when measuring pie labels. See {@link PieLayoutStyle}. */
  readonly labelFont?: string;
  /** Clearance between pie geometry and its labels. See {@link PieLayoutStyle}. */
  readonly labelGap?: number;
}
/**
 * Authored inputs for PieLayout, including the declared data and presentation options.
 *
 * @see {@link PieOptions}
 * @see {@link SignalValue}
 * @see {@link PieSliceGeometry}
 * @see {@link PieLabelPlacement}
 * @see {@link HoverBounds}
 * @see {@link SignalStyle}
 * @see {@link PieLayoutStyle}
 * @see {@link PieLayoutSlice}
 * @see {@link CRCNode}
 */
export interface PieLayoutProps<D> extends PieOptions<D> {
  /**
   * Application data supplied to the component or reported by the event. See {@link SignalValue}.
   */
  readonly data: SignalValue<readonly D[]>;
  /** Opts into cached geometry for mutable inputs; advance after nonreactive changes. */
  readonly revision?: SignalValue<number>;
  /**
   * Formats the text associated with a pie slice. See {@link PieSliceGeometry}.
   * @param slice - Slice whose label text is needed. See {@link PieSliceGeometry}.
   * @returns Label text for the slice.
   */
  readonly label?: (slice: PieSliceGeometry<D>) => string;
  /**
   * Preferred placement relative to the anchor or containing geometry. See {@link SignalValue},
   * {@link PieLabelPlacement}.
   */
  readonly placement?: SignalValue<PieLabelPlacement>;
  /**
   * Logical region constraining the content or query. See {@link SignalValue},
   * {@link HoverBounds}.
   */
  readonly bounds?: SignalValue<HoverBounds>;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link PieLayoutStyle}.
   */
  readonly style?: SignalValue<SignalStyle<PieLayoutStyle>>;
  /**
   * Descendant content or the callback that supplies it. See {@link PieLayoutSlice},
   * {@link CRCNode}.
   * @param slice - Slice geometry and layout metadata. See {@link PieLayoutSlice}.
   * @returns CRC content representing the slice. See {@link CRCNode}.
   */
  readonly children: (slice: PieLayoutSlice<D>) => CRCNode;
}
/**
 * Supported geometry and presentation properties for PieSlice.
 *
 * @see {@link WedgeStyle}
 * @see {@link PieSliceProps}
 */
export type PieSliceStyle = Omit<
  WedgeStyle,
  "cx" | "cy" | "radius" | "startAngle" | "endAngle" | "counterclockwise"
>;
/**
 * Authored inputs for PieSlice, including the declared data and presentation options.
 *
 * @see {@link WedgeProps}
 * @see {@link PieLayoutSlice}
 * @see {@link SignalValue}
 * @see {@link SignalStyle}
 * @see {@link PieSliceStyle}
 * @see {@link CRCNode}
 * @see {@link PieSlice}
 */
export interface PieSliceProps<D> extends WedgeProps {
  /** Resolved pie geometry and label placement to present. See {@link PieLayoutSlice}. */
  readonly slice: PieLayoutSlice<D>;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link PieSliceStyle}.
   */
  readonly style?: SignalValue<SignalStyle<PieSliceStyle>>;
  /** Descendant content or the callback that supplies it. See {@link CRCNode}. */
  readonly children?: CRCNode;
}
/**
 * Supported geometry and presentation properties for PieLabel.
 *
 * @see {@link FillStyle}
 * @see {@link StrokeStyle}
 * @see {@link PieLabelProps}
 */
export interface PieLabelStyle {
  /** Paint used for the interior. See {@link FillStyle}. */
  readonly fill?: FillStyle;
  /** Paint used for a pie label's leader line. See {@link StrokeStyle}. */
  readonly leaderStroke?: StrokeStyle;
  /** Stroke width of a pie label's leader line. See {@link PieLabelStyle}. */
  readonly leaderWidth?: number;
}
/**
 * Authored inputs for PieLabel, including the declared data and presentation options.
 *
 * @see {@link CRCEventHandlers}
 * @see {@link CRCEventParticipationOptions}
 * @see {@link PieLayoutSlice}
 * @see {@link SignalValue}
 * @see {@link SignalStyle}
 * @see {@link PieLabelStyle}
 * @see {@link PieLabel}
 */
export interface PieLabelProps<D> extends CRCEventHandlers, CRCEventParticipationOptions {
  /** Resolved pie geometry and label placement to present. See {@link PieLayoutSlice}. */
  readonly slice: PieLayoutSlice<D>;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link PieLabelStyle}.
   */
  readonly style?: SignalValue<SignalStyle<PieLabelStyle>>;
}
