import {
  crcEventListener,
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
  pushWebGLModelMatrix,
} from '../scene/composer.js';
import type { WebGLSceneComposer } from '../scene/types.js';
import { composeModelMatrix4 } from '../math/matrix4.js';
import type { CRCWebGLTransformStyle } from '../types.js';

export interface Group3DProps extends CRCEventHandlers {
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
  const localModel = new Float32Array(16);
  composeModelMatrix4(localModel, style);
  crcEventListener(props);
  const popModel = pushWebGLModelMatrix(composer, localModel);
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
