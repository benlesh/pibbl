import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { ModuleKind } from "typescript/unstable/sync";
import {
  pibblPublicEntryPaths,
  pibblPhysicsEntryPaths,
  pibblStudioPublicEntryPaths,
  collectPublicExports,
  pibblPublicCompilerOptions,
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

assert.deepEqual(inventory.root.values, ["Circle", "pibbl"]);
assert.deepEqual(inventory.root.types, ["CircleProps", "PibblConfig"]);
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
          symbols: ["Circle", "pibbl", "PibblConfig", "CircleProps"],
        },
      },
    ]),
  /Undocumented public exports: PibblThreeLayerContext, PibblThreeLayerDefinition, defineThreeLayer/u,
);

const multiPackageCoverage = validateApiCoverage(multiPackageInventory, [
  {
    route: "#/api/components/circle",
    frontmatter: {
      id: "api-core",
      symbols: ["Circle", "pibbl", "PibblConfig", "CircleProps"],
    },
  },
  {
    route: "#/api/functions/define-three-layer",
    frontmatter: {
      id: "api-function-define-three-layer",
      symbols: ["defineThreeLayer", "PibblThreeLayerDefinition"],
    },
  },
  {
    route: "#/api/types/three",
    frontmatter: {
      id: "api-types-three",
      symbols: ["PibblThreeLayerContext"],
    },
  },
]);
assert.equal(
  multiPackageCoverage.values.get("defineThreeLayer")?.route,
  "#/api/functions/define-three-layer",
);
assert.equal(
  multiPackageCoverage.types.get("PibblThreeLayerDefinition")?.route,
  "#/api/functions/define-three-layer",
);
assert.equal(
  multiPackageCoverage.types.get("PibblThreeLayerContext")?.route,
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
      symbols: ["Circle", "pibbl", "PibblConfig", "CircleProps"],
    },
  },
  { frontmatter: { id: "api-shapes", symbols: ["Circle"] } },
];
assert.throws(
  () => validateApiCoverage(inventory, duplicatePages),
  /Circle is assigned to both api-circle and api-shapes/u,
);

const missingPages = [
  { frontmatter: { id: "api-circle", symbols: ["Circle", "pibbl"] } },
];
assert.throws(
  () => validateApiCoverage(inventory, missingPages),
  /Undocumented public exports: CircleProps, PibblConfig/u,
);

const stalePages = [
  {
    frontmatter: {
      id: "api-circle",
      symbols: ["Circle", "pibbl", "PibblConfig", "CircleProps", "RemovedValue"],
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
      symbols: ["Circle", "pibbl", "PibblConfig", "CircleProps"],
    },
  },
]);
assert.equal(coverage.values.get("Circle")?.route, "#/api/components/circle");
assert.deepEqual(coverage.missingValues, []);
assert.deepEqual(coverage.missingTypes, []);

const pibblInventory = await collectPublicExports(
  pibblPublicEntryPaths,
  pibblPublicCompilerOptions,
);
const physicsInventory = await collectPublicExports(
  pibblPhysicsEntryPaths,
  pibblPublicCompilerOptions,
);
const studioInventory = await collectPublicExports(
  pibblStudioPublicEntryPaths,
  pibblPublicCompilerOptions,
);
// Real public coverage is checked by symbol name against documentation and
// source/built declarations. Copied export totals add maintenance without
// detecting a missing symbol replaced by an unrelated one. Fixtures above
// validate extraction; every configured real entry must still expose an API.
for (const [entry, api] of Object.entries(studioInventory)) {
  assert.ok(api.values.length + api.types.length + api.overview.length > 0,
    `Public entry ${entry} must not have an empty API inventory`);
}
process.stdout.write(
  `Validated public API coverage: ${pibblInventory.root.values.length} core values, ` +
    `${pibblInventory.root.types.length} core types, ${pibblInventory.three.values.length} ` +
    `Three adapter value, ${pibblInventory.three.types.length} Three adapter types, ` +
    `${pibblInventory.particles.values.length} particle values, ` +
    `${pibblInventory.particles.types.length} particle type exports, ` +
    `${physicsInventory.root.values.length} physics 2D values.\n`,
);
