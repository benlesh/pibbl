import {
  createBackendToken,
  type CRCBackendDriver,
  type CRCBackendPrimitiveProgram,
} from '@crc/core/internal';
import type { SystemStyle } from '@crc/core';
import type { ResolvedWebGLCamera } from './math/camera.js';
import {
  releaseWebGLPickParticipation,
  type CRCWebGLGeometryPickRecord,
} from './pick-ledger.js';
import {
  createWebGLSceneComposer,
  discardWebGLSceneComposer,
} from './scene/composer.js';
import { WebGLSceneRenderer } from './scene/renderer.js';
import { settleWebGLScene } from './scene/settle.js';
import type { WebGLSceneComposer } from './scene/types.js';
import type { CRCWebGLShadowQuality } from './types.js';

export const WEBGL_BACKEND_TOKEN = createBackendToken('webgl2');

export interface CreateWebGLBackendOptions {
  readonly gl: WebGL2RenderingContext;
  readonly getCamera: () => ResolvedWebGLCamera;
  readonly getContextGeneration: () => number;
  readonly getShadowQuality?: () => CRCWebGLShadowQuality;
  readonly isContextLost?: (generation: number) => boolean;
}

export interface WebGLCompletedFrame {
  readonly renderedGeneration: number;
  readonly contextGeneration: number;
  readonly pickEntries: readonly CRCWebGLGeometryPickRecord[];
}

export interface WebGLBackendDriver
  extends CRCBackendDriver<WebGLSceneComposer> {
  readonly renderedGeneration: number;
  hasCompletedFrame(): boolean;
  takeFailedFrameTimestamp(): number | undefined;
  takeCompletedFrame(): WebGLCompletedFrame;
  invalidateContext(generation: number): void;
  restoreContext(): void;
}

/** Creates the package-private backend driver owned by one WebGLLayer. */
export function createWebGLBackend(
  options: CreateWebGLBackendOptions,
): WebGLBackendDriver {
  const { gl } = options;
  const isContextLost = options.isContextLost ?? (() => gl.isContextLost());
  let renderer: WebGLSceneRenderer | undefined;
  let rendererGeneration: number | undefined;
  let completedFrame: WebGLCompletedFrame | undefined;
  let failedFrameTimestamp: number | undefined;
  let renderedGeneration = 0;
  let contextAvailable = true;
  let disposed = false;
  const invalidContextGenerations = new Set<number>();
  const finishedComposers = new WeakSet<WebGLSceneComposer>();

  return {
    token: WEBGL_BACKEND_TOKEN,
    name: 'webgl2',
    get renderedGeneration() {
      return renderedGeneration;
    },
    beginFrame(frameInput) {
      const contextGeneration = options.getContextGeneration();
      if (
        disposed ||
        !contextAvailable ||
        invalidContextGenerations.has(contextGeneration)
      ) return undefined;
      const environment = createWebGLSceneComposer({
        frame: frameInput,
        camera: options.getCamera(),
        contextGeneration,
        shadowQuality: options.getShadowQuality?.() ?? 'medium',
      });
      if (
        !contextAvailable ||
        invalidContextGenerations.has(contextGeneration) ||
        options.getContextGeneration() !== contextGeneration
      ) {
        discardWebGLSceneComposer(environment);
        return undefined;
      }
      return { environment };
    },
    enterComponent() {
      return () => undefined;
    },
    runPrimitive(frame, input, runProgram) {
      if (input.style.filter !== undefined) {
        throw new Error(
          `${input.componentName} style.filter is not supported inside ` +
          '<WebGLLayer>; apply the filter to <WebGLLayer> instead.',
        );
      }
      const program = input.definition.program as CRCBackendPrimitiveProgram<
        Record<PropertyKey, unknown>,
        SystemStyle,
        WebGLSceneComposer
      >;
      runProgram(() => program(input.props, input.style, frame.environment));
    },
    finishFrame(frame, success) {
      const composer = frame.environment;
      if (finishedComposers.has(composer)) {
        throw new Error('WebGL backend frame is already finished.');
      }
      finishedComposers.add(composer);
      completedFrame = undefined;
      if (!success) {
        failedFrameTimestamp = composer.timestamp;
        if (composer.state === 'open') discardWebGLSceneComposer(composer);
        releaseComposerPickParticipation(composer);
        return;
      }

      if (isStaleComposer(
        composer,
        options,
        contextAvailable,
        invalidContextGenerations,
      )) {
        failedFrameTimestamp = undefined;
        if (composer.state === 'open') discardWebGLSceneComposer(composer);
        releaseComposerPickParticipation(composer);
        return;
      }

      let settledPickEntries: readonly CRCWebGLGeometryPickRecord[] | undefined;
      let candidateRenderer: WebGLSceneRenderer | undefined;
      let ownsCandidateRenderer = false;
      try {
        const scene = settleWebGLScene(composer);
        settledPickEntries = scene.pickEntries;
        if (isStaleComposer(
          composer,
          options,
          contextAvailable,
          invalidContextGenerations,
        )) {
          releaseWebGLPickParticipation(scene.pickEntries);
          settledPickEntries = undefined;
          failedFrameTimestamp = undefined;
          return;
        }

        if (renderer && rendererGeneration === scene.contextGeneration) {
          candidateRenderer = renderer;
        } else {
          candidateRenderer = new WebGLSceneRenderer(
            gl,
            scene.contextGeneration,
          );
          ownsCandidateRenderer = true;
        }
        candidateRenderer.render(scene);

        if (isStaleComposer(
          composer,
          options,
          contextAvailable,
          invalidContextGenerations,
        )) {
          if (ownsCandidateRenderer) {
            candidateRenderer.dispose(isContextLost(scene.contextGeneration));
          }
          releaseWebGLPickParticipation(scene.pickEntries);
          settledPickEntries = undefined;
          failedFrameTimestamp = undefined;
          return;
        }

        if (ownsCandidateRenderer) {
          const previousRenderer = renderer;
          const previousGeneration = rendererGeneration;
          renderer = candidateRenderer;
          rendererGeneration = scene.contextGeneration;
          if (previousRenderer && previousGeneration !== undefined) {
            previousRenderer.dispose(isContextLost(previousGeneration));
          }
        }
        renderedGeneration += 1;
        failedFrameTimestamp = undefined;
        completedFrame = Object.freeze({
          renderedGeneration,
          contextGeneration: scene.contextGeneration,
          pickEntries: scene.pickEntries,
        });
        settledPickEntries = undefined;
      } catch (error) {
        if (ownsCandidateRenderer && candidateRenderer) {
          runBackendCleanup(() => candidateRenderer!.dispose(
            isContextLost(composer.contextGeneration),
          ));
        }
        if (composer.state === 'open') discardWebGLSceneComposer(composer);
        if (settledPickEntries) {
          releaseWebGLPickParticipation(settledPickEntries);
        } else {
          releaseComposerPickParticipation(composer);
        }
        completedFrame = undefined;
        failedFrameTimestamp = composer.timestamp;
        throw error;
      }
    },
    hasCompletedFrame() {
      return completedFrame !== undefined;
    },
    takeFailedFrameTimestamp() {
      const timestamp = failedFrameTimestamp;
      failedFrameTimestamp = undefined;
      return timestamp;
    },
    takeCompletedFrame() {
      const completed = completedFrame;
      completedFrame = undefined;
      if (!completed) {
        throw new Error('WebGLLayer child traversal did not complete a frame.');
      }
      return completed;
    },
    invalidateContext(generation) {
      contextAvailable = false;
      invalidContextGenerations.add(generation);
      if (renderer && rendererGeneration === generation) {
        renderer.invalidateContext();
        renderer = undefined;
        rendererGeneration = undefined;
      }
      if (completedFrame?.contextGeneration === generation) {
        releaseWebGLPickParticipation(completedFrame.pickEntries);
        completedFrame = undefined;
      }
      failedFrameTimestamp = undefined;
    },
    restoreContext() {
      if (!disposed) contextAvailable = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      contextAvailable = false;
      if (completedFrame) {
        releaseWebGLPickParticipation(completedFrame.pickEntries);
      }
      completedFrame = undefined;
      failedFrameTimestamp = undefined;
      if (renderer && rendererGeneration !== undefined) {
        renderer.dispose(isContextLost(rendererGeneration));
      }
      renderer = undefined;
      rendererGeneration = undefined;
      invalidContextGenerations.clear();
    },
  };
}

function isStaleComposer(
  composer: WebGLSceneComposer,
  options: CreateWebGLBackendOptions,
  contextAvailable: boolean,
  invalidContextGenerations: ReadonlySet<number>,
): boolean {
  return !contextAvailable ||
    invalidContextGenerations.has(composer.contextGeneration) ||
    options.getContextGeneration() !== composer.contextGeneration;
}

function releaseComposerPickParticipation(
  composer: WebGLSceneComposer,
): void {
  const entries = composer.meshes.flatMap(mesh => mesh.target ? [{
    target: mesh.target,
  }] : []) as unknown as readonly CRCWebGLGeometryPickRecord[];
  releaseWebGLPickParticipation(entries);
}

function runBackendCleanup(cleanup: () => void): void {
  try {
    cleanup();
  } catch (error) {
    try {
      globalThis.reportError(error);
    } catch {
      // Cleanup reporting cannot replace the original frame failure.
    }
  }
}
