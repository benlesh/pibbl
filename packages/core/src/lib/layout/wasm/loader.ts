import type { pibbl } from '../../pibbl.js';
import { layoutWasmBinaryFingerprint } from './fingerprint.js';
import { prepareExternalLayoutModule } from './module-cache.js';

export { getPreparedLayoutModule } from './module-cache.js';

async function verifyLayoutBinary(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (fingerprint !== layoutWasmBinaryFingerprint) {
    throw new Error('The fetched layout engine does not match the generated binary fingerprint.');
  }
  return bytes;
}

async function compileExternalLayoutModule(): Promise<WebAssembly.Module> {
  const asset = new URL('./layout.wasm', import.meta.url);
  let response: Response;
  try {
    response = await fetch(asset);
  } catch (error) {
    throw new Error(`Unable to fetch the layout engine at ${asset.href}.`, { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Unable to fetch the layout engine at ${asset.href}: HTTP ${response.status}.`);
  }
  try {
    return await WebAssembly.compile(await verifyLayoutBinary(await response.arrayBuffer()));
  } catch (error) {
    throw new Error(`Unable to compile the layout engine at ${asset.href}.`, { cause: error });
  }
}

/**
 * Fetches, verifies and compiles the external layout binary before mounting.
 * Concurrent callers share one attempt; failures are evicted for an explicit retry.
 * This operation creates no mount, mutable instance, subscription or frame.
 * @returns A Promise resolved when the compatible compiled module is ready for mounting.
 * @throws Rejects with asset and phase context on fetch, fingerprint or compilation failure.
 * @see {@link pibbl}
 */
export function prepareLayoutEngine(): Promise<void> {
  return prepareExternalLayoutModule(compileExternalLayoutModule, layoutWasmBinaryFingerprint);
}
