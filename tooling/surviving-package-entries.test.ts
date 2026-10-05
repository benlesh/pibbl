import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const manifest = (name: string) => JSON.parse(readFileSync(`${repositoryRoot}/packages/${name}/package.json`, "utf8"));

describe("consolidated package entries", () => {
  it("publishes optional features as core subpaths without runtime dependencies", () => {
    const core = manifest("core");
    for (const entry of ["particles", "viz", "textures", "physics/2d", "physics/2d/geometry", "physics/2d/testing"])
      expect(core.exports[`./${entry}`]).toBeDefined();
    expect(core.exports["./physics"]).toBeUndefined();
    expect(core.exports["./physics/3d"]).toBeUndefined();
    expect(core.exports["./physics/3d/geometry"]).toBeUndefined();
    expect(core.dependencies ?? {}).toEqual({});
    expect(core.devDependencies["@dimforge/rapier2d-compat"]).toBe("0.21.0");
    expect(core.sideEffects).toBe(false);
  });
  it("keeps Three as an adapter with the application's renderer peer", () => {
    expect(manifest("three").peerDependencies).toEqual({ "@crc/core": "0.0.1", three: "^0.186.0" });
  });
  it("does not publish retired feature, types, or renderer packages", () => {
    for (const name of ["particles", "physics", "viz", "textures", "types", "webgl"])
      expect(existsSync(`${repositoryRoot}/packages/${name}/package.json`)).toBe(false);
  });
});
