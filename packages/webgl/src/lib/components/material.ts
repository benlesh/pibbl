import type { CRCWebGLMaterial } from '../types.js';
import type { WebGLRGBA } from '../scene/types.js';
import { parseConcreteColor } from './style-values.js';

export interface ResolvedWebGLLambertMaterial {
  readonly type: 'lambert';
  readonly emissiveColor: WebGLRGBA;
  readonly emissiveIntensity: number;
}

export type ResolvedWebGLMaterial = ResolvedWebGLLambertMaterial;

const materialFields = new Set(['type', 'emissiveColor', 'emissiveIntensity']);

export const DEFAULT_WEBGL_MATERIAL: ResolvedWebGLMaterial = Object.freeze({
  type: 'lambert',
  emissiveColor: Object.freeze([0, 0, 0, 1]) as WebGLRGBA,
  emissiveIntensity: 1,
});

export function resolveWebGLMaterial(
  componentName: string,
  value: CRCWebGLMaterial | undefined,
): ResolvedWebGLMaterial {
  if (value !== undefined) validateMaterialKeys(componentName, value);
  const material = value as Record<string, unknown> | undefined;
  if (material !== undefined &&
    (!Object.hasOwn(material, 'type') || material.type !== 'lambert')) {
    throw new TypeError(`${componentName} style.material.type must be "lambert".`);
  }
  const emissiveColor = material?.emissiveColor === undefined ?
    DEFAULT_WEBGL_MATERIAL.emissiveColor :
    toRGBA(parseConcreteColor(
      componentName,
      'style.material.emissiveColor',
      material.emissiveColor as string,
    ));
  const emissiveIntensity = material?.emissiveIntensity === undefined ?
    1 : material.emissiveIntensity;
  if (typeof emissiveIntensity !== 'number' || !Number.isFinite(emissiveIntensity)) {
    throw new TypeError(`${componentName} style.material.emissiveIntensity must be finite.`);
  }
  if (emissiveIntensity < 0) {
    throw new RangeError(`${componentName} style.material.emissiveIntensity must be nonnegative.`);
  }
  return Object.freeze({ type: 'lambert', emissiveColor, emissiveIntensity });
}

function validateMaterialKeys(componentName: string, value: unknown): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${componentName} style.material must be a Lambert material descriptor.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !materialFields.has(key)) {
      throw new TypeError(`${componentName} style.material.${String(key)} is not supported.`);
    }
  }
}

function toRGBA(color: ReturnType<typeof parseConcreteColor>): WebGLRGBA {
  return Object.freeze([color.red, color.green, color.blue, color.alpha]) as WebGLRGBA;
}
