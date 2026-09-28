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
  /Undocumented public exports: CRCOrbitCameraHandlers, CRCOrbitCameraOptions, CRCOrbitCameraResult, CRCWebGLPerspectiveCamera, CRCWebGLVector3, WebGLLayer, useOrbitCamera/u,
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
    route: "#/api/hooks/use-orbit-camera",
    frontmatter: {
      id: "api-hook-use-orbit-camera",
      symbols: [
        "useOrbitCamera",
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
  multiPackageCoverage.values.get("useOrbitCamera")?.route,
  "#/api/hooks/use-orbit-camera",
);
assert.equal(
  multiPackageCoverage.types.get("CRCOrbitCameraOptions")?.route,
  "#/api/hooks/use-orbit-camera",
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

const crcInventory = await collectPublicExports(crcPublicEntryPaths, crcPublicCompilerOptions);
const physicsInventory = await collectPublicExports(crcPhysicsEntryPaths, {});
const studioInventory = await collectPublicExports(
  crcStudioPublicEntryPaths,
  crcPublicCompilerOptions,
);
assert.equal(crcInventory.viz.values.length, 5);
assert.equal(crcInventory.viz.types.length, 16);
assert.ok(crcInventory.root.values.length > 0);
assert.ok(crcInventory.root.types.length > 0);
assert.equal(crcInventory.webgl.values.length, 15);
assert.equal(crcInventory.webgl.types.length, 37);
assert.equal(crcInventory.particles.values.length, 9);
assert.equal(crcInventory.particles.types.length, 44);
assert.equal(crcInventory.particlesWebgl.values.length, 2);
assert.equal(crcInventory.particlesWebgl.types.length, 13);
assert.equal(physicsInventory.root.values.length, 46);
assert.equal(physicsInventory.root.types.length, 46);
assert.equal(physicsInventory.physics2dGeometry.values.length, 19);
assert.equal(physicsInventory.physics2dGeometry.types.length, 11);
assert.equal(physicsInventory.physics3d.values.length, 48);
assert.equal(physicsInventory.physics3d.types.length, 48);
assert.equal(physicsInventory.physics3dGeometry.values.length, 18);
assert.equal(physicsInventory.physics3dGeometry.types.length, 13);
assert.deepEqual(studioInventory.physics3d, physicsInventory.physics3d);
assert.deepEqual(
  studioInventory.physics3dGeometry,
  physicsInventory.physics3dGeometry,
);

process.stdout.write(
  `Validated public API coverage: ${crcInventory.root.values.length} core values, ` +
    `${crcInventory.root.types.length} core types, ${crcInventory.webgl.values.length} ` +
    `WebGL values, ${crcInventory.webgl.types.length} WebGL types, ` +
    `${crcInventory.particles.values.length + crcInventory.particlesWebgl.values.length} ` +
    `particle values, ${crcInventory.particles.types.length + crcInventory.particlesWebgl.types.length} ` +
    `particle type exports, ${physicsInventory.root.values.length} physics 2D values, and ` +
    `${physicsInventory.physics3d.values.length} physics 3D values.\n`,
);
