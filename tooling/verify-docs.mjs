import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { transformAsync as babelTransform } from "@babel/core";
import { parse } from "@babel/parser";
import transformReactJsx from "@babel/plugin-transform-react-jsx";
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
const presentationSourcePaths = [
  "packages/scenarios/src/catalog.ts",
  "packages/scenarios/src/learning-catalog.ts",
  "playground/index.html",
  "playground/src/crc-editor-types.txt",
  "playground/src/editor-workbench.ts",
  "playground/src/learning-sources.ts",
  "playground/src/main.ts",
  "playground/src/sandbox-module.ts",
  "playground/src/sandbox-runner.ts",
  "playground/src/scenario-sources.ts",
  "playground/src/share-code.ts",
];
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

export function exportedSpecifiers(source, filename) {
  const values = new Set();
  const types = new Set();

  for (const statement of parseModule(source, filename).program.body) {
    assert.notEqual(
      statement.type,
      "ExportAllDeclaration",
      `${filename} uses export-star; the documentation inventory must fail closed`,
    );
    assert.notEqual(
      statement.type,
      "ExportDefaultDeclaration",
      `${filename} uses an unsupported default export`,
    );
    if (statement.type !== "ExportNamedDeclaration") continue;

    if (statement.declaration) {
      const declaration = statement.declaration;
      if (declaration.type === "VariableDeclaration") {
        for (const item of declaration.declarations) {
          assert.equal(
            item.id.type,
            "Identifier",
            `${filename} uses an unsupported destructured direct export`,
          );
          values.add(item.id.name);
        }
      } else if (
        declaration.type === "FunctionDeclaration" ||
        declaration.type === "ClassDeclaration"
      ) {
        assert.ok(
          declaration.id,
          `${filename} exports an anonymous declaration`,
        );
        values.add(declaration.id.name);
        if (declaration.type === "ClassDeclaration")
          types.add(declaration.id.name);
      } else if (
        declaration.type === "TSTypeAliasDeclaration" ||
        declaration.type === "TSInterfaceDeclaration" ||
        declaration.type === "TSDeclareFunction"
      ) {
        types.add(declaration.id.name);
      } else if (declaration.type === "TSEnumDeclaration") {
        values.add(declaration.id.name);
        types.add(declaration.id.name);
      } else if (declaration.type !== "TSModuleDeclaration") {
        assert.fail(
          `${filename} uses unsupported direct export ${declaration.type}`,
        );
      }
    }

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

function markdownAnchors(source) {
  const anchors = new Set();
  const duplicateCounts = new Map();
  let inFence = false;

  for (const line of source.split("\n")) {
    if (/^```/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const match of line.matchAll(
      /<a\s+(?:[^>]*?\s)?id=["']([^"']+)["'][^>]*>/giu,
    )) {
      anchors.add(match[1]);
    }

    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/u);
    if (!heading) continue;
    const base = heading[1]
      .toLowerCase()
      .replace(/<[^>]*>/gu, "")
      .replace(/[`*_~]/gu, "")
      .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
      .trim()
      .replace(/\s+/gu, "-");
    const count = duplicateCounts.get(base) ?? 0;
    duplicateCounts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

export async function assertLocalLinks(
  path,
  source,
  readTarget = (targetPath) => readFile(targetPath, "utf8"),
) {
  const links = [...source.matchAll(/!?\[[^\]]*\]\(([^)\n]+)\)/gu)];
  for (const link of links) {
    let target = link[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    if (/^[a-z]+:/iu.test(target)) continue;
    target = target.split(/\s+["']/u, 1)[0];
    const hashIndex = target.indexOf("#");
    const encodedFile = hashIndex < 0 ? target : target.slice(0, hashIndex);
    const encodedAnchor = hashIndex < 0 ? "" : target.slice(hashIndex + 1);
    const localPath = encodedFile
      ? resolve(repositoryRoot, dirname(path), decodeURIComponent(encodedFile))
      : resolve(repositoryRoot, path);

    await assert.doesNotReject(
      access(localPath),
      `Broken local link in ${path}: ${link[1]}`,
    );
    if (!encodedAnchor) continue;
    const targetSource = encodedFile ? await readTarget(localPath) : source;
    const anchor = decodeURIComponent(encodedAnchor);
    assert.ok(
      markdownAnchors(targetSource).has(anchor),
      `Broken local anchor in ${path}: ${link[1]}`,
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

function extractCompleteSnippets(sources) {
  const snippets = new Map();
  const marker =
    /<!-- docs:complete-snippet:start ([a-z0-9-]+) -->([\s\S]*?)<!-- docs:complete-snippet:end -->/gu;
  for (const [path, source] of sources) {
    for (const match of source.matchAll(marker)) {
      const id = match[1];
      assert.ok(!snippets.has(id), `Duplicate complete snippet marker ${id}`);
      const fences = [
        ...match[2].matchAll(/^```(ts|tsx|js|jsx)\n([\s\S]*?)^```$/gmu),
      ];
      assert.ok(fences.length > 0, `Complete snippet ${id} has no code fence`);
      snippets.set(id, {
        id,
        path,
        language: fences.some((fence) => fence[1] === "jsx")
          ? "jsx"
          : fences.some((fence) => fence[1] === "tsx")
            ? "tsx"
            : fences.some((fence) => fence[1] === "js")
              ? "js"
              : "ts",
        source: fences.map((fence) => fence[2]).join("\n"),
      });
    }
  }
  return snippets;
}

const requiredCompleteSnippetIds = new Set([
  "custom-primitive",
  "javascript-runtime",
  "jsx-quick-start",
  "layout-clip",
  "layout-flex",
  "layout-group",
  "layout-layer",
  "readme-poster",
  "without-jsx",
]);

async function typecheckCompleteSnippets(snippets) {
  const typeScriptSnippets = [...snippets.values()].filter((snippet) =>
    /^(?:ts|tsx)$/u.test(snippet.language),
  );
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "crc-docs-check-"));
  try {
    const files = [];
    for (const snippet of typeScriptSnippets) {
      const file = join(
        temporaryDirectory,
        `${snippet.id}.${snippet.language === "tsx" ? "tsx" : "ts"}`,
      );
      await writeFile(file, snippet.source, "utf8");
      files.push(file);
    }
    const configPath = join(temporaryDirectory, "tsconfig.json");
    await writeFile(
      configPath,
      JSON.stringify(
        {
          compilerOptions: {
            allowImportingTsExtensions: true,
            jsx: "react-jsx",
            jsxImportSource: "@crc/core",
            lib: ["ESNext", "DOM"],
            module: "ESNext",
            moduleDetection: "force",
            moduleResolution: "Bundler",
            noEmit: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            paths: {
              "@crc/core": [join(repositoryRoot, "packages/core/src/index.ts")],
              "@crc/core/jsx-dev-runtime": [
                join(repositoryRoot, "packages/core/src/jsx-dev-runtime.ts"),
              ],
              "@crc/core/jsx-runtime": [
                join(repositoryRoot, "packages/core/src/jsx-runtime.ts"),
              ],
              "@crc/core/types": [
                join(repositoryRoot, "packages/core/src/types.ts"),
              ],
            },
            skipLibCheck: true,
            strict: true,
            target: "ESNext",
            types: [],
          },
          files,
        },
        null,
        2,
      ),
      "utf8",
    );
    const tsc = join(dirname(require.resolve("typescript")), "tsc.js");
    const result = spawnSync(process.execPath, [tsc, "--project", configPath], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      `Extracted complete documentation snippets failed typecheck:\n${result.stdout}${result.stderr}`,
    );
    return typeScriptSnippets.length;
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

function importedPublicNames(source, filename) {
  const names = new Set();
  for (const statement of parseModule(source, filename).program.body) {
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
        `${filename} must use named public imports`,
      );
      const imported = specifier.imported;
      names.add(
        imported.type === "Identifier" ? imported.name : imported.value,
      );
    }
  }
  return names;
}

export function assertNonJsxCoverage(source) {
  parseModule(source, "without-jsx complete snippet");
  const requirements = new Map([
    ["Fragment construction", /createElement\(Fragment,/u],
    ["dynamic list children", /\.map\s*\(/u],
    ["explicit keys", /\{\s*key:/u],
    [
      "Text children",
      /createElement\(\s*Text,[\s\S]*?,\s*(?:"|'|label|message)/u,
    ],
    ["focus management policy", /createElement\(\s*FocusManagement,/u],
    ["keyboard navigation policy", /createElement\(\s*KeyboardNavigation,/u],
    ["hook lifecycle", /crcState\(/u],
    ["root mounting", /\bcrc\(canvas,/u],
    ["mount disposal", /controller\.dispose\(\)/u],
  ]);
  for (const [label, pattern] of requirements) {
    assert.match(source, pattern, `Complete non-JSX snippet lacks ${label}`);
  }
}

function babelOptionsFromGuide(source) {
  const section = source.match(
    /## Babel automatic runtime[\s\S]*?```json\n([\s\S]*?)^```$/mu,
  );
  assert.ok(section, "Configuring JSX lacks a Babel JSON configuration block");
  const config = JSON.parse(section[1]);
  const entry = config.plugins?.find(
    (plugin) =>
      Array.isArray(plugin) &&
      plugin[0] === "@babel/plugin-transform-react-jsx",
  );
  assert.ok(
    entry,
    "Babel configuration must name @babel/plugin-transform-react-jsx",
  );
  assert.equal(entry[1]?.runtime, "automatic");
  assert.equal(entry[1]?.importSource, "@crc/core");
  return entry[1];
}

export async function assertAutomaticRuntimeTransforms(source, babelOptions) {
  const babelResult = await babelTransform(source, {
    babelrc: false,
    configFile: false,
    filename: "documented-runtime.jsx",
    plugins: [[transformReactJsx, babelOptions]],
  });
  assert.ok(
    babelResult?.code,
    "Babel returned no transformed documentation code",
  );
  assert.match(
    babelResult.code,
    /from "@crc\/core\/jsx-runtime"/u,
    "Babel did not select the documented CRC automatic runtime",
  );
  assert.doesNotMatch(
    babelResult.code,
    /react(?:\/jsx-runtime)?/u,
    "Babel emitted a React dependency for CRC JSX",
  );

  const esbuildResult = await transform(source, {
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "@crc/core",
    loader: "jsx",
    sourcefile: "documented-runtime.jsx",
  });
  assert.match(
    esbuildResult.code,
    /from "@crc\/core\/jsx-runtime"/u,
    "esbuild did not select the documented CRC automatic runtime",
  );
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

export function assertHistoricalBanner(path, source) {
  const opening = source.split("\n").slice(0, 10).join("\n");
  assert.match(
    opening,
    /^> \*\*(?:Historical|Implementation) status: (?:COMPLETED|IMPLEMENTED|CURRENT|CHARACTERIZATION)[^*]*\.\*\*/mu,
    `${path} must visibly identify its historical or implementation-record status near the title`,
  );
}

for (const path of historicalMarkdownPaths) {
  assertHistoricalBanner(
    path,
    await readFile(join(repositoryRoot, path), "utf8"),
  );
}

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
const unambiguousStaleValues = staleCalls.filter(
  (name) => !["clip", "line", "path", "text"].includes(name),
);
const staleLowercaseValue = new RegExp(
  "`(?:" +
    unambiguousStaleValues.join("|") +
    ")`|\\b(?:" +
    staleCalls.join("|") +
    ")\\s+(?:component|factory|export|value)\\b|" +
    "`(?:clip|line|path|text)`\\s+(?:component|factory|export|value)\\b|" +
    "`clip`\\s+or\\s+`layer`",
  "gu",
);

export function assertCurrentVocabulary(path, source) {
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
    staleLowercaseValue,
    `${path} contains a removed lowercase component value in active prose or code`,
  );
}

for (const path of currentMarkdownPaths) {
  const source = currentSources.get(path);
  assertCurrentVocabulary(path, source);
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
for (const path of presentationSourcePaths) {
  assertCurrentVocabulary(
    path,
    await readFile(join(repositoryRoot, path), "utf8"),
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

const contractPrecisionRequirements = new Map([
  [
    "docs/design/layout-system-contract.md",
    [
      "`justifyContent`             | `flex-start` (default), `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`",
      "`alignItems`                 | `stretch` (default), `flex-start`, `flex-end`, `center`",
      "`alignContent`               | `stretch` (default), `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`",
      "finite nonnegative numbers; axis values override `gap`; default `0`",
      "`flexBasis: auto`, `flexGrow: 0`, `flexShrink: 1`, `alignSelf: auto`",
      "finite nonnegative numeric `gap`, `rowGap`, `columnGap`; no percentages",
      "max(0, remaining) / max(1, totalFr)",
      "paint outside its declared box when overflow is visible",
    ],
  ],
  [
    "docs/design/drawing-components-contract.md",
    [
      "`none` preserves the exact input",
      "preserving the signed span",
      "optional `x` and `y` default zero",
      "exact update/replacement behavior",
      "without losing the final fitting line",
      "narrower than three dots",
      "omitted height uses the Canvas allocation",
      "`naturalWidth` and `naturalHeight` independently",
      "one adjusted rectangle used by `drawImage`",
    ],
  ],
  [
    "docs/design/style-system-contract.md",
    ["each omitted natural dimension remains zero"],
  ],
]);

export function assertContractPrecision(sources) {
  for (const [path, requirements] of contractPrecisionRequirements) {
    const source = sources.get(path);
    assert.ok(source, `Missing current normative contract ${path}`);
    for (const requirement of requirements) {
      assert.ok(
        source.includes(requirement),
        `${path} lost exact shipped guarantee: ${requirement}`,
      );
    }
  }
}

assertContractPrecision(currentSources);

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

const matrixRequirements = [
  {
    topic: /Complete interactive JSX quick start/u,
    guides: ["guides/jsx-quick-start.md", "design/runtime-hooks-contract.md"],
    evidence: ["getting-started.example.tsx"],
  },
  {
    topic: /TypeScript automatic runtime/u,
    guides: ["guides/configuring-jsx.md", "api-reference.md"],
    evidence: ["package-consumer/jsx.tsx"],
  },
  {
    topic: /No React dependency/u,
    guides: ["guides/configuring-jsx.md", "guides/react-interop.md"],
    evidence: ["verify-packed-consumer.mjs"],
  },
  {
    topic: /Vite\/esbuild setup/u,
    guides: ["guides/configuring-jsx.md"],
    evidence: ["verify-docs.mjs"],
  },
  {
    topic: /Babel automatic runtime/u,
    guides: ["guides/configuring-jsx.md"],
    evidence: ["verify-docs.mjs"],
  },
  {
    topic: /Components, props, events/u,
    guides: [
      "guides/components-props-and-style.md",
      "design/style-system-contract.md",
    ],
    evidence: ["getting-started.example.tsx"],
  },
  {
    topic: /Arbitrary interpolation/u,
    guides: [
      "guides/children-text-lists-and-keys.md",
      "design/runtime-hooks-contract.md",
    ],
    evidence: ["children.test.ts"],
  },
  {
    topic: /Fragments, lists/u,
    guides: ["guides/children-text-lists-and-keys.md"],
    evidence: ["fragment.test.tsx"],
  },
  {
    topic: /Text children/u,
    guides: [
      "guides/children-text-lists-and-keys.md",
      "design/drawing-components-contract.md",
    ],
    evidence: ["text.example.tsx"],
  },
  {
    topic: /Layout and specified style/u,
    guides: [
      "guides/layout-groups-clips-and-layers.md",
      "design/layout-system-contract.md",
    ],
    evidence: ["flex.example.tsx"],
  },
  {
    topic: /`Group`, `Clip`/u,
    guides: [
      "guides/layout-groups-clips-and-layers.md",
      "design/drawing-components-contract.md",
    ],
    evidence: ["group.example.tsx", "clip.example.tsx", "layer.example.tsx"],
  },
  {
    topic: /State, immediate lifecycle/u,
    guides: [
      "guides/state-lifecycle-and-react-differences.md",
      "design/runtime-hooks-contract.md",
    ],
    evidence: ["runtime-hooks.example.tsx"],
  },
  {
    topic: /Ordinary composite/u,
    guides: ["guides/custom-components-and-primitives.md"],
    evidence: ["crc-canvas-context.test.tsx"],
  },
  {
    topic: /Full `definePrimitive`/u,
    guides: [
      "guides/custom-components-and-primitives.md",
      "design/style-system-contract.md",
    ],
    evidence: ["define-primitive.test.tsx"],
  },
  {
    topic: /Complete non-JSX API/u,
    guides: ["guides/without-jsx.md"],
    evidence: ["verify-docs.mjs", "create-element-authoring.example.tsx"],
  },
  {
    topic: /One runtime per file/u,
    guides: ["guides/react-interop.md", "guides/configuring-jsx.md"],
    evidence: ["mixed-runtime/react-host.tsx"],
  },
  {
    topic: /Wrong-runtime diagnostics/u,
    guides: ["guides/jsx-troubleshooting.md"],
    evidence: ["foreign-runtime-diagnostics.test.tsx"],
  },
  {
    topic: /Focus and directional keyboard/u,
    guides: [
      "guides/focus-keyboard-and-accessibility.md",
      "design/focus-and-keyboard-navigation-contract.md",
    ],
    evidence: ["focus-management.example.tsx"],
  },
  {
    topic: /Accessibility limitations/u,
    guides: [
      "design/canvas-accessibility-guidance.md",
      "guides/focus-keyboard-and-accessibility.md",
    ],
    evidence: ["focus-navigation.example.tsx"],
  },
  {
    topic: /Complete public values/u,
    guides: ["api-reference.md"],
    evidence: ["final-public-vocabulary.tsx"],
  },
  {
    topic: /One-time breaking migration/u,
    guides: ["migrations/jsx-authoring-pivot.md"],
    evidence: ["public-api.test.ts"],
  },
];

export function assertAcceptanceMatrix(matrixSource) {
  const rows = matrixSource
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| ---"))
    .slice(1);
  assert.equal(
    rows.length,
    matrixRequirements.length,
    "Documentation acceptance matrix must map every approved item exactly once.",
  );
  const unmatched = new Set(matrixRequirements);
  for (const row of rows) {
    const columns = row.split("|");
    const guideTargets = [...columns[2].matchAll(/\]\(([^)]+)\)/gu)].map(
      (match) => match[1],
    );
    const evidenceTargets = [...columns[3].matchAll(/\]\(([^)]+)\)/gu)].map(
      (match) => match[1],
    );
    assert.match(
      columns[2],
      /\]\([^)]*(?:guides|design|migrations|api-reference)[^)]*\.md(?:#[^)]*)?\)/u,
      `Acceptance row lacks a current guide/contract link: ${row}`,
    );
    assert.match(
      columns[3],
      /\]\([^)]+\.(?:[cm]?[jt]sx?|mjs)(?:#[^)]*)?\)/u,
      `Acceptance row lacks executable evidence: ${row}`,
    );
    const requirement = [...unmatched].find((candidate) =>
      candidate.topic.test(columns[1]),
    );
    assert.ok(
      requirement,
      `Acceptance row has no approved semantic mapping: ${row}`,
    );
    unmatched.delete(requirement);
    for (const target of requirement.guides) {
      assert.ok(
        guideTargets.some((link) => link.includes(target)),
        `${columns[1]} must map to ${target}`,
      );
    }
    for (const target of requirement.evidence) {
      assert.ok(
        evidenceTargets.some((link) => link.includes(target)),
        `${columns[1]} must cite ${target}`,
      );
    }
  }
  assert.equal(
    unmatched.size,
    0,
    "Acceptance matrix omitted approved semantic mappings",
  );
  return rows;
}

const libraryStatus = currentSources.get("docs/library-status.md");
const matrix = libraryStatus.slice(
  libraryStatus.indexOf("## Documentation acceptance matrix"),
  libraryStatus.indexOf("## Running locally"),
);
const matrixRows = assertAcceptanceMatrix(matrix);
for (const guide of guidePaths) {
  assert.ok(
    libraryStatus.includes(`./${guide.slice("docs/".length)}`),
    `Acceptance matrix does not map ${guide}`,
  );
}

const completeSnippets = extractCompleteSnippets(currentSources);
assertSameNames(
  new Set(completeSnippets.keys()),
  requiredCompleteSnippetIds,
  "Explicitly marked complete documentation snippets",
);
for (const snippet of completeSnippets.values()) {
  for (const imported of importedPublicNames(
    snippet.source,
    `${snippet.path}#${snippet.id}`,
  )) {
    assert.ok(
      rootExports.values.has(imported) || rootExports.types.has(imported),
      `Complete snippet ${snippet.id} imports unknown public name ${imported}`,
    );
  }
}

const compiledSnippetCount = await typecheckCompleteSnippets(completeSnippets);
const javascriptSnippet = completeSnippets.get("javascript-runtime");
await assertAutomaticRuntimeTransforms(
  javascriptSnippet.source,
  babelOptionsFromGuide(configuring),
);
assertNonJsxCoverage(completeSnippets.get("without-jsx").source);

export async function verifyMutationProbes() {
  let probes = 0;
  const rejects = async (operation, pattern) => {
    await assert.rejects(operation, pattern);
    probes += 1;
  };
  const throws = (operation, pattern) => {
    assert.throws(operation, pattern);
    probes += 1;
  };

  const direct = exportedSpecifiers(
    "export const directValue = 1; export interface DirectType {}",
    "direct-export-red-probe.ts",
  );
  assert.ok(direct.values.has("directValue"));
  assert.ok(direct.types.has("DirectType"));
  probes += 1;
  throws(
    () =>
      exportedSpecifiers(
        'export * from "./unknown.js";',
        "export-star-red-probe.ts",
      ),
    /fail closed/u,
  );

  throws(
    () =>
      assertHistoricalBanner(
        "history.md",
        "# History\n\nInstructions continue.",
      ),
    /visibly identify/u,
  );
  throws(
    () => assertCurrentVocabulary("current.md", "Use the `clip` value."),
    /removed lowercase/u,
  );
  await rejects(
    () =>
      assertLocalLinks(
        "docs/guides/jsx-quick-start.md",
        "# Existing\n\n[missing](#not-an-anchor)",
      ),
    /Broken local anchor/u,
  );

  throws(
    () =>
      assertAcceptanceMatrix(
        matrix.replaceAll("clip.example.tsx", "missing-clip.tsx"),
      ),
    /clip\.example\.tsx/u,
  );
  throws(
    () =>
      assertAcceptanceMatrix(
        matrix.replace("verify-docs.mjs) compiles", "missing.mjs) compiles"),
      ),
    /verify-docs\.mjs/u,
  );

  for (const [path, markers] of contractPrecisionRequirements) {
    for (const marker of markers) {
      const mutatedSources = new Map(currentSources);
      mutatedSources.set(path, currentSources.get(path).replace(marker, ""));
      throws(() => assertContractPrecision(mutatedSources), /exact shipped/u);
    }
  }

  const nonJsx = completeSnippets.get("without-jsx").source;
  const nonJsxMutations = [
    [
      "fragment",
      nonJsx.replace("createElement(Fragment,", "createElement(Group,"),
    ],
    ["dynamic list", nonJsx.replace(/\.map\s*\(/u, ".flatMap(")],
    ["keys", nonJsx.replaceAll("{ key:", "{ removedKey:")],
    [
      "text",
      nonJsx.replace(/createElement\(\s*Text,/gu, "createElement(Group,"),
    ],
    [
      "focus",
      nonJsx.replace(
        "createElement(\n    FocusManagement,",
        "createElement(\n    Group,",
      ),
    ],
    [
      "keyboard",
      nonJsx.replace(
        "createElement(\n      KeyboardNavigation,",
        "createElement(\n      Group,",
      ),
    ],
    ["lifecycle", nonJsx.replace("crcState(", "missingState(")],
    [
      "mount",
      nonJsx.replace("return crc(canvas,", "return missingMount(canvas,"),
    ],
    [
      "disposal",
      nonJsx.replace("controller.dispose()", "controller.keepAlive()"),
    ],
  ];
  for (const [label, mutation] of nonJsxMutations) {
    assert.throws(
      () => assertNonJsxCoverage(mutation),
      /Complete non-JSX snippet lacks/u,
      `Non-JSX ${label} RED mutation must fail`,
    );
    probes += 1;
  }

  const undeclaredSnippet = new Map([
    [
      "undeclared-red-probe",
      {
        id: "undeclared-red-probe",
        language: "tsx",
        path: "mutation probe",
        source:
          'import { Rectangle } from "@crc/core";\nconst broken = <MissingIdentifier />;\nvoid Rectangle;\nvoid broken;',
      },
    ],
  ]);
  await rejects(
    () => typecheckCompleteSnippets(undeclaredSnippet),
    /failed typecheck/u,
  );
  await rejects(
    () =>
      assertAutomaticRuntimeTransforms(
        javascriptSnippet.source.replace(
          "/** @jsxImportSource @crc/core */",
          "",
        ),
        {
          runtime: "automatic",
          importSource: "react",
        },
      ),
    /Babel did not select/u,
  );

  process.stdout.write(
    `Documentation RED mutation probes passed: ${probes}.\n`,
  );
}

process.stdout.write(
  `Documentation checks passed: ${guidePaths.length} guides, ` +
    `${linkCheckedPaths.length} current/migration files, ` +
    `${historicalMarkdownPaths.length} historical/work records, ` +
    `${rootExports.values.size} values, ${rootExports.types.size} types, ` +
    `${matrixRows.length} acceptance rows, ${parsedSnippetCount} parsed ` +
    `code snippets, ${compiledSnippetCount} extracted TypeScript programs, ` +
    `and the extracted JavaScript program through Babel and esbuild.\n`,
);
