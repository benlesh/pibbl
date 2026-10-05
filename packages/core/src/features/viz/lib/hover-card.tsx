import {
  Group,
  Rectangle,
  definePrimitive,
  resolveSignalValue,
  resolveBox,
  resolveLength,
  type BoxStyle,
  type PibblNode,
  type FillStyle,
  type StrokeStyle,
  type SignalValue,
} from "@pibbl/core";
import {
  pushLayoutBox,
  setCurrentComponentAfterRender,
  type SignalStyle,
} from "@pibbl/core/internal";
import type { HoverPoint } from "./hover-types.js";
import {
  placeHoverCard,
  type HoverBounds,
  type HoverPlacement,
} from "./hover-placement.js";
export type { HoverBounds, HoverPlacement } from "./hover-placement.js";
/**
 * Supported geometry and presentation properties for HoverCard.
 *
 * @see {@link BoxStyle}
 * @see {@link FillStyle}
 * @see {@link StrokeStyle}
 * @see {@link HoverCardProps}
 */
export interface HoverCardStyle {
  /** Horizontal extent in the units of the containing geometry or surface. See {@link BoxStyle}. */
  readonly width: Exclude<BoxStyle["width"], undefined | "auto">;
  /** Vertical extent in the units of the containing geometry or surface. See {@link BoxStyle}. */
  readonly height: Exclude<BoxStyle["height"], undefined | "auto">;
  /** Insets between the border box and content box. See {@link BoxStyle}. */
  readonly padding?: BoxStyle["padding"];
  /** Paint used for the interior. See {@link FillStyle}. */
  readonly fill?: FillStyle;
  /** Paint used for the outline. See {@link StrokeStyle}. */
  readonly stroke?: StrokeStyle;
  /** Width of the painted outline. See {@link HoverCardStyle}. */
  readonly strokeWidth?: number;
  /**
   * Uniform corner radius used where no per-corner override is supplied. See
   * {@link HoverCardStyle}.
   */
  readonly cornerRadius?: number;
  /** Opacity of the painted result. See {@link HoverCardStyle}. */
  readonly opacity?: number;
  /**
   * Not accepted in this variant; use the alternative fields instead. See {@link HoverCardStyle}.
   */
  readonly filter?: never;
  /**
   * Not accepted in this variant; use the alternative fields instead. See {@link HoverCardStyle}.
   */
  readonly custom?: never;
}
/**
 * Authored inputs for HoverCard, including the declared data and presentation options.
 *
 * @see {@link SignalValue}
 * @see {@link HoverPoint}
 * @see {@link HoverBounds}
 * @see {@link HoverPlacement}
 * @see {@link SignalStyle}
 * @see {@link HoverCardStyle}
 * @see {@link PibblNode}
 * @see {@link HoverCard}
 */
export interface HoverCardProps {
  /**
   * Logical point to which the content or result is anchored. See {@link SignalValue},
   * {@link HoverPoint}.
   */
  readonly anchor: SignalValue<HoverPoint>;
  /** Clearance around the anchor before placing the item. See {@link SignalValue}. */
  readonly anchorRadius?: SignalValue<number>;
  /** Spacing between adjacent items. See {@link SignalValue}. */
  readonly gap?: SignalValue<number>;
  /**
   * Logical region constraining the content or query. See {@link SignalValue},
   * {@link HoverBounds}.
   */
  readonly bounds?: SignalValue<HoverBounds>;
  /**
   * Preferred placement relative to the anchor or containing geometry. See {@link HoverPlacement}
   * .
   */
  readonly placement?: HoverPlacement;
  /**
   * Declared presentation and layout properties. See {@link SignalValue}, {@link SignalStyle},
   * {@link HoverCardStyle}.
   */
  readonly style: SignalValue<SignalStyle<HoverCardStyle>>;
  /** Descendant content or the callback that supplies it. See {@link PibblNode}. */
  readonly children?: PibblNode;
}
type CardInputs = Omit<
  HoverCardProps,
  "style" | "anchor" | "anchorRadius" | "gap" | "bounds"
> & {
  anchor: HoverPoint;
  anchorRadius: number;
  gap: number;
  bounds?: HoverBounds;
};
interface CardResolved {
  readonly custom?: never;
  readonly box: ReturnType<typeof resolveBox>;
  readonly bounds: HoverBounds;
  readonly fill: FillStyle;
  readonly stroke: StrokeStyle;
  readonly strokeWidth: number;
  readonly cornerRadius: number;
  readonly opacity: number;
}
function Content({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children?: PibblNode;
}) {
  // Establish both allocation and percentage basis for arbitrary composed nodes;
  // this is a content box, not a layout parent that requires child dimensions.
  const box = { x: 0, y: 0, width, height };
  const outer = pushLayoutBox(box);
  let inner: (() => void) | undefined;
  try {
    inner = pushLayoutBox(box);
    setCurrentComponentAfterRender(() => {
      inner!();
      outer();
    });
  } catch (error) {
    inner?.();
    outer();
    throw error;
  }
  return children;
}
const Card = definePrimitive<
  CardInputs,
  HoverCardStyle,
  HoverCardStyle,
  CardResolved
>(
  function renderHoverCard(props, style, context) {
    context.globalAlpha *= style.opacity;
    const { borderBox: box, contentBox: content } = style.box;
    const at = placeHoverCard({
      anchor: props.anchor,
      anchorRadius: props.anchorRadius,
      gap: props.gap,
      bounds: props.bounds ?? style.bounds,
      width: box.width,
      height: box.height,
      strokeWidth: style.stroke ? style.strokeWidth : 0,
      placement: props.placement ?? "auto",
    });
    return (
      <Group style={{ translateX: at.x, translateY: at.y }}>
        <Rectangle
          pointerEvents="none"
          style={{
            width: box.width,
            height: box.height,
            fill: style.fill,
            stroke: style.stroke,
            strokeWidth: style.strokeWidth,
            cornerRadius: style.cornerRadius,
          }}
        />
        <Group style={{ translateX: content.x, translateY: content.y }}>
          <Content width={content.width} height={content.height}>
            {props.children}
          </Content>
        </Group>
      </Group>
    );
  },
  {
    resolveStyle(style, context) {
      const width = resolveLength(
          style.width,
          context.allocation.width,
          "width",
        ),
        height = resolveLength(
          style.height,
          context.allocation.height,
          "height",
        );
      if (width === undefined || height === undefined)
        throw new TypeError("HoverCard requires declared width and height.");
      const box = resolveBox(
        { width, height, padding: style.padding ?? 10 },
        { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity },
        { component: "HoverCard" },
      );
      const strokeWidth = style.strokeWidth ?? 1,
        cornerRadius = style.cornerRadius ?? 7,
        opacity = style.opacity ?? 1;
      for (const value of [strokeWidth, cornerRadius, opacity])
        if (!Number.isFinite(value) || value < 0)
          throw new RangeError(
            "HoverCard paint dimensions must be finite and nonnegative.",
          );
      if (opacity > 1)
        throw new RangeError("HoverCard opacity must be in [0,1].");
      return {
        box,
        bounds: {
          x: 0,
          y: 0,
          width: context.allocation.width,
          height: context.allocation.height,
        },
        fill: style.fill ?? "rgba(255,255,255,0.92)",
        stroke: style.stroke ?? "rgba(98,117,139,0.35)",
        strokeWidth,
        cornerRadius,
        opacity,
      };
    },
  },
);
const fields = new Set([
  "width",
  "height",
  "padding",
  "fill",
  "stroke",
  "strokeWidth",
  "cornerRadius",
  "opacity",
]);
/**
 * Positions a declared card outside a protected anchor, allowing overflow if needed.
 *
 * @param props - Anchor, placement, style, and hover-card content. See {@link HoverCardProps}.
 * @returns Pibbl content placed as a hover card. See {@link PibblNode}.
 *
 * @see {@link HoverCardProps}
 * @see {@link PibblNode}
 */
export function HoverCard(props: HoverCardProps): PibblNode {
  const style = resolveSignalValue(props.style);
  if (!style || typeof style !== "object")
    throw new TypeError("HoverCard requires a style with width and height.");
  for (const field of Object.keys(style))
    if (!fields.has(field))
      throw new TypeError(`HoverCard does not support style.${field}.`);
  return (
    <Card
      anchor={resolveSignalValue(props.anchor)}
      anchorRadius={resolveSignalValue(props.anchorRadius ?? 0)}
      gap={resolveSignalValue(props.gap ?? 8)}
      bounds={
        props.bounds === undefined
          ? undefined
          : resolveSignalValue(props.bounds)
      }
      placement={props.placement}
      style={style}
    >
      {props.children}
    </Card>
  );
}
