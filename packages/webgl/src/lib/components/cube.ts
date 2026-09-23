import { defineBackendPrimitive } from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { getCubeGeometry } from '../geometry/cube.js';
import type { WebGLSceneComposer } from '../scene/types.js';
import type { CRCWebGLTargetProps } from '../types.js';
import {
  resolveMeshTransform,
  submitBuiltInMesh,
  type MeshStyle,
} from './mesh.js';

export interface CubeProps extends CRCWebGLTargetProps {}

export interface CubeStyle extends MeshStyle {
  readonly size?: number;
}

function renderCube(
  props: Readonly<CubeProps>,
  style: Readonly<CubeStyle>,
): void {
  const size = resolvePositive(style.size ?? 1, 'size');
  submitBuiltInMesh('Cube', props, getCubeGeometry(), style, size);
}

export function resolveCubeTransform(style: Readonly<CubeStyle>) {
  return resolveMeshTransform(style, resolvePositive(style.size ?? 1, 'size'));
}

export const getCubePhysicsGeometry = getCubeGeometry;

/** Submits the canonical centered unit cube with size applied as model scale. */
export const Cube = defineBackendPrimitive<
  CubeProps,
  CubeStyle,
  CubeStyle,
  CubeStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderCube);

function resolvePositive(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cube style.${field} must be finite.`);
  }
  if (value <= 0) {
    throw new RangeError(`Cube style.${field} must be positive.`);
  }
  return value;
}
