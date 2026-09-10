import { getBackendEnvironment } from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from '../backend.js';
import type { WebGLRenderEnvironment } from '../render-environment.js';
import type { CRCWebGLContext } from '../types.js';

const CRC_WEBGL_CONTEXT_ERROR =
  'crcWebGLContext() is only available during WebGL primitive rendering. ' +
  'In Canvas 2D rendering and pure measurement it is not available; use it ' +
  'under <WebGLLayer>.';

/** Reads the immutable context snapshot for the active WebGL primitive. */
export function crcWebGLContext(): CRCWebGLContext {
  let environment: WebGLRenderEnvironment;
  try {
    environment = getBackendEnvironment<WebGLRenderEnvironment>(
      WEBGL_BACKEND_TOKEN,
    );
  } catch {
    throw new Error(CRC_WEBGL_CONTEXT_ERROR);
  }
  if (!environment.activeContext) {
    throw new Error(CRC_WEBGL_CONTEXT_ERROR);
  }
  return environment.activeContext;
}
