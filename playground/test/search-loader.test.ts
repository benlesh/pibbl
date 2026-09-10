import { afterEach, describe, expect, it } from "vitest";

import {
  createSearchBundleLoader,
  searchLoaderFailureFlag,
} from "../src/search/search-loader";

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[searchLoaderFailureFlag];
});

describe("Studio search bundle loader", () => {
  it("fails exactly once when the acceptance-only failure flag is set", async () => {
    let loads = 0;
    const load = createSearchBundleLoader(async () => {
      loads++;
      return { serializedSearchIndex: "{}", searchRecords: [] };
    });
    (globalThis as Record<string, unknown>)[searchLoaderFailureFlag] = true;

    await expect(load()).rejects.toThrow("acceptance failure");
    await expect(load()).resolves.toEqual({
      serializedSearchIndex: "{}",
      searchRecords: [],
    });
    expect(loads).toBe(1);
  });
});
