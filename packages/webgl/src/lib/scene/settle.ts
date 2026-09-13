import { getWebGLGeometryData } from '../geometry/geometry.js';
import { transformPointMatrix4 } from '../math/matrix4.js';
import {
  commitWebGLPickLedger,
  createWebGLPickLedger,
  recordGeometryWebGLPick,
  type CRCWebGLGeometryPickRecord,
} from '../pick-ledger.js';
import { closeWebGLSceneComposer } from './composer.js';
import type { WebGLMeshSubmission, WebGLSceneComposer } from './types.js';

export interface SettledWebGLMesh extends WebGLMeshSubmission {
  readonly viewDepth: number;
}

export interface SettledWebGLScene {
  readonly contextGeneration: number;
  readonly camera: ReturnType<typeof closeWebGLSceneComposer>['camera'];
  readonly logicalViewport: ReturnType<typeof closeWebGLSceneComposer>['logicalViewport'];
  readonly backingViewport: ReturnType<typeof closeWebGLSceneComposer>['backingViewport'];
  readonly density: ReturnType<typeof closeWebGLSceneComposer>['density'];
  readonly timestamp: number;
  readonly meshes: readonly SettledWebGLMesh[];
  readonly opaque: readonly SettledWebGLMesh[];
  readonly transparent: readonly SettledWebGLMesh[];
  readonly pickEntries: readonly CRCWebGLGeometryPickRecord[];
}

/** Closes one CPU-only scene draft and derives its immutable render and pick plans. */
export function settleWebGLScene(composer: WebGLSceneComposer): SettledWebGLScene {
  const draft = closeWebGLSceneComposer(composer);
  const meshes = Object.freeze(draft.meshes.map(mesh => settleMesh(mesh, draft.camera)));
  const opaque: SettledWebGLMesh[] = [];
  const transparent: SettledWebGLMesh[] = [];
  const ledger = createWebGLPickLedger(
    draft.logicalViewport.width,
    draft.logicalViewport.height,
  );

  for (const mesh of meshes) {
    if (mesh.color[3] === 1) opaque.push(mesh);
    else if (mesh.color[3]! > 0 && mesh.color[3]! < 1) transparent.push(mesh);
    if (mesh.target) {
      recordGeometryWebGLPick(ledger, {
        componentName: mesh.componentName,
        target: mesh.target,
        geometry: mesh.geometry,
        model: mesh.model,
        camera: draft.camera,
        keyboardNavigationBounds: mesh.keyboardNavigationBounds,
        sourceOrder: mesh.sourceIndex,
        depthMode: 'less-equal',
      });
    }
  }
  transparent.sort(
    (left, right) => right.viewDepth - left.viewDepth || left.sourceIndex - right.sourceIndex,
  );
  const pickEntries = commitWebGLPickLedger(ledger).entries as readonly CRCWebGLGeometryPickRecord[];
  return Object.freeze({
    contextGeneration: draft.contextGeneration,
    camera: draft.camera,
    logicalViewport: draft.logicalViewport,
    backingViewport: draft.backingViewport,
    density: draft.density,
    timestamp: draft.timestamp,
    meshes,
    opaque: Object.freeze(opaque),
    transparent: Object.freeze(transparent),
    pickEntries,
  });
}

function settleMesh(
  mesh: WebGLMeshSubmission,
  camera: ReturnType<typeof closeWebGLSceneComposer>['camera'],
): SettledWebGLMesh {
  const { bounds } = getWebGLGeometryData(mesh.geometry);
  const center = [
    (bounds.minimumX + bounds.maximumX) / 2,
    (bounds.minimumY + bounds.maximumY) / 2,
    (bounds.minimumZ + bounds.maximumZ) / 2,
  ] as const;
  const world = new Float32Array(3);
  const view = new Float32Array(3);
  transformPointMatrix4(world, mesh.model, center);
  transformPointMatrix4(view, camera.viewMatrix, world);
  const viewDepth = -view[2]!;
  if (!Number.isFinite(viewDepth)) {
    const source = mesh.source;
    const location = source ? ` JSX source: ${source.fileName}:${source.lineNumber}:${source.columnNumber}.` : '';
    throw new RangeError(`${mesh.componentName} geometry bounds produce a non-finite view depth.${location}`);
  }
  return Object.freeze({
    ...mesh,
    model: new Float32Array(mesh.model),
    color: Object.freeze([...mesh.color]) as SettledWebGLMesh['color'],
    viewDepth,
  });
}
