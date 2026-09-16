/**
 * @packageDocumentation
 * Reserved for official CRC packages released in lockstep with `@crc/webgl`.
 * This entry is version-coupled and is not a third-party custom shader API.
 */

import { getBackendEnvironment } from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from './lib/backend.js';
import { submitWebGLInstancedSubmission } from './lib/scene/composer.js';
import type {
  CRCWebGLInstancedSubmission,
  WebGLSceneComposer,
} from './lib/scene/types.js';

export type {
  CRCWebGLBounds,
  CRCWebGLInstancedRecipe,
  CRCWebGLInstancedSubmission,
  CRCWebGLLookupTableRecipe,
  CRCWebGLSceneMaterialIntent,
  CRCWebGLSpriteRecipe,
} from './lib/scene/types.js';

/** Contributes one closed instanced declaration to the active WebGL scene. */
export function submitWebGLInstanced(
  input: CRCWebGLInstancedSubmission,
): void {
  submitWebGLInstancedSubmission(
    getBackendEnvironment<WebGLSceneComposer>(WEBGL_BACKEND_TOKEN),
    input,
  );
}
