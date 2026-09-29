import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ModuleKind } from "typescript/unstable/sync";
import {
  crcPublicEntryPaths,
  crcPhysicsEntryPaths,
  crcStudioPublicEntryPaths,
  collectPublicExports,
  crcPublicCompilerOptions,
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
    three: `${fixturesDirectory}three.ts`,
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
  /Undocumented public exports: CRCThreeLayerContext, CRCThreeLayerDefinition, defineThreeLayer/u,
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
    route: "#/api/functions/define-three-layer",
    frontmatter: {
      id: "api-function-define-three-layer",
      symbols: ["defineThreeLayer", "CRCThreeLayerDefinition"],
    },
  },
  {
    route: "#/api/types/three",
    frontmatter: {
      id: "api-types-three",
      symbols: ["CRCThreeLayerContext"],
    },
  },
]);
assert.equal(
  multiPackageCoverage.values.get("defineThreeLayer")?.route,
  "#/api/functions/define-three-layer",
);
assert.equal(
  multiPackageCoverage.types.get("CRCThreeLayerDefinition")?.route,
  "#/api/functions/define-three-layer",
);
assert.equal(
  multiPackageCoverage.types.get("CRCThreeLayerContext")?.route,
  "#/api/types/three",
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

const crcInventory = await collectPublicExports(
  crcPublicEntryPaths,
  crcPublicCompilerOptions,
);
const physicsInventory = await collectPublicExports(crcPhysicsEntryPaths, {});
const studioInventory = await collectPublicExports(
  crcStudioPublicEntryPaths,
  crcPublicCompilerOptions,
);
assert.equal(crcInventory.viz.values.length, 21);
assert.equal(crcInventory.viz.types.length, 57);
assert.ok(crcInventory.root.values.length > 0);
assert.ok(crcInventory.root.types.length > 0);
assert.equal(crcInventory.three.values.length, 1);
assert.equal(crcInventory.three.types.length, 8);
assert.equal(crcInventory.particles.values.length, 9);
assert.equal(crcInventory.particles.types.length, 43);
assert.equal(physicsInventory.root.values.length, 46);
assert.equal(physicsInventory.root.types.length, 46);
assert.equal(physicsInventory.physics2dGeometry.values.length, 19);
assert.equal(physicsInventory.physics2dGeometry.types.length, 11);
assert.equal(physicsInventory.physics3dGeometry.values.length, 18);
assert.equal(physicsInventory.physics3dGeometry.types.length, 13);
assert.deepEqual(
  studioInventory.physics3dGeometry,
  physicsInventory.physics3dGeometry,
);

process.stdout.write(
  `Validated public API coverage: ${crcInventory.root.values.length} core values, ` +
    `${crcInventory.root.types.length} core types, ${crcInventory.three.values.length} ` +
    `Three adapter value, ${crcInventory.three.types.length} Three adapter types, ` +
    `${crcInventory.particles.values.length} particle values, ` +
    `${crcInventory.particles.types.length} particle type exports, ` +
    `${physicsInventory.root.values.length} physics 2D values, and ` +
    `${physicsInventory.physics3dGeometry.values.length} pure physics 3D geometry values.\n`,
);
