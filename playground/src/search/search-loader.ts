import type { SearchBundleLoader } from "./search-engine";

export interface SearchBundleLoaderOptions {
  /** Test-only composition seam for exercising a failed lazy import and retry. */
  readonly beforeLoad?: () => void | Promise<void>;
}

/**
 * Loads the generated search payload lazily. Production supplies only the
 * bundle import; tests may inject a pre-load failure without exposing a
 * browser global or user-triggerable switch in the shipped application.
 */
export function createSearchBundleLoader(
  load: SearchBundleLoader,
  options: SearchBundleLoaderOptions = {},
): SearchBundleLoader {
  return async () => {
    await options.beforeLoad?.();
    return load();
  };
}
