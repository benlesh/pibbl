/**
 * @packageDocumentation
 * Reserved for official CRC packages released in lockstep with `@crc/webgl`.
 * This entry is version-coupled and is not a stable application extension API.
 */

import {
  getBackendEnvironment,
  type CRCInternalPrimitiveAttachmentInput,
} from '@crc/core/internal';
import { WEBGL_BACKEND_TOKEN } from './lib/backend.js';
import {
  Cube,
  getCubePhysicsGeometry,
  resolveCubeTransform,
  type CubeStyle,
} from './lib/components/cube.js';
import {
  Group3D,
  resolveGroup3DTransform,
  type Group3DStyle,
} from './lib/components/group-3d.js';
import {
  Mesh,
  resolveMeshTransform,
  type MeshProps,
  type MeshStyle,
} from './lib/components/mesh.js';
import {
  getSpherePhysicsGeometry,
  resolveSphereTransform,
  Sphere,
  type SphereStyle,
} from './lib/components/sphere.js';
import {
  getWebGLGeometrySnapshot,
  type WebGLGeometrySnapshot,
} from './lib/geometry/geometry.js';
import {
  pushWebGLModelMatrix,
  submitWebGLInstancedSubmission,
} from './lib/scene/composer.js';
import type {
  CRCWebGLAuthoredTransform,
  CRCWebGLInstancedSubmission,
  WebGLSceneComposer,
} from './lib/scene/types.js';
import type { CRCWebGLGeometry } from './lib/types.js';

export { getWebGLGeometrySnapshot };
export type { WebGLGeometrySnapshot };
export type {
  CRCWebGLBounds,
  CRCWebGLInstancedRecipe,
  CRCWebGLInstancedSubmission,
  CRCWebGLLookupTableRecipe,
  CRCWebGLSceneMaterialIntent,
  CRCWebGLSpriteRecipe,
} from './lib/scene/types.js';
export type {
  CRCWebGLAuthoredTransform,
  WebGLTransformQuaternion,
  WebGLTransformVector3,
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

export interface CRCWebGLPhysicsPrimitiveBaseFacts {
  readonly localTransform: CRCWebGLAuthoredTransform;
  readonly authoredParentLineage: readonly CRCWebGLAuthoredTransform[];
}

export interface CRCWebGLPhysicsGroupFacts
  extends CRCWebGLPhysicsPrimitiveBaseFacts {
  readonly kind: 'group';
}

export interface CRCWebGLPhysicsGeometryFacts
  extends CRCWebGLPhysicsPrimitiveBaseFacts {
  readonly kind: 'cube' | 'sphere' | 'mesh';
  readonly geometry: CRCWebGLGeometry;
  readonly geometrySnapshot: WebGLGeometrySnapshot;
}

export type CRCWebGLPhysicsPrimitiveFacts =
  | CRCWebGLPhysicsGroupFacts
  | CRCWebGLPhysicsGeometryFacts;

/**
 * Resolves one supported built-in by receiver identity against the active
 * CPU-only composer. Returned lineage and geometry bytes are immutable
 * snapshots; no mutable composer or GPU state crosses this boundary.
 */
export function resolveWebGLPhysicsPrimitive(
  input: CRCInternalPrimitiveAttachmentInput,
): CRCWebGLPhysicsPrimitiveFacts {
  const composer = getBackendEnvironment<WebGLSceneComposer>(
    WEBGL_BACKEND_TOKEN,
  );
  const authoredParentLineage = Object.freeze([
    ...composer.authoredTransformStack,
  ]);
  if (input.componentType === Group3D) {
    return Object.freeze({
      kind: 'group',
      localTransform: resolveGroup3DTransform(
        input.style as Readonly<Group3DStyle>,
      ),
      authoredParentLineage,
    });
  }
  if (input.componentType === Cube) {
    return geometryFacts(
      'cube',
      getCubePhysicsGeometry(),
      resolveCubeTransform(input.style as Readonly<CubeStyle>),
      authoredParentLineage,
    );
  }
  if (input.componentType === Sphere) {
    return geometryFacts(
      'sphere',
      getSpherePhysicsGeometry(),
      resolveSphereTransform(input.style as Readonly<SphereStyle>),
      authoredParentLineage,
    );
  }
  if (input.componentType === Mesh) {
    const geometry = (input.props as Readonly<MeshProps>).geometry;
    return geometryFacts(
      'mesh',
      geometry,
      resolveMeshTransform(input.style as Readonly<MeshStyle>, 1),
      authoredParentLineage,
    );
  }
  throw new TypeError(
    `${input.componentName} is not a supported WebGL physics primitive; ` +
    'expected Group3D, Cube, Sphere, or Mesh.' + sourceLocation(input),
  );
}

/** Pushes one presentation matrix without adding authored transform lineage. */
export function pushPhysicsPresentation(
  model: Readonly<ArrayLike<number>>,
): () => void {
  if (model.length !== 16) {
    throw new TypeError('WebGL physics presentation matrix must contain 16 values.');
  }
  const snapshot = new Float32Array(16);
  for (let index = 0; index < 16; index += 1) {
    const value = model[index];
    if (!Number.isFinite(value)) {
      throw new TypeError(
        `WebGL physics presentation matrix[${index}] must be finite.`,
      );
    }
    snapshot[index] = value!;
  }
  return pushWebGLModelMatrix(
    getBackendEnvironment<WebGLSceneComposer>(WEBGL_BACKEND_TOKEN),
    snapshot,
  );
}

function geometryFacts(
  kind: CRCWebGLPhysicsGeometryFacts['kind'],
  geometry: CRCWebGLGeometry,
  localTransform: CRCWebGLAuthoredTransform,
  authoredParentLineage: readonly CRCWebGLAuthoredTransform[],
): CRCWebGLPhysicsGeometryFacts {
  return Object.freeze({
    kind,
    geometry,
    geometrySnapshot: getWebGLGeometrySnapshot(geometry),
    localTransform,
    authoredParentLineage,
  });
}

function sourceLocation(input: CRCInternalPrimitiveAttachmentInput): string {
  const source = input.source;
  return source === undefined ? '' :
    ` JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.`;
}
