import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ModuleKind } from "typescript/unstable/sync";
import {
  crcPublicEntryPaths,
  collectPublicExports,
  validateApiCoverage,
} from "./api-exports";

const fixturesDirectory = fileURLToPath(
  new URL("./fixtures/api/", import.meta.url),
);
const moduleSensitiveFixturePath = `${fixturesDirectory}compiler-options.ts`;
const inventory = await collectPublicExports(
  {
    root: `${fixturesDirectory}root.ts`,
  },
  {
    strict: true,
  },
);

assert.deepEqual(inventory.root.values, ["Circle", "crc"]);
assert.deepEqual(inventory.root.types, ["CRCConfig", "CircleProps"]);
assert.deepEqual(inventory.root.overview, ["JSX"]);

const multiPackageInventory = await collectPublicExports(
  {
    root: `${fixturesDirectory}root.ts`,
    webgl: `${fixturesDirectory}webgl.ts`,
  },
  { strict: true },
);
assert.throws(
  () =>
    validateApiCoverage(multiPackageInventory, [
      {
        frontmatter: {
          id: "api-core",
          symbols: ["Circle", "crc", "CRCConfig", "CircleProps"],
        },
      },
    ]),
  /Undocumented public exports: CRCOrbitCameraHandlers, CRCOrbitCameraOptions, CRCOrbitCameraResult, CRCWebGLPerspectiveCamera, CRCWebGLVector3, WebGLLayer, crcOrbitCamera/u,
);

const multiPackageCoverage = validateApiCoverage(multiPackageInventory, [
  {
    route: "#/api/components/circle",
    frontmatter: {
      id: "api-core",
      symbols: ["Circle", "crc", "CRCConfig", "CircleProps"],
    },
  },
  {
    route: "#/api/components/webgl-layer",
    frontmatter: {
      id: "api-component-webgl-layer",
      symbols: ["WebGLLayer"],
    },
  },
  {
    route: "#/api/hooks/crc-orbit-camera",
    frontmatter: {
      id: "api-hook-crc-orbit-camera",
      symbols: [
        "crcOrbitCamera",
        "CRCOrbitCameraOptions",
        "CRCOrbitCameraHandlers",
        "CRCOrbitCameraResult",
      ],
    },
  },
  {
    route: "#/api/types/webgl",
    frontmatter: {
      id: "api-types-webgl",
      symbols: ["CRCWebGLPerspectiveCamera", "CRCWebGLVector3"],
    },
  },
]);
assert.equal(
  multiPackageCoverage.values.get("crcOrbitCamera")?.route,
  "#/api/hooks/crc-orbit-camera",
);
assert.equal(
  multiPackageCoverage.types.get("CRCOrbitCameraOptions")?.route,
  "#/api/hooks/crc-orbit-camera",
);
assert.equal(
  multiPackageCoverage.types.get("CRCWebGLVector3")?.route,
  "#/api/types/webgl",
);
assert.deepEqual(multiPackageCoverage.missingValues, []);
assert.deepEqual(multiPackageCoverage.missingTypes, []);

await assert.rejects(
  () =>
    collectPublicExports(
      { root: moduleSensitiveFixturePath },
      { module: ModuleKind.CommonJS },
    ),
  /import\.meta/u,
);
await collectPublicExports(
  { root: moduleSensitiveFixturePath },
  { module: ModuleKind.ESNext },
);

const duplicatePages = [
  {
    frontmatter: {
      id: "api-circle",
      symbols: ["Circle", "crc", "CRCConfig", "CircleProps"],
    },
  },
  { frontmatter: { id: "api-shapes", symbols: ["Circle"] } },
];
assert.throws(
  () => validateApiCoverage(inventory, duplicatePages),
  /Circle is assigned to both api-circle and api-shapes/u,
);

const missingPages = [
  { frontmatter: { id: "api-circle", symbols: ["Circle", "crc"] } },
];
assert.throws(
  () => validateApiCoverage(inventory, missingPages),
  /Undocumented public exports: CRCConfig/u,
);

const stalePages = [
  {
    frontmatter: {
      id: "api-circle",
      symbols: ["Circle", "crc", "CRCConfig", "CircleProps", "RemovedValue"],
    },
  },
];
assert.throws(
  () => validateApiCoverage(inventory, stalePages),
  /Unknown documented symbols: RemovedValue/u,
);

const coverage = validateApiCoverage(inventory, [
  {
    route: "#/api/components/circle",
    frontmatter: {
      id: "api-circle",
      symbols: ["Circle", "crc", "CRCConfig", "CircleProps"],
    },
  },
]);
assert.equal(coverage.values.get("Circle")?.route, "#/api/components/circle");
assert.deepEqual(coverage.missingValues, []);
assert.deepEqual(coverage.missingTypes, []);

const crcInventory = await collectPublicExports(crcPublicEntryPaths, {});
assert.ok(crcInventory.root.values.length > 0);
assert.ok(crcInventory.root.types.length > 0);
assert.equal(crcInventory.webgl.values.length, 14);
assert.equal(crcInventory.webgl.types.length, 33);
assert.equal(crcInventory.particles.values.length, 9);
assert.equal(crcInventory.particles.types.length, 44);
assert.equal(crcInventory.particlesWebgl.values.length, 2);
assert.equal(crcInventory.particlesWebgl.types.length, 13);

process.stdout.write(
  `Validated public API coverage: ${crcInventory.root.values.length} core values, ` +
    `${crcInventory.root.types.length} core types, ${crcInventory.webgl.values.length} ` +
    `WebGL values, ${crcInventory.webgl.types.length} WebGL types, ` +
    `${crcInventory.particles.values.length + crcInventory.particlesWebgl.values.length} ` +
    `particle values, and ${crcInventory.particles.types.length + crcInventory.particlesWebgl.types.length} particle type exports.\n`,
);
