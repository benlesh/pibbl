import {
  defineBackendPrimitive,
  getBackendEnvironment,
  getCurrentElementSource,
  useBackendEventTarget,
  useInternalHookSlot,
} from '@crc/core/internal';
import {
  acquireInternalWebGLAsset,
  getInternalWebGLAssetData,
} from '../assets/asset.js';
import type {
  CRCWebGLAssetData,
  CRCWebGLAssetPrimitiveRecord,
} from '../assets/types.js';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import { composeModelMatrix4, multiplyMatrix4 } from '../math/matrix4.js';
import type { WebGLSceneComposer, WebGLRGBA } from '../scene/types.js';
import type {
  CRCWebGLAsset,
  CRCWebGLTargetProps,
  CRCWebGLTransformStyle,
} from '../types.js';
import {
  resolveOpacity,
  resolveShadowBoolean,
  submitResolvedWebGLMesh,
} from './mesh.js';
import { parseConcreteColor } from './style-values.js';

export interface ModelProps extends CRCWebGLTargetProps {
  readonly asset: CRCWebGLAsset;
}

export interface ModelStyle extends CRCWebGLTransformStyle {
  readonly opacity?: number;
  readonly color?: string;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly cursor?: string;
}

interface ModelAssetSlot {
  asset: CRCWebGLAsset;
  data: CRCWebGLAssetData;
  release: () => void;
  identities: Map<CRCWebGLAssetPrimitiveRecord, object>;
}

function renderModel(
  props: Readonly<ModelProps>,
  style: Readonly<ModelStyle>,
): void {
  const assetSlot = useModelAsset(props.asset);
  const target = useBackendEventTarget(
    props,
    {
      cursor: style.cursor,
      deferKeyboardNavigationGeometry: true,
      keyboardFocusable: props.keyboardFocusable,
    },
    props.pointerEvents === 'none' ? 'none' : 'auto',
  );
  const composer = getBackendEnvironment<WebGLSceneComposer>(
    WEBGL_BACKEND_TOKEN,
  );
  const opacity = resolveOpacity('Model', style.opacity);
  const color = parseConcreteColor(
    'Model',
    'style.color',
    style.color ?? '#ffffff',
  );
  const finalColor = Object.freeze([
    color.red,
    color.green,
    color.blue,
    color.alpha * opacity,
  ]) as WebGLRGBA;
  const castShadow = resolveShadowBoolean(
    'Model',
    'castShadow',
    style.castShadow,
  );
  const receiveShadow = resolveShadowBoolean(
    'Model',
    'receiveShadow',
    style.receiveShadow,
  );
  const instanceModel = new Float32Array(16);
  composeModelMatrix4(instanceModel, style);
  const source = getCurrentElementSource();

  for (const primitive of assetSlot.data.primitives) {
    let identity = assetSlot.identities.get(primitive);
    if (!identity) {
      identity = Object.freeze({});
      assetSlot.identities.set(primitive, identity);
    }
    const localModel = new Float32Array(16);
    multiplyMatrix4(localModel, instanceModel, primitive.modelMatrix);
    submitResolvedWebGLMesh(composer, {
      componentName: 'Model',
      source,
      geometry: primitive.geometry,
      identity,
      localModel,
      color: finalColor,
      lit: true,
      material: primitive.material,
      castShadow,
      receiveShadow,
      target,
      keyboardNavigationBounds: props.keyboardNavigationBounds,
    });
  }
}

function useModelAsset(asset: CRCWebGLAsset): ModelAssetSlot {
  const slot = useInternalHookSlot<ModelAssetSlot>(
    'webglModelAsset',
    teardowns => {
      const value = acquireModelAsset(asset);
      teardowns.add(() => value.release());
      return value;
    },
  );
  if (slot.value.asset !== asset) {
    const next = acquireModelAsset(asset);
    const releasePrevious = slot.value.release;
    slot.value.asset = next.asset;
    slot.value.data = next.data;
    slot.value.release = next.release;
    slot.value.identities = next.identities;
    releasePrevious();
  }
  return slot.value;
}

function acquireModelAsset(asset: CRCWebGLAsset): ModelAssetSlot {
  let release: (() => void) | undefined;
  try {
    release = acquireInternalWebGLAsset(asset);
    return {
      asset,
      data: getInternalWebGLAssetData(asset),
      release,
      identities: new Map(),
    };
  } catch (error) {
    release?.();
    if (
      error instanceof Error &&
      error.message === 'WebGL asset descriptor is invalid or released.'
    ) {
      throw new Error('Model asset is invalid or released.', { cause: error });
    }
    throw error;
  }
}

/** Expands one opaque immutable asset under one logical event/focus target. */
export const Model = defineBackendPrimitive<
  ModelProps,
  ModelStyle,
  ModelStyle,
  ModelStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderModel);
