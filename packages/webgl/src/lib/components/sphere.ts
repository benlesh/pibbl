import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import { getSphereGeometry } from '../geometry/sphere.js';
import type { CRCWebGLContext, CRCWebGLTargetProps } from '../types.js';
import { drawBuiltInMesh, type MeshStyle } from './mesh.js';

export interface SphereProps extends CRCWebGLTargetProps {}

export interface SphereStyle extends MeshStyle {
  readonly radius?: number;
}

function renderSphere(
  _props: Readonly<SphereProps>,
  style: Readonly<SphereStyle>,
  context: CRCWebGLContext,
): void {
  const radius = resolveRadius(style.radius ?? 0.5);
  drawBuiltInMesh(
    'Sphere',
    getSphereGeometry(),
    style,
    context,
    radius * 2,
  );
}

/** Draws the canonical radius-0.5 sphere with radius applied as model scale. */
export const Sphere = defineWebGLPrimitive<SphereProps, SphereStyle>(
  renderSphere,
  {
    hit: {
      kind: 'geometry',
      geometry: () => getSphereGeometry(),
    },
  },
);

function resolveRadius(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('Sphere style.radius must be finite.');
  }
  if (value <= 0) {
    throw new RangeError('Sphere style.radius must be positive.');
  }
  return value;
}
