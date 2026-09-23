import {
  useEventListener,
  type CRCEventHandlers,
  type CRCNode,
} from '@crc/core';
import {
  defineBackendPrimitive,
  getBackendEnvironment,
  setCurrentComponentAfterRender,
} from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import {
  pushWebGLAuthoredTransform,
  resolveWebGLTransform,
} from '../scene/composer.js';
import type { WebGLSceneComposer } from '../scene/types.js';
import type {
  CRCPhysics3DPropExtension,
  CRCWebGLTransformStyle,
} from '../types.js';

export interface Group3DProps
  extends CRCEventHandlers, CRCPhysics3DPropExtension {
  readonly children: CRCNode;
}

export interface Group3DStyle extends CRCWebGLTransformStyle {}

function renderGroup3D(
  props: Readonly<Group3DProps>,
  style: Readonly<Group3DStyle>,
): CRCNode {
  const composer = getBackendEnvironment<WebGLSceneComposer>(
    WEBGL_BACKEND_TOKEN,
  );
  // Validate before acquiring listener or model-stack ownership.
  const localTransform = resolveGroup3DTransform(style);
  useEventListener(props);
  const popModel = pushWebGLAuthoredTransform(composer, localTransform);
  try {
    setCurrentComponentAfterRender(popModel);
  } catch (error) {
    popModel();
    throw error;
  }
  return props.children;
}

/** A listener-only structural boundary that composes a 3D model transform. */
export const Group3D = defineBackendPrimitive<
  Group3DProps,
  Group3DStyle,
  Group3DStyle,
  Group3DStyle,
  WebGLSceneComposer
>(WEBGL_BACKEND_TOKEN, renderGroup3D);

export const resolveGroup3DTransform = resolveWebGLTransform;
