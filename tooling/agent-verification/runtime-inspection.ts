import { captureRuntimeBinding, compareRuntimeBindings } from './runtime-identity';
import { createTargetingInspector } from './targeting';

/** Opt-in source-development handshake. The application must capture its binding
 * in the graph that actually owns its Canvas; this is not global discovery.
 * The supplied binding is compared synchronously and never retained.
 */
export function createRuntimeCheckedInspector(canvas: HTMLCanvasElement, applicationBinding: unknown) {
  const diagnostic = compareRuntimeBindings(captureRuntimeBinding(), applicationBinding);
  if (diagnostic.relation !== 'same-runtime' || diagnostic.versions !== 'matching') {
    return Object.freeze({
      status: 'blocked' as const, diagnostic, inspector: null,
      reason: diagnostic.versions === 'mismatched'
        ? 'Declared core versions differ; align the application and inspector runtime before querying.'
        : diagnostic.relation === 'separate-realms'
          ? 'Create the inspector in the application realm; separate realms have independent schedulers and mount registries.'
          : diagnostic.relation === 'duplicate-runtime'
            ? 'Use the application-owned CRC module graph; a duplicate runtime cannot inspect its mounts.'
            : 'A coherent matching application runtime binding is required before querying.',
    });
  }
  return Object.freeze({
    status: 'accepted' as const, diagnostic,
    inspector: createTargetingInspector(canvas),
    reason: null,
  });
}
