import {
  Group,
  Rectangle,
  definePrimitive,
  resolveSignalValue,
  resolveBox,
  resolveLength,
  type BoxStyle,
  type CRCNode,
  type FillStyle,
  type StrokeStyle,
  type SignalValue,
} from "@crc/core";
import {
  pushLayoutBox,
  setCurrentComponentAfterRender,
  type SignalStyle,
} from "@crc/core/internal";
import type { HoverPoint } from "./hover-types.js";
import {
  placeHoverCard,
  type HoverBounds,
  type HoverPlacement,
} from "./hover-placement.js";
export type { HoverBounds, HoverPlacement } from "./hover-placement.js";
export interface HoverCardStyle {
  readonly width: Exclude<BoxStyle["width"], undefined | "auto">;
  readonly height: Exclude<BoxStyle["height"], undefined | "auto">;
  readonly padding?: BoxStyle["padding"];
  readonly fill?: FillStyle;
  readonly stroke?: StrokeStyle;
  readonly strokeWidth?: number;
  readonly cornerRadius?: number;
  readonly opacity?: number;
  readonly filter?: never;
  readonly custom?: never;
}
export interface HoverCardProps {
  readonly anchor: SignalValue<HoverPoint>;
  readonly anchorRadius?: SignalValue<number>;
  readonly gap?: SignalValue<number>;
  readonly bounds?: SignalValue<HoverBounds>;
  readonly placement?: HoverPlacement;
  readonly style: SignalValue<SignalStyle<HoverCardStyle>>;
  readonly children?: CRCNode;
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
  children?: CRCNode;
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
/** Positions a declared card outside a protected anchor, allowing overflow if needed. */
export function HoverCard(props: HoverCardProps): CRCNode {
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
