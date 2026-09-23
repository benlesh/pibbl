import { defineBackendPrimitive } from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { getSphereGeometry } from '../geometry/sphere.js';
import type { WebGLSceneComposer } from '../scene/types.js';
import type { CRCWebGLTargetProps } from '../types.js';
import {
  resolveMeshTransform,
  submitBuiltInMesh,
  type MeshStyle,
} from './mesh.js';

export interface SphereProps extends CRCWebGLTargetProps {}

export interface SphereStyle extends MeshStyle {
  readonly radius?: number;
}

function renderSphere(
  props: Readonly<SphereProps>,
  style: Readonly<SphereStyle>,
): void {
  const radius = resolveRadius(style.radius ?? 0.5);
  submitBuiltInMesh(
    'Sphere',
    props,
    getSphereGeometry(),
    style,
    radius * 2,
  );
}

export function resolveSphereTransform(style: Readonly<SphereStyle>) {
  return resolveMeshTransform(style, resolveRadius(style.radius ?? 0.5) * 2);
}

export const getSpherePhysicsGeometry = getSphereGeometry;

/** Submits the canonical radius-0.5 sphere with radius applied as model scale. */
export const Sphere = defineBackendPrimitive<
  SphereProps,
  SphereStyle,
  SphereStyle,
  SphereStyle,
  WebGLSceneComposer
>(
  WEBGL_BACKEND_TOKEN,
  renderSphere,
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
