import { defineComp } from '../define-comp.js';
import { CRCNode, RenderingContext2D, SystemStyle } from '../types.js';

export interface GProps {
  children: CRCNode[];
}

export interface GStyle extends SystemStyle {
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

function G(props: GProps, style: Readonly<GStyle>, ctx: RenderingContext2D) {
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
 * Creates a group element that can be used to define transformations on a set
 * of related CRC elements.
 */
export const g = defineComp(G);
