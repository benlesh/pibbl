import { bytes } from './bytes.js';
import { layoutWasmBinaryFingerprint } from './fingerprint.js';
import { getPreparedLayoutModule, publishPreparedLayoutModule } from './module-cache.js';

function decodeEmbeddedLayoutModule(): WebAssembly.Module {
  return new WebAssembly.Module(
    Uint8Array.from(atob(bytes), character => character.charCodeAt(0)),
  );
}

/** Synchronously prepares the embedded generated layout binary. */
export function prepareLayoutEngineSync(): void {
  try {
    getPreparedLayoutModule();
  } catch {
    publishPreparedLayoutModule(decodeEmbeddedLayoutModule(), layoutWasmBinaryFingerprint);
  }
}
