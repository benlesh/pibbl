import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { parse } from "@babel/parser";
import { transform } from "esbuild";

const repositoryRoot = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const guidePaths = [
  "docs/guides/children-text-lists-and-keys.md",
  "docs/guides/components-props-and-style.md",
  "docs/guides/configuring-jsx.md",
  "docs/guides/custom-components-and-primitives.md",
  "docs/guides/focus-keyboard-and-accessibility.md",
  "docs/guides/jsx-quick-start.md",
  "docs/guides/jsx-troubleshooting.md",
  "docs/guides/layout-groups-clips-and-layers.md",
  "docs/guides/react-interop.md",
  "docs/guides/state-lifecycle-and-react-differences.md",
  "docs/guides/without-jsx.md",
];
const currentMarkdownPaths = [
  "AGENTS.md",
  "README.md",
  "packages/core/README.md",
  "packages/types/README.md",
  "docs/api-reference.md",
  "docs/architecture/style-and-layout-architecture.md",
  "docs/design/canvas-accessibility-guidance.md",
  "docs/design/canvas-surface-contract.md",
  "docs/design/drawing-components-contract.md",
  "docs/design/event-resource-ownership.md",
  "docs/design/focus-and-keyboard-navigation-contract.md",
  "docs/design/layout-system-contract.md",
  "docs/design/mouse-interaction-contract.md",
  "docs/design/runtime-hooks-contract.md",
  "docs/design/runtime-resource-ownership.md",
  "docs/design/style-system-contract.md",
  "docs/design/user-events-contract.md",
  "docs/documentation-follow-up.md",
  "docs/follow-ups.md",
  "docs/library-status.md",
  "docs/project-plans/README.md",
  "docs/project-plans/WORKFLOW.md",
  "docs/scenario-index.md",
  "docs/testing/dependency-freshness.md",
  "docs/testing/dependency-inventory.md",
  "docs/testing/scenario-gallery.md",
  "docs/testing/test-tooling-opportunities.md",
  "docs/testing/trust-gate.md",
  ...guidePaths,
];
const linkCheckedPaths = [
  ...currentMarkdownPaths,
  "docs/migrations/jsx-authoring-pivot.md",
];
const migrationMarkdownPaths = new Set([
  "docs/migrations/jsx-authoring-pivot.md",
]);
const operationalMarkdownPaths = new Set([".beads/README.md"]);
const historicalMarkdownPatterns = [
  /^\.superpowers\/sdd\//u,
  /^docs\/design\/tfc-01-characterization-baseline\.md$/u,
  /^docs\/project-plans\/\d{3}-/u,
  /^docs\/superpowers\/(?:plans|specs)\//u,
  /^docs\/testing\/dep-\d+-upgrade-notes\.md$/u,
  /^docs\/testing\/field-notes\//u,
  /^docs\/testing\/pre-upgrade-baseline\.md$/u,
];

function parseModule(source, filename) {
  return parse(source, {
    sourceFilename: filename,
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
}

function exportedSpecifiers(source, filename) {
  const values = new Set();
  const types = new Set();

  for (const statement of parseModule(source, filename).program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    for (const specifier of statement.specifiers) {
      assert.equal(
        specifier.type,
        "ExportSpecifier",
        `${filename} uses an unsupported export specifier`,
      );
      const exported = specifier.exported;
      const name =
        exported.type === "Identifier" ? exported.name : exported.value;
      const isType =
        statement.exportKind === "type" || specifier.exportKind === "type";
      (isType ? types : values).add(name);
    }
  }
  return { values, types };
}

function jsxNamespaceMembers(source, filename) {
  const names = new Set();
  for (const statement of parseModule(source, filename).program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : null;
    if (
      declaration?.type !== "TSModuleDeclaration" ||
      declaration.id.type !== "Identifier" ||
      declaration.id.name !== "JSX" ||
      declaration.body?.type !== "TSModuleBlock"
    ) {
      continue;
    }
    for (const member of declaration.body.body) {
      const exported =
        member.type === "ExportNamedDeclaration" ? member.declaration : member;
      if (exported && "id" in exported && exported.id?.type === "Identifier") {
        names.add(exported.id.name);
      }
    }
  }
  return names;
}

function namesBetweenMarkers(source, marker) {
  const match = source.match(
    new RegExp(
      `<!-- ${marker}:start -->([\\s\\S]*?)<!-- ${marker}:end -->`,
      "u",
    ),
  );
  assert.ok(match, `Missing ${marker} markers in docs/api-reference.md`);
  return new Set(
    [...match[1].matchAll(/`([A-Za-z][A-Za-z0-9]*)`/gu)].map((item) => item[1]),
  );
}

function assertSameNames(actual, expected, label) {
  const actualNames = [...actual].sort();
  const expectedNames = [...expected].sort();
  assert.deepEqual(
    actualNames,
    expectedNames,
    `${label} is stale. Missing/extra names must be reconciled with the source entry.`,
  );
}

async function assertLocalLinks(path, source) {
  const links = [...source.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/gu)];
  for (const link of links) {
    let target = link[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    if (/^(?:[a-z]+:|#)/iu.test(target)) continue;
    target = target.split(/\s+["']/u, 1)[0].split("#", 1)[0];
    if (target.length === 0) continue;
    const localPath = resolve(
      repositoryRoot,
      dirname(path),
      decodeURIComponent(target),
    );
    await assert.doesNotReject(
      access(localPath),
      `Broken local link in ${path}: ${link[1]}`,
    );
  }
}

function assertSnippetSyntax(path, source) {
  let count = 0;
  const fences = source.matchAll(
    /^```(ts|tsx|js|jsx|json)\n([\s\S]*?)^```$/gmu,
  );
  for (const match of fences) {
    const language = match[1];
    const snippet = match[2];
    const line = source.slice(0, match.index).split("\n").length + 1;
    const filename = `${path}:${line}`;
    if (language === "json") {
      assert.doesNotThrow(
        () => JSON.parse(snippet),
        `Invalid JSON documentation snippet in ${filename}`,
      );
    } else {
      assert.doesNotThrow(
        () => parseModule(snippet, filename),
        `Invalid ${language} documentation snippet in ${filename}`,
      );
    }
    count += 1;
  }
  return count;
}

const discoveredGuides = (await readdir(join(repositoryRoot, "docs/guides")))
  .filter((name) => extname(name) === ".md")
  .map((name) => `docs/guides/${name}`)
  .sort();
assert.deepEqual(
  discoveredGuides,
  [...guidePaths].sort(),
  "The required guide set changed.",
);

const currentSources = new Map();
let parsedSnippetCount = 0;
for (const path of new Set(linkCheckedPaths)) {
  const source = await readFile(join(repositoryRoot, path), "utf8");
  currentSources.set(path, source);
  await assertLocalLinks(path, source);
  parsedSnippetCount += assertSnippetSyntax(path, source);
}

const markdownListing = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"],
  { cwd: repositoryRoot, encoding: "utf8" },
);
assert.equal(
  markdownListing.status,
  0,
  `Could not inventory repository Markdown:\n${markdownListing.stderr}`,
);
const repositoryMarkdownPaths = markdownListing.stdout.trim().split("\n");
const currentMarkdownSet = new Set(currentMarkdownPaths);
const historicalMarkdownPaths = repositoryMarkdownPaths.filter((path) =>
  historicalMarkdownPatterns.some((pattern) => pattern.test(path)),
);
const unclassifiedMarkdownPaths = repositoryMarkdownPaths.filter(
  (path) =>
    !currentMarkdownSet.has(path) &&
    !migrationMarkdownPaths.has(path) &&
    !operationalMarkdownPaths.has(path) &&
    !historicalMarkdownPaths.includes(path),
);
assert.deepEqual(
  unclassifiedMarkdownPaths,
  [],
  "Every repository Markdown file must be classified as current, migration, " +
    "historical/work evidence, or unrelated operational documentation.",
);

const staleIdentifiers = [
  "CompEl",
  "CompFn",
  "ComponentCapabilities",
  "ComponentInput",
  "CompRefs",
  "FalsyNodes",
  "GProps",
  "ImgProps",
  "RectProps",
  "defineComp",
  "withFocusManagement",
  "withKeyboardNavigation",
];
const staleCalls = [
  "absolute",
  "clip",
  "flex",
  "flow",
  "g",
  "grid",
  "horizontalLine",
  "img",
  "layer",
  "line",
  "overlay",
  "path",
  "rect",
  "svgPath",
  "text",
  "verticalLine",
];
for (const path of currentMarkdownPaths) {
  const source = currentSources.get(path);
  for (const identifier of staleIdentifiers) {
    assert.doesNotMatch(
      source,
      new RegExp(`\\b${identifier}\\b`, "u"),
      `${path} contains removed authoring identifier ${identifier}`,
    );
  }
  for (const call of staleCalls) {
    assert.doesNotMatch(
      source,
      new RegExp(`(?<![.A-Za-z0-9_$])${call}\\s*\\(`, "u"),
      `${path} contains removed component-call vocabulary ${call}(...)`,
    );
  }
  assert.doesNotMatch(
    source,
    /\.example\.ts\b/gu,
    `${path} references the obsolete .example.ts extension`,
  );
  assert.doesNotMatch(
    source,
    /CRC(?:'s)? mouse-only contract/giu,
    `${path} claims CRC has only a mouse contract`,
  );
}

const migrationSource = currentSources.get(
  "docs/migrations/jsx-authoring-pivot.md",
);
const migrationLegacyPatterns = [
  ...staleIdentifiers.map(
    (identifier) => new RegExp(`\\b${identifier}\\b`, "u"),
  ),
  ...staleCalls.map(
    (call) => new RegExp(`(?<![.A-Za-z0-9_$])${call}\\s*\\(`, "u"),
  ),
  /TextStyle\.text/u,
];
for (const [index, line] of migrationSource.split("\n").entries()) {
  if (!migrationLegacyPatterns.some((pattern) => pattern.test(line))) continue;
  assert.ok(
    line.startsWith("| ") &&
      line.split("|").filter((cell) => cell.trim()).length >= 2,
    `Removed migration vocabulary must have a same-row replacement at line ${index + 1}.`,
  );
}

const apiReference = currentSources.get("docs/api-reference.md");
const rootSource = await readFile(
  join(repositoryRoot, "packages/core/src/index.ts"),
  "utf8",
);
const runtimeSource = await readFile(
  join(repositoryRoot, "packages/core/src/jsx-runtime.ts"),
  "utf8",
);
const devRuntimeSource = await readFile(
  join(repositoryRoot, "packages/core/src/jsx-dev-runtime.ts"),
  "utf8",
);
const rootExports = exportedSpecifiers(
  rootSource,
  "packages/core/src/index.ts",
);
const runtimeExports = exportedSpecifiers(
  runtimeSource,
  "packages/core/src/jsx-runtime.ts",
);
const devRuntimeExports = exportedSpecifiers(
  devRuntimeSource,
  "packages/core/src/jsx-dev-runtime.ts",
);
assertSameNames(
  namesBetweenMarkers(apiReference, "root-values"),
  rootExports.values,
  "Documented root runtime values",
);
assertSameNames(
  namesBetweenMarkers(apiReference, "root-types"),
  rootExports.types,
  "Documented root types",
);
assertSameNames(
  namesBetweenMarkers(apiReference, "jsx-runtime-values"),
  runtimeExports.values,
  "Documented jsx-runtime values",
);
assertSameNames(
  namesBetweenMarkers(apiReference, "jsx-dev-runtime-values"),
  devRuntimeExports.values,
  "Documented jsx-dev-runtime values",
);
const namespaceMembers = jsxNamespaceMembers(
  runtimeSource,
  "packages/core/src/jsx-runtime.ts",
);
assertSameNames(
  namesBetweenMarkers(apiReference, "jsx-namespace-types"),
  namespaceMembers,
  "Documented JSX namespace types",
);
assertSameNames(
  jsxNamespaceMembers(devRuntimeSource, "packages/core/src/jsx-dev-runtime.ts"),
  namespaceMembers,
  "Development JSX namespace types",
);
assert.match(
  apiReference,
  new RegExp(
    `root contains ${rootExports.values.size} runtime values and ${rootExports.types.size} type exports`,
    "u",
  ),
  "The API-reference export totals are stale.",
);

const coreManifest = JSON.parse(
  await readFile(join(repositoryRoot, "packages/core/package.json"), "utf8"),
);
for (const entry of [".", "./jsx-runtime", "./jsx-dev-runtime", "./types"]) {
  assert.ok(
    coreManifest.exports[entry],
    `@crc/core package exports is missing ${entry}`,
  );
}
for (const dependencies of [
  coreManifest.dependencies,
  coreManifest.devDependencies,
  coreManifest.peerDependencies,
]) {
  assert.ok(!dependencies?.react, "@crc/core must not depend on React.");
}
assert.match(coreManifest.description, /JSX.*createElement/u);
const typesManifest = JSON.parse(
  await readFile(join(repositoryRoot, "packages/types/package.json"), "utf8"),
);
assert.doesNotMatch(
  typesManifest.description,
  /shared public types/iu,
  "@crc/types package prose must not claim ownership of the core public surface.",
);
const trustWorkflow = await readFile(
  join(repositoryRoot, ".github/workflows/trust.yml"),
  "utf8",
);
assert.match(
  trustWorkflow,
  /run: pnpm docs:check/u,
  "The CI static job must run docs:check explicitly.",
);
const studioHtml = await readFile(
  join(repositoryRoot, "playground/index.html"),
  "utf8",
);
assert.match(studioHtml, /editable TSX/u);
assert.doesNotMatch(studioHtml, /editable TypeScript/u);

const configuring = currentSources.get("docs/guides/configuring-jsx.md");
for (const marker of [
  "@crc/core/jsx-runtime",
  "@crc/core/jsx-dev-runtime",
  "## Vite and esbuild",
  "--jsx=automatic",
  "## Babel automatic runtime",
  'runtime: "automatic"',
  'importSource: "@crc/core"',
  "## JavaScript",
  "## One runtime per file",
]) {
  assert.ok(
    configuring.includes(marker),
    `Configuring JSX is missing: ${marker}`,
  );
}

const requiredGuideMarkers = new Map([
  [
    "docs/guides/children-text-lists-and-keys.md",
    ["finite synchronous iterables", "Numeric zero", "## Fragments and keys"],
  ],
  [
    "docs/guides/components-props-and-style.md",
    ["ordinary synchronous", "## Local, closed style", "crcLayoutBox()"],
  ],
  [
    "docs/guides/custom-components-and-primitives.md",
    ["crcCanvasContext()", "normalizeStyle", "resolveStyle", "measure"],
  ],
  [
    "docs/guides/focus-keyboard-and-accessibility.md",
    [
      "FocusManagement",
      "KeyboardNavigation",
      "## Accessibility responsibility",
    ],
  ],
  [
    "docs/guides/layout-groups-clips-and-layers.md",
    ["## Group", "## Clip", "## Layer", "specified author value"],
  ],
  [
    "docs/guides/react-interop.md",
    ["one JSX runtime", "createCRCElement", "expression-level pragma"],
  ],
  [
    "docs/guides/state-lifecycle-and-react-differences.md",
    ["immediate Canvas runtime", "crcWhenChanged", "## Disposal"],
  ],
  [
    "docs/guides/without-jsx.md",
    ["## Install and mount", "## Constructor rules", "dispose()"],
  ],
]);
for (const [path, markers] of requiredGuideMarkers) {
  const source = currentSources.get(path);
  for (const marker of markers) {
    assert.ok(
      source.includes(marker),
      `${path} is missing required coverage: ${marker}`,
    );
  }
}

const readme = currentSources.get("README.md");
const advancedStart = readme.indexOf("## Learn the API");
assert.ok(readme.indexOf("## Quick start") >= 0, "README needs a quick start.");
assert.ok(
  advancedStart > readme.indexOf("## Quick start"),
  "README quick start must precede advanced material.",
);
assert.ok(
  readme.indexOf("docs/guides/without-jsx.md") < advancedStart,
  "README must link the standalone non-JSX path before advanced material.",
);

const libraryStatus = currentSources.get("docs/library-status.md");
const matrix = libraryStatus.slice(
  libraryStatus.indexOf("## Documentation acceptance matrix"),
  libraryStatus.indexOf("## Running locally"),
);
const matrixRows = matrix
  .split("\n")
  .filter((line) => line.startsWith("| ") && !line.startsWith("| ---"))
  .slice(1);
assert.ok(
  matrixRows.length >= 20,
  "Documentation acceptance matrix is incomplete.",
);
for (const row of matrixRows) {
  const columns = row.split("|");
  assert.match(
    columns[2],
    /\]\([^)]+\)/u,
    `Acceptance row lacks a guide/contract link: ${row}`,
  );
  assert.match(
    columns[3],
    /\]\([^)]+\.[cm]?[jt]sx?\)/u,
    `Acceptance row lacks executable evidence: ${row}`,
  );
}
for (const guide of guidePaths) {
  assert.ok(
    libraryStatus.includes(`./${guide.slice("docs/".length)}`),
    `Acceptance matrix does not map ${guide}`,
  );
}

const javascriptFixturePath = join(
  repositoryRoot,
  "tooling/docs-fixtures/automatic-runtime.crc.jsx",
);
const javascriptFixture = await readFile(javascriptFixturePath, "utf8");
const javascriptAst = parseModule(javascriptFixture, javascriptFixturePath);
for (const statement of javascriptAst.program.body) {
  if (
    statement.type !== "ImportDeclaration" ||
    statement.source.value !== "@crc/core"
  ) {
    continue;
  }
  for (const specifier of statement.specifiers) {
    assert.equal(
      specifier.type,
      "ImportSpecifier",
      "Docs fixture uses named public imports.",
    );
    const imported =
      specifier.imported.type === "Identifier"
        ? specifier.imported.name
        : specifier.imported.value;
    assert.ok(
      rootExports.values.has(imported),
      `Docs fixture imports unknown value ${imported}.`,
    );
  }
}
const transformed = await transform(javascriptFixture, {
  format: "esm",
  jsx: "automatic",
  jsxImportSource: "@crc/core",
  loader: "jsx",
  sourcefile: javascriptFixturePath,
});
assert.match(
  transformed.code,
  /from "@crc\/core\/jsx-runtime"/u,
  "JavaScript fixture did not select the CRC automatic JSX runtime.",
);

const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
const typecheck = spawnSync(
  process.execPath,
  [
    tsc,
    "--project",
    join(repositoryRoot, "tooling/docs-fixtures/tsconfig.json"),
  ],
  { cwd: repositoryRoot, encoding: "utf8" },
);
assert.equal(
  typecheck.status,
  0,
  `Compile-backed documentation fixture failed:\n${typecheck.stdout}${typecheck.stderr}`,
);

process.stdout.write(
  `Documentation checks passed: ${guidePaths.length} guides, ` +
    `${linkCheckedPaths.length} current/migration files, ` +
    `${historicalMarkdownPaths.length} historical/work records, ` +
    `${rootExports.values.size} values, ${rootExports.types.size} types, ` +
    `${matrixRows.length} acceptance rows, ${parsedSnippetCount} parsed ` +
    `code snippets, and 2 compiled fixtures.\n`,
);
