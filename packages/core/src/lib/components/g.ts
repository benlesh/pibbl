import { defineComp } from '../define-comp.js';
import { CRCNode, IntrinsicProps, RenderingContext2D } from '../types.js';

export interface GProps extends IntrinsicProps {
  children: CRCNode[];
  scaleX?: number;
  scaleY?: number;
  /** Clockwise rotation in degrees. */
  rotate?: number;
  rotateOrigin?: [number, number];
  x?: number;
  y?: number;
  /** Horizontal skew angle in degrees. */
  skewX?: number;
  /** Vertical skew angle in degrees. */
  skewY?: number;
}

function G(props: GProps, ctx: RenderingContext2D) {
  let transform = ctx.getTransform();

  const { scaleX = 1, scaleY = 1 } = props;
  if (scaleX !== 1 || scaleY !== 1) {
    transform = transform.scale(scaleX, scaleY);
  }

  const { rotate } = props;
  if (rotate) {
    const [rox, roy] = props.rotateOrigin ?? [0, 0];
    transform = transform
      .translate(rox, roy)
      .rotate(rotate)
      .translate(-rox, -roy);
  }

  const { x = 0, y = 0 } = props;
  if (x !== 0 || y !== 0) {
    transform = transform.translate(x, y);
  }

  const { skewX } = props;
  if (skewX) {
    transform = transform.skewX(skewX);
  }

  const { skewY } = props;
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
