import {
  defineBackendPrimitive,
  getBackendEnvironment,
  getCurrentElementSource,
} from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { composeModelMatrix4 } from '../math/matrix4.js';
import { submitWebGLLight } from '../scene/composer.js';
import type { WebGLRGBA, WebGLSceneComposer } from '../scene/types.js';
import type { CRCWebGLTransformStyle } from '../types.js';
import { parseConcreteColor } from './style-values.js';

declare const lightDeclarationPropsMarker: unique symbol;

interface LightDeclarationProps {
  readonly [lightDeclarationPropsMarker]?: never;
}

export interface AmbientLightProps extends LightDeclarationProps {}
export interface HemisphereLightProps extends LightDeclarationProps {}
export interface DirectionalLightProps extends LightDeclarationProps {}
export interface PointLightProps extends LightDeclarationProps {}
export interface SpotLightProps extends LightDeclarationProps {}

export interface AmbientLightStyle {
  readonly color?: string;
  readonly intensity?: number;
}

export interface HemisphereLightStyle extends CRCWebGLTransformStyle {
  readonly skyColor?: string;
  readonly groundColor?: string;
  readonly intensity?: number;
}

export interface DirectionalLightStyle extends CRCWebGLTransformStyle {
  readonly color?: string;
  readonly intensity?: number;
}

export interface PointLightStyle extends DirectionalLightStyle {
  readonly range?: number;
}

export interface SpotLightStyle extends PointLightStyle {
  readonly innerConeAngleDegrees?: number;
  readonly outerConeAngleDegrees?: number;
}

type AmbientPrimitiveStyle = AmbientLightStyle & { readonly filter?: never };

const transformFields = [
  'translateX',
  'translateY',
  'translateZ',
  'rotationXDegrees',
  'rotationYDegrees',
  'rotationZDegrees',
  'scaleX',
  'scaleY',
  'scaleZ',
] as const;
const ambientFields = new Set(['color', 'intensity']);
const hemisphereFields = new Set([
  ...transformFields,
  'skyColor',
  'groundColor',
  'intensity',
]);
const directionalFields = new Set([
  ...transformFields,
  'color',
  'intensity',
]);
const pointFields = new Set([...directionalFields, 'range']);
const spotFields = new Set([
  ...pointFields,
  'innerConeAngleDegrees',
  'outerConeAngleDegrees',
]);

function renderAmbientLight(
  props: Readonly<AmbientLightProps>,
  style: Readonly<AmbientPrimitiveStyle>,
): void {
  const componentName = 'AmbientLight';
  validateDeclarationProps(componentName, props);
  validateStyleKeys(componentName, style, ambientFields);
  submitWebGLLight(currentComposer(), {
    kind: 'ambient',
    componentName,
    source: getCurrentElementSource(),
    color: resolveColor(componentName, 'style.color', style.color),
    intensity: resolveIntensity(componentName, style.intensity),
  });
}

function renderHemisphereLight(
  props: Readonly<HemisphereLightProps>,
  style: Readonly<HemisphereLightStyle>,
): void {
  const componentName = 'HemisphereLight';
  validateDeclarationProps(componentName, props);
  validateStyleKeys(componentName, style, hemisphereFields);
  submitWebGLLight(currentComposer(), {
    kind: 'hemisphere',
    componentName,
    source: getCurrentElementSource(),
    localModel: resolveLocalModel(style),
    skyColor: resolveColor(componentName, 'style.skyColor', style.skyColor),
    groundColor: resolveColor(
      componentName,
      'style.groundColor',
      style.groundColor,
    ),
    intensity: resolveIntensity(componentName, style.intensity),
  });
}

function renderDirectionalLight(
  props: Readonly<DirectionalLightProps>,
  style: Readonly<DirectionalLightStyle>,
): void {
  submitDirectionalLight('DirectionalLight', props, style);
}

function renderPointLight(
  props: Readonly<PointLightProps>,
  style: Readonly<PointLightStyle>,
): void {
  const componentName = 'PointLight';
  validateDeclarationProps(componentName, props);
  validateStyleKeys(componentName, style, pointFields);
  submitWebGLLight(currentComposer(), {
    kind: 'point',
    componentName,
    source: getCurrentElementSource(),
    localModel: resolveLocalModel(style),
    color: resolveColor(componentName, 'style.color', style.color),
    intensity: resolveIntensity(componentName, style.intensity),
    range: resolveRange(componentName, style.range),
  });
}

function renderSpotLight(
  props: Readonly<SpotLightProps>,
  style: Readonly<SpotLightStyle>,
): void {
  const componentName = 'SpotLight';
  validateDeclarationProps(componentName, props);
  validateStyleKeys(componentName, style, spotFields);
  const innerConeAngleDegrees = resolveConeAngle(
    componentName,
    'innerConeAngleDegrees',
    style.innerConeAngleDegrees ?? 0,
  );
  const outerConeAngleDegrees = resolveConeAngle(
    componentName,
    'outerConeAngleDegrees',
    style.outerConeAngleDegrees ?? 45,
  );
  if (innerConeAngleDegrees > outerConeAngleDegrees) {
    throw new RangeError(
      `${componentName} style.innerConeAngleDegrees must not exceed ` +
      'style.outerConeAngleDegrees.',
    );
  }
  submitWebGLLight(currentComposer(), {
    kind: 'spot',
    componentName,
    source: getCurrentElementSource(),
    localModel: resolveLocalModel(style),
    color: resolveColor(componentName, 'style.color', style.color),
    intensity: resolveIntensity(componentName, style.intensity),
    range: resolveRange(componentName, style.range),
    innerConeAngleDegrees,
    outerConeAngleDegrees,
  });
}

function submitDirectionalLight(
  componentName: string,
  props: Readonly<DirectionalLightProps>,
  style: Readonly<DirectionalLightStyle>,
): void {
  validateDeclarationProps(componentName, props);
  validateStyleKeys(componentName, style, directionalFields);
  submitWebGLLight(currentComposer(), {
    kind: 'directional',
    componentName,
    source: getCurrentElementSource(),
    localModel: resolveLocalModel(style),
    color: resolveColor(componentName, 'style.color', style.color),
    intensity: resolveIntensity(componentName, style.intensity),
  });
}

function currentComposer(): WebGLSceneComposer {
  return getBackendEnvironment<WebGLSceneComposer>(WEBGL_BACKEND_TOKEN);
}

function resolveLocalModel(style: Readonly<CRCWebGLTransformStyle>): Float32Array {
  const localModel = new Float32Array(16);
  composeModelMatrix4(localModel, style);
  return localModel;
}

function resolveColor(
  componentName: string,
  fieldName: string,
  value: string | undefined,
): WebGLRGBA {
  const color = parseConcreteColor(componentName, fieldName, value ?? '#ffffff');
  return Object.freeze([
    color.red,
    color.green,
    color.blue,
    color.alpha,
  ]) as WebGLRGBA;
}

function resolveIntensity(componentName: string, value: number | undefined): number {
  const intensity = value ?? 1;
  if (typeof intensity !== 'number' || !Number.isFinite(intensity)) {
    throw new TypeError(`${componentName} style.intensity must be finite.`);
  }
  if (intensity < 0) {
    throw new RangeError(`${componentName} style.intensity must be nonnegative.`);
  }
  return intensity;
}

function resolveRange(
  componentName: string,
  value: number | undefined,
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${componentName} style.range must be finite.`);
  }
  if (value <= 0) {
    throw new RangeError(`${componentName} style.range must be positive.`);
  }
  return value;
}

function resolveConeAngle(
  componentName: string,
  fieldName: 'innerConeAngleDegrees' | 'outerConeAngleDegrees',
  value: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${componentName} style.${fieldName} must be finite.`);
  }
  if (value < 0 || value > 90) {
    throw new RangeError(
      `${componentName} style.${fieldName} must be between 0 and 90 degrees.`,
    );
  }
  return value;
}

function validateDeclarationProps(
  componentName: string,
  props: object,
): void {
  for (const key of Reflect.ownKeys(props)) {
    throw new TypeError(
      `${componentName} prop.${String(key)} is not supported.`,
    );
  }
}

function validateStyleKeys(
  componentName: string,
  style: object,
  fields: ReadonlySet<string>,
): void {
  for (const key of Reflect.ownKeys(style)) {
    if (typeof key !== 'string' || !fields.has(key)) {
      throw new TypeError(
        `${componentName} style.${String(key)} is not supported.`,
      );
    }
  }
}

export const AmbientLight = defineBackendPrimitive<
  AmbientLightProps,
  AmbientPrimitiveStyle,
  AmbientPrimitiveStyle,
  AmbientPrimitiveStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderAmbientLight);

export const HemisphereLight = defineBackendPrimitive<
  HemisphereLightProps,
  HemisphereLightStyle,
  HemisphereLightStyle,
  HemisphereLightStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderHemisphereLight);

export const DirectionalLight = defineBackendPrimitive<
  DirectionalLightProps,
  DirectionalLightStyle,
  DirectionalLightStyle,
  DirectionalLightStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderDirectionalLight);

export const PointLight = defineBackendPrimitive<
  PointLightProps,
  PointLightStyle,
  PointLightStyle,
  PointLightStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderPointLight);

export const SpotLight = defineBackendPrimitive<
  SpotLightProps,
  SpotLightStyle,
  SpotLightStyle,
  SpotLightStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderSpotLight);
