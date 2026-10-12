import { pibbl } from '../../packages/core/src/lib/pibbl';
import { snapshotRealmScheduler } from '../../packages/core/src/lib/scheduler/realm-scheduler';
import { version } from '../../packages/core/package.json';

/** Explicit in-process source-development binding; never serialize its references.
 * This is diagnostic evidence supplied by cooperating runtimes, not attestation
 * or a sandbox for arbitrary objects/Proxies. Holding it retains its realm.
 */
export function captureRuntimeBinding() {
  return Object.freeze({
    schema: 'pibbl-runtime-binding/1' as const,
    realm: globalThis,
    runtime: pibbl,
    scheduler: snapshotRealmScheduler,
    version,
  });
}

type Binding = ReturnType<typeof captureRuntimeBinding>;
function binding(value: unknown): Binding | null {
  if (!value || typeof value !== 'object') return null;
  try {
    const result: Record<string, unknown> = {};
    for (const key of ['schema', 'realm', 'runtime', 'scheduler', 'version']) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) return null;
      result[key] = descriptor.value;
    }
    if (result.schema !== 'pibbl-runtime-binding/1' || !result.realm || typeof result.realm !== 'object' ||
      typeof result.runtime !== 'function' || typeof result.scheduler !== 'function' ||
      typeof result.version !== 'string' || result.version.length === 0 || result.version.length > 64) return null;
    return result as unknown as Binding;
  } catch { return null; }
}

/** Does not invoke either runtime, inspect signals, or discover other windows. */
export function compareRuntimeBindings(left: unknown, right: unknown) {
  const a = binding(left), b = binding(right);
  if (!a || !b) return Object.freeze({
    schema: 'pibbl-runtime-comparison/1', scope: 'explicit-in-process-bindings',
    relation: 'unavailable', schedulers: 'unknown', versions: 'unknown',
    compatibility: 'unestablished', reason: 'Both participants must supply live explicit runtime bindings; serialized or arbitrary values are not identity evidence.',
  });
  const sameRealm = a.realm === b.realm;
  const sameRuntime = a.runtime === b.runtime;
  const sameScheduler = a.scheduler === b.scheduler;
  const relation = sameRuntime !== sameScheduler || (!sameRealm && (sameRuntime || sameScheduler)) ? 'inconsistent-binding'
    : !sameRealm ? 'separate-realms' : sameRuntime ? 'same-runtime' : 'duplicate-runtime';
  return Object.freeze({
    schema: 'pibbl-runtime-comparison/1', scope: 'explicit-in-process-bindings', relation,
    schedulers: sameScheduler ? 'shared' : 'independent',
    versions: a.version === b.version ? 'matching' : 'mismatched',
    leftVersion: a.version, rightVersion: b.version,
    compatibility: a.version === b.version ? 'same-declared-version-not-api-proof' : 'version-mismatch',
    reason: relation === 'separate-realms' ? 'Separate JavaScript realms legitimately own independent Pibbl schedulers.'
      : relation === 'duplicate-runtime' ? 'Distinct Pibbl runtime and scheduler identities were supplied from the same realm.'
      : relation === 'inconsistent-binding' ? 'Runtime, realm and scheduler references disagree; do not infer a coherent runtime identity.'
      : 'Both participants supplied the same runtime and scheduler identities.',
  });
}
