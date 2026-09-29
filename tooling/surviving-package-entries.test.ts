import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

function manifest(relativePath: string): {
  exports: Record<string, unknown>;
  peerDependencies?: Record<string, string>;
} {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
  );
}

describe("surviving optional package entries", () => {
  it("publishes Canvas particles without a WebGL peer or entry", () => {
    const particles = manifest("../packages/particles/package.json");
    expect(Object.keys(particles.exports)).toEqual([".", "./package.json"]);
    expect(particles.peerDependencies).toEqual({ "@crc/core": "0.0.1" });
  });

  it("publishes 2D physics and pure 3D geometry without a renderer peer", () => {
    const physics = manifest("../packages/physics/package.json");
    expect(Object.keys(physics.exports)).toEqual([
      "./2d",
      "./2d/geometry",
      "./3d/geometry",
    ]);
    expect(physics.peerDependencies).toEqual({ "@crc/core": "0.0.1" });
  });

  it("does not include the retired renderer package", () => {
    expect(existsSync(`${repositoryRoot}/packages/webgl/package.json`)).toBe(
      false,
    );
  });
});
