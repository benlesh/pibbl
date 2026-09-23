import type {
  CRCWebGLMaterial,
  CRCWebGLPBRMetallicRoughnessMaterial,
} from '../types.js';
import type { WebGLRGBA } from '../scene/types.js';
import { getInternalWebGLTextureData } from '../texture/texture.js';
import { parseConcreteColor } from './style-values.js';

export interface ResolvedWebGLLambertMaterial {
  readonly type: 'lambert';
  readonly emissiveColor: WebGLRGBA;
  readonly emissiveIntensity: number;
}

export type ResolvedWebGLPBRMetallicRoughnessMaterial =
  CRCWebGLPBRMetallicRoughnessMaterial;

export type ResolvedWebGLMaterial =
  | ResolvedWebGLLambertMaterial
  | ResolvedWebGLPBRMetallicRoughnessMaterial;

const materialFields = new Set(['type', 'emissiveColor', 'emissiveIntensity']);
const pbrMaterialFields = new Set([
  'type',
  'baseColorFactor',
  'baseColorTexture',
  'metallicFactor',
  'roughnessFactor',
]);

export const DEFAULT_WEBGL_MATERIAL: ResolvedWebGLLambertMaterial = Object.freeze({
  type: 'lambert',
  emissiveColor: Object.freeze([0, 0, 0, 1]) as WebGLRGBA,
  emissiveIntensity: 1,
});

export function resolveWebGLMaterial(
  componentName: string,
  value: CRCWebGLMaterial | undefined,
): ResolvedWebGLLambertMaterial {
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

/** Resolves the closed imported material subset without exposing it publicly. */
export function resolveWebGLPBRMetallicRoughnessMaterial(
  componentName: string,
  value: unknown,
): ResolvedWebGLPBRMetallicRoughnessMaterial {
  const material = value as Partial<CRCWebGLPBRMetallicRoughnessMaterial>;
  if (typeof value !== 'object' || value === null || Array.isArray(value) ||
    material.type !== 'pbr-metallic-roughness') {
    throw new TypeError(
      `${componentName} material.type must be "pbr-metallic-roughness".`,
    );
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !pbrMaterialFields.has(key)) {
      throw new TypeError(
        `${componentName} material.${String(key)} is not supported.`,
      );
    }
  }
  const baseColorFactor = material.baseColorFactor ?? [1, 1, 1, 1];
  if (baseColorFactor.length !== 4 ||
    baseColorFactor.some(factor => !isUnitFactor(factor))) {
    throw new RangeError(
      `${componentName} material.baseColorFactor must contain only finite ` +
      'values between 0 and 1.',
    );
  }
  const metallicFactor = material.metallicFactor ?? 1;
  if (!isUnitFactor(metallicFactor)) {
    throw new RangeError(
      `${componentName} material.metallicFactor must contain only finite ` +
      'values between 0 and 1.',
    );
  }
  const roughnessFactor = material.roughnessFactor ?? 1;
  if (!isUnitFactor(roughnessFactor)) {
    throw new RangeError(
      `${componentName} material.roughnessFactor must contain only finite ` +
      'values between 0 and 1.',
    );
  }
  let baseColorTexture: CRCWebGLPBRMetallicRoughnessMaterial['baseColorTexture'];
  if (material.baseColorTexture !== undefined) {
    const binding = material.baseColorTexture;
    if (typeof binding !== 'object' || binding === null ||
      binding.textureCoordinate !== 0) {
      throw new TypeError(
        `${componentName} material.baseColorTexture must use textureCoordinate 0.`,
      );
    }
    getInternalWebGLTextureData(binding.texture);
    baseColorTexture = Object.freeze({
      texture: binding.texture,
      textureCoordinate: 0,
    });
  }
  return Object.freeze({
    type: 'pbr-metallic-roughness',
    baseColorFactor: Object.freeze([...baseColorFactor]) as
      readonly [number, number, number, number],
    ...(baseColorTexture === undefined ? {} : {
      baseColorTexture,
    }),
    metallicFactor,
    roughnessFactor,
  });
}

function isUnitFactor(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    value >= 0 && value <= 1;
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
