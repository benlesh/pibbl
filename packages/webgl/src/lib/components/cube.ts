import { defineWebGLPrimitive } from '../define-webgl-primitive.js';
import { getCubeGeometry } from '../geometry/cube.js';
import type { CRCWebGLContext, CRCWebGLTargetProps } from '../types.js';
import { drawBuiltInMesh, type MeshStyle } from './mesh.js';

export interface CubeProps extends CRCWebGLTargetProps {}

export interface CubeStyle extends MeshStyle {
  readonly size?: number;
}

function renderCube(
  _props: Readonly<CubeProps>,
  style: Readonly<CubeStyle>,
  context: CRCWebGLContext,
): void {
  const size = resolvePositive(style.size ?? 1, 'size');
  drawBuiltInMesh('Cube', getCubeGeometry(), style, context, size);
}

/** Draws the canonical centered unit cube with size applied as model scale. */
export const Cube = defineWebGLPrimitive<CubeProps, CubeStyle>(renderCube, {
  hit: {
    kind: 'geometry',
    geometry: () => getCubeGeometry(),
  },
});

function resolvePositive(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cube style.${field} must be finite.`);
  }
  if (value <= 0) {
    throw new RangeError(`Cube style.${field} must be positive.`);
  }
  return value;
}
