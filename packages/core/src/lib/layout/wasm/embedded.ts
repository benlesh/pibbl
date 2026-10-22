import { bytes } from './bytes.js';
import { hasReadyLayoutModule, publishLayoutModule } from './module.js';

/** Synchronously prepares the shared module for explicit sync hosts and direct layout tests. */
export function prepareLayoutEngineSync(): void {
  if (hasReadyLayoutModule()) return;
  publishLayoutModule(new WebAssembly.Module(
    Uint8Array.from(atob(bytes), character => character.charCodeAt(0)),
  ));
}
