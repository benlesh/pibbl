import { signal, type WritableSignal } from '@crc/core';
import { onCurrentRenderFinish, useInternalHookSlot } from '@crc/core/internal';
import { releaseInternalWebGLAsset } from '../assets/asset.js';
import type { CRCWebGLAsset } from '../types.js';
import { decodeGLBAsset } from './decode.js';

export type CRCGLTFSource = string | URL | ArrayBuffer;

export type CRCWebGLAssetLoadResult =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly asset: CRCWebGLAsset }
  | { readonly status: 'error'; readonly error: Error };

interface GLTFLoadSlot {
  active: boolean;
  sourceIdentity: string | ArrayBuffer | undefined;
  hasSource: boolean;
  generation: number;
  abortController: AbortController | undefined;
  result: CRCWebGLAssetLoadResult;
  revision: WritableSignal<number>;
}

const LOADING_RESULT: CRCWebGLAssetLoadResult = Object.freeze({
  status: 'loading',
});

/** Loads one component-owned GLB generation after a successful render. */
export function useGLTF(source: CRCGLTFSource): CRCWebGLAssetLoadResult {
  const slot = useInternalHookSlot<GLTFLoadSlot>('webglGLTF', teardowns => {
    const state: GLTFLoadSlot = {
      active: true,
      sourceIdentity: undefined,
      hasSource: false,
      generation: 0,
      abortController: undefined,
      result: LOADING_RESULT,
      revision: signal(0, { debugName: 'useGLTF revision' }),
    };
    teardowns.add(() => retireSlot(state));
    return state;
  });
  const state = slot.value;
  state.revision.get();

  const sourceChanged = !state.hasSource ||
    !Object.is(state.sourceIdentity, identifySource(source));
  const result = sourceChanged ? LOADING_RESULT : state.result;
  onCurrentRenderFinish(success => {
    if (!success || !state.active || !sourceChanged) return;
    adoptSource(state, source);
  });
  return result;
}

function adoptSource(state: GLTFLoadSlot, source: CRCGLTFSource): void {
  retireGeneration(state);
  releaseResult(state.result);
  state.sourceIdentity = identifySource(source);
  state.hasSource = true;
  state.result = LOADING_RESULT;
  const generation = state.generation;
  const abortController = source instanceof ArrayBuffer ?
    undefined : new AbortController();
  state.abortController = abortController;
  void loadAsset(source, abortController?.signal).then(
    asset => publishAsset(state, generation, asset),
    error => publishError(state, generation, source, error),
  );
}

async function loadAsset(
  source: CRCGLTFSource,
  signal: AbortSignal | undefined,
): Promise<CRCWebGLAsset> {
  let bytes: ArrayBuffer;
  if (source instanceof ArrayBuffer) {
    bytes = source.slice(0);
  } else {
    const response = await fetch(source, { mode: 'cors', signal });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`,
      );
    }
    bytes = (await response.arrayBuffer()).slice(0);
  }
  return decodeGLBAsset(bytes, {
    decodeImage: (imageBytes, mimeType) => {
      const copiedImageBytes = new Uint8Array(imageBytes.byteLength);
      copiedImageBytes.set(imageBytes);
      return createImageBitmap(
        new Blob([copiedImageBytes.buffer], { type: mimeType }), {
          colorSpaceConversion: 'none',
          imageOrientation: 'none',
          premultiplyAlpha: 'none',
        },
      );
    },
  });
}

function publishAsset(
  state: GLTFLoadSlot,
  generation: number,
  asset: CRCWebGLAsset,
): void {
  if (!isCurrentGeneration(state, generation)) {
    releaseInternalWebGLAsset(asset);
    return;
  }
  state.abortController = undefined;
  state.result = Object.freeze({ status: 'ready', asset });
  publishRevision(state);
}

function publishError(
  state: GLTFLoadSlot,
  generation: number,
  source: CRCGLTFSource,
  cause: unknown,
): void {
  if (!isCurrentGeneration(state, generation)) return;
  state.abortController = undefined;
  const detail = cause instanceof Error ? cause.message : String(cause);
  const error = new Error(
    `Failed to load GLB asset from ${describeSource(source)}: ${detail}`,
    { cause },
  );
  state.result = Object.freeze({ status: 'error', error });
  publishRevision(state);
}

function describeSource(source: CRCGLTFSource): string {
  if (source instanceof ArrayBuffer) return 'the supplied ArrayBuffer';
  return JSON.stringify(String(source));
}

function identifySource(source: CRCGLTFSource): string | ArrayBuffer {
  return source instanceof ArrayBuffer ? source : String(source);
}

function isCurrentGeneration(
  state: GLTFLoadSlot,
  generation: number,
): boolean {
  return state.active && state.generation === generation;
}

function publishRevision(state: GLTFLoadSlot): void {
  state.revision.update(value => value + 1);
}

function retireSlot(state: GLTFLoadSlot): void {
  if (!state.active) return;
  state.active = false;
  retireGeneration(state);
  releaseResult(state.result);
  state.result = LOADING_RESULT;
}

function retireGeneration(state: GLTFLoadSlot): void {
  state.generation += 1;
  state.abortController?.abort();
  state.abortController = undefined;
}

function releaseResult(result: CRCWebGLAssetLoadResult): void {
  if (result.status === 'ready') releaseInternalWebGLAsset(result.asset);
}
