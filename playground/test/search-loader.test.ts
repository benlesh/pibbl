import { describe, expect, it } from "vitest";

import {
  createSearchBundleLoader,
} from "../src/search/search-loader";

describe("Studio search bundle loader", () => {
  it("retries a composition-injected one-shot load failure", async () => {
    let loads = 0;
    let failures = 0;
    const load = createSearchBundleLoader(async () => {
      loads++;
      return { serializedSearchIndex: "{}", searchRecords: [] };
    }, {
      beforeLoad: () => {
        failures++;
        if (failures === 1) throw new Error("Intentional search loader failure.");
      },
    });

    await expect(load()).rejects.toThrow("Intentional search loader failure.");
    await expect(load()).resolves.toEqual({
      serializedSearchIndex: "{}",
      searchRecords: [],
    });
    expect(loads).toBe(1);
    expect(failures).toBe(2);
  });
});
