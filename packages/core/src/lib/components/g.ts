import { defineComp } from '../define-comp.js';
import { definePrimitive } from '../define-primitive.js';
import { CRCNode, RenderingContext2D, SystemStyle } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';
import type {
  BoxStyle,
  LayoutItemStyle,
  ResolvedDrawingStyle,
} from '../style/types.js';

export interface GroupProps {
  children: CRCNode;
}

/** @internal Temporary lowercase-adapter program props. */
export interface GProps {
  children: CRCNode[];
}

export interface GStyle extends SystemStyle, BoxStyle, LayoutItemStyle {
  scaleX?: number;
  scaleY?: number;
  /** Clockwise rotation in degrees. */
  rotationDegrees?: number;
  rotationOrigin?: [number, number];
  translateX?: number;
  translateY?: number;
  /** Horizontal skew angle in degrees. */
  skewX?: number;
  /** Vertical skew angle in degrees. */
  skewY?: number;
}

type ResolvedGStyle = ResolvedDrawingStyle<GStyle>;

function renderGroup(
  props: GroupProps,
  style: Readonly<ResolvedGStyle>,
  ctx: RenderingContext2D,
) {
  let transform = ctx.getTransform();

  const { scaleX = 1, scaleY = 1 } = style;
  if (scaleX !== 1 || scaleY !== 1) {
    transform = transform.scale(scaleX, scaleY);
  }

  const { rotationDegrees } = style;
  if (rotationDegrees) {
    const [rox, roy] = style.rotationOrigin ?? [0, 0];
    transform = transform
      .translate(rox, roy)
      .rotate(rotationDegrees)
      .translate(-rox, -roy);
  }

  const { translateX = 0, translateY = 0 } = style;
  if (translateX !== 0 || translateY !== 0) {
    transform = transform.translate(translateX, translateY);
  }

  const { skewX } = style;
  if (skewX) {
    transform = transform.skewX(skewX);
  }

  const { skewY } = style;
  if (skewY) {
    transform = transform.skewY(skewY);
  }

  ctx.setTransform(transform);

  return props.children;
}

/**
 * Describes a transformation group for JSX or createElement authoring.
 */
export const Group = definePrimitive<
  GroupProps,
  GStyle,
  GStyle,
  ResolvedGStyle
>(renderGroup, {
  resolveStyle: style => stripLayoutParticipation(style) as ResolvedGStyle,
});

function renderLegacyGroup(
  props: GProps,
  style: Readonly<ResolvedGStyle>,
  ctx: RenderingContext2D,
) {
  return renderGroup(props, style, ctx);
}

/** @internal Temporary lowercase authoring adapter retained until Task 12. */
export const g = defineComp<GProps, GStyle, GStyle, ResolvedGStyle>(
  renderLegacyGroup,
  {
    resolveStyle: style => stripLayoutParticipation(style) as ResolvedGStyle,
  },
);
