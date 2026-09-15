import {
  defineBackendPrimitive,
  getBackendEnvironment,
  getCurrentElementSource,
  useBackendEventTarget,
  useInternalHookSlot,
} from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import {
  composeModelMatrix4,
} from '../math/matrix4.js';
import { resolveWebGLMaterial } from './material.js';
import { parseConcreteColor } from './style-values.js';
import { submitWebGLMesh } from '../scene/composer.js';
import type { WebGLSceneComposer, WebGLRGBA } from '../scene/types.js';
import type {
  CRCWebGLGeometry,
  CRCWebGLTargetProps,
  CRCWebGLTransformStyle,
  CRCWebGLMaterial,
} from '../types.js';

export interface MeshProps extends CRCWebGLTargetProps {
  readonly geometry: CRCWebGLGeometry;
}

export interface MeshStyle extends CRCWebGLTransformStyle {
  readonly color?: string;
  readonly opacity?: number;
  readonly lit?: boolean;
  readonly material?: CRCWebGLMaterial;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly cursor?: string;
}

function renderMesh(
  props: Readonly<MeshProps>,
  style: Readonly<MeshStyle>,
): void {
  submitBuiltInMesh('Mesh', props, props.geometry, style, 1);
}

/** Submits one built-in geometry to the current frame's CPU-only composer. */
export function submitBuiltInMesh(
  componentName: string,
  props: Readonly<CRCWebGLTargetProps>,
  geometry: CRCWebGLGeometry,
  style: Readonly<MeshStyle>,
  uniformScale: number,
): void {
  const composer = getBackendEnvironment<WebGLSceneComposer>(
    WEBGL_BACKEND_TOKEN,
  );
  const opacity = resolveOpacity(componentName, style.opacity);
  const color = parseConcreteColor(componentName, 'style.color', style.color ?? '#ffffff');
  const lit = resolveLit(componentName, style.lit);
  const material = resolveWebGLMaterial(componentName, style.material);
  const castShadow = resolveShadowBoolean(
    componentName,
    'castShadow',
    style.castShadow,
  );
  const receiveShadow = resolveShadowBoolean(
    componentName,
    'receiveShadow',
    style.receiveShadow,
  );
  const localModel = new Float32Array(16);
  composeModelMatrix4(localModel, scaledStyle(style, uniformScale));
  const target = useBackendEventTarget(
    props,
    {
      cursor: style.cursor,
      deferKeyboardNavigationGeometry: true,
      keyboardFocusable: props.keyboardFocusable,
    },
    props.pointerEvents === 'none' ? 'none' : 'auto',
  );
  const identity = useInternalHookSlot(
    'webglMeshIdentity',
    () => Object.freeze({}),
  ).value;
  const finalColor = Object.freeze([
    color.red,
    color.green,
    color.blue,
    color.alpha * opacity,
  ]) as WebGLRGBA;
  submitWebGLMesh(composer, {
    componentName,
    source: getCurrentElementSource(),
    geometry,
    identity,
    localModel,
    color: finalColor,
    lit,
    material,
    castShadow,
    receiveShadow,
    target,
    keyboardNavigationBounds: props.keyboardNavigationBounds,
  });
}

function resolveShadowBoolean(
  componentName: string,
  field: 'castShadow' | 'receiveShadow',
  value: boolean | undefined,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw new TypeError(`${componentName} style.${field} must be a boolean.`);
  }
  return value;
}

function resolveLit(componentName: string, value: boolean | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'boolean') {
    throw new TypeError(`${componentName} style.lit must be a boolean.`);
  }
  return value;
}

/** Geometry capability stays present even when paint opacity resolves to zero. */
export const Mesh = defineBackendPrimitive<
  MeshProps,
  MeshStyle,
  MeshStyle,
  MeshStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderMesh);

function scaledStyle(
  style: Readonly<MeshStyle>,
  uniformScale: number,
): CRCWebGLTransformStyle {
  return {
    translateX: style.translateX,
    translateY: style.translateY,
    translateZ: style.translateZ,
    rotationXDegrees: style.rotationXDegrees,
    rotationYDegrees: style.rotationYDegrees,
    rotationZDegrees: style.rotationZDegrees,
    scaleX: (style.scaleX ?? 1) * uniformScale,
    scaleY: (style.scaleY ?? 1) * uniformScale,
    scaleZ: (style.scaleZ ?? 1) * uniformScale,
  };
}

function resolveOpacity(componentName: string, value: number | undefined) {
  const opacity = value ?? 1;
  if (!Number.isFinite(opacity)) {
    throw new TypeError(`${componentName} style.opacity must be finite.`);
  }
  if (opacity < 0 || opacity > 1) {
    throw new RangeError(
      `${componentName} style.opacity must be between 0 and 1.`,
    );
  }
  return opacity;
}
