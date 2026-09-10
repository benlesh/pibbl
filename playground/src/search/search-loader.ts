import type { SearchBundleLoader } from "./search-engine";

/** One-shot browser-test flag; normal visitors never set or observe this value. */
export const searchLoaderFailureFlag = "__CRC_STUDIO_ACCEPTANCE_FAIL_SEARCH_ONCE__";

/**
 * Loads the generated search payload lazily. The one-shot flag gives the
 * production acceptance verifier a deterministic way to exercise retry
 * without changing the normal bundle or browser network behavior.
 */
export function createSearchBundleLoader(
  load: SearchBundleLoader,
): SearchBundleLoader {
  return async () => {
    const globals = globalThis as Record<string, unknown>;
    if (globals[searchLoaderFailureFlag] === true) {
      globals[searchLoaderFailureFlag] = false;
      throw new Error("Intentional Studio search acceptance failure.");
    }
    return load();
  };
}
