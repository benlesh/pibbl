import { layoutBinaryHash } from './artifact.js';

declare const __PIBBL_LAYOUT_ASSET_URL__: string;

let compiled: WebAssembly.Module | undefined;
interface Preparation {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  readonly transport: AbortController;
}
let preparation: Preparation | undefined;

/** The generated asset is relative to this module in both source and packed output. */
export function layoutAssetUrl(): URL {
  return typeof __PIBBL_LAYOUT_ASSET_URL__ === 'string'
    ? new URL(__PIBBL_LAYOUT_ASSET_URL__, document.baseURI)
    : new URL('./layout.wasm', import.meta.url);
}

/** Shares immutable compiled code only. Instances and mutable memories belong to mounts. */
export function readyLayoutModule(): WebAssembly.Module {
  if (!compiled) throw new Error('Prepare the layout engine before synchronous layout: await prepareLayoutEngine(), or mount with pibblSync from @pibbl/core/sync.');
  return compiled;
}

export function hasReadyLayoutModule(): boolean { return compiled !== undefined; }

export function publishLayoutModule(module: WebAssembly.Module): void {
  if (compiled) return;
  const exports = WebAssembly.Module.exports(module);
  if (!exports.some(entry => entry.name === 'layout_abi_v14' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'prepare_intrinsic_main_queries' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resize_intrinsic_main' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resolve_intrinsic_main' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'intrinsic_main_result' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'intrinsic_main_contribution' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resolve_intrinsic_main_known_owner' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'intrinsic_main_auto_free' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'place_main_auto_staged' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'place_wrap_first_baseline' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'place_first_baseline' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resize_main_auto' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'place_main_auto' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'place_wrap_main_auto' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'memory' && entry.kind === 'memory') ||
      !exports.some(entry => entry.name === 'solve' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'dispose' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resize_flow' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'place_flow' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resize_grid_cells' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'place_grid_cells' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resize_grid' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'resolve_grid_tracks' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'arena_create' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'arena_generation' && entry.kind === 'function') ||
      !exports.some(entry => entry.name === 'arena_dispose' && entry.kind === 'function')) {
    throw new Error('Layout WASM ABI is incompatible with this runtime.');
  }
  compiled = module;
  const pending = preparation;
  preparation = undefined;
  pending?.resolve();
  pending?.transport.abort();
}

/** Fetches and compiles once per attempt; failures are evicted for explicit retries. */
export function prepareLayoutModule(): Promise<void> {
  if (compiled) return Promise.resolve();
  if (preparation) return preparation.promise;
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((accept, fail) => { resolve = accept; reject = fail; });
  const attempt: Preparation = { promise, resolve, reject, transport: new AbortController() };
  preparation = attempt;
  void load(attempt);
  return promise;
}

async function load(attempt: Preparation): Promise<void> {
  let url: URL | undefined;
  let phase = 'fetch';
  try {
    url = layoutAssetUrl();
    const response = await fetch(url, { signal: attempt.transport.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const binary = await response.arrayBuffer();
    if (compiled) return;
    phase = 'integrity';
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', binary));
    let hex = '';
    for (let i = 0; i < hash.length; i++) hex += hash[i].toString(16).padStart(2, '0');
    if (hex !== layoutBinaryHash) throw new Error('Layout WASM fingerprint differs from this runtime.');
    phase = 'compile';
    const module = await WebAssembly.compile(binary);
    if (preparation === attempt && !compiled) publishLayoutModule(module);
  } catch (cause) {
    if (compiled || preparation !== attempt) return;
    preparation = undefined;
    attempt.reject(new Error(`Layout WASM ${phase} failed at ${url?.href ?? 'layout asset URL'}`, { cause }));
  }
}
