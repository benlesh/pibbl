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
import {
  assertContractPreservationBaseline,
  CONTRACT_BASELINE_COMMIT,
  CONTRACT_TRANSLATION_RECORD,
  replaceContractUnit,
  sha256,
} from "./docs-contract-preservation.mjs";
import {
  assertFieldMigrationCompleteness,
  LEGACY_FIELD_TYPE_COMMIT,
} from "./docs-field-migration.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

function trackedRepositoryFiles(pathspecs) {
  const listing = spawnSync("git", ["ls-files", "--", ...pathspecs], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(
    listing.status,
    0,
    `Could not inventory tracked repository files:\n${listing.stderr}`,
  );
  return listing.stdout.split("\n").filter(Boolean).sort();
}

function sourceAtCommit(commit, path) {
  const result = spawnSync("git", ["show", `${commit}:${path}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `Could not read reviewed source ${commit}:${path}. ` +
      "The requested contract-provenance check requires repository history.\n" +
      result.stderr,
  );
  return result.stdout;
}
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
const presentationSourcePaths = trackedRepositoryFiles([
  "packages/scenarios/src",
  "playground",
]).filter((path) => /\.(?:html|mjs|ts|tsx|txt)$/u.test(path));
const exampleSourcePaths = trackedRepositoryFiles(["*.example.tsx"]);
for (const path of exampleSourcePaths) {
  assert.ok(
    presentationSourcePaths.includes(path),
    `Active example source escaped the presentation vocabulary gate: ${path}`,
  );
}
for (const representative of [
  "packages/scenarios/src/learning/start/getting-started.example.tsx",
  "packages/scenarios/src/mouse-contract.ts",
  "playground/src/main.ts",
]) {
  assert.ok(
    presentationSourcePaths.includes(representative),
    `Presentation source discovery omitted ${representative}`,
  );
}
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

const compilerRuntimeEntryPaths = new Set([
  "packages/core/src/jsx-dev-runtime.ts",
  "packages/core/src/jsx-runtime.ts",
]);

function compilerJsxNamespaceMembers(declaration, filename) {
  assert.ok(
    compilerRuntimeEntryPaths.has(filename),
    `${filename} uses unsupported exported namespace ${declaration.id?.name ?? "<unknown>"}`,
  );
  assert.equal(
    declaration.id?.type,
    "Identifier",
    `${filename} uses an unsupported exported module name`,
  );
  assert.equal(
    declaration.id.name,
    "JSX",
    `${filename} uses unsupported exported namespace ${declaration.id.name}`,
  );
  assert.equal(
    declaration.body?.type,
    "TSModuleBlock",
    `${filename} must define JSX with an inline namespace block`,
  );

  const names = new Set();
  for (const rawMember of declaration.body.body) {
    assert.equal(
      rawMember.type,
      "ExportNamedDeclaration",
      `${filename} JSX namespace uses unsupported member ${rawMember.type}`,
    );
    assert.equal(
      rawMember.source,
      null,
      `${filename} JSX namespace must not re-export another module`,
    );
    assert.equal(
      rawMember.specifiers.length,
      0,
      `${filename} JSX namespace uses unsupported export specifiers`,
    );
    const member = rawMember.declaration;
    assert.ok(member, `${filename} JSX namespace has an empty export`);
    assert.ok(
      member.type === "TSTypeAliasDeclaration" ||
        member.type === "TSInterfaceDeclaration",
      `${filename} JSX namespace uses unsupported runtime member ${member.type}`,
    );
    assert.equal(
      member.id.type,
      "Identifier",
      `${filename} JSX namespace member must have an identifier`,
    );
    names.add(member.id.name);
  }
  return names;
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
    if (
      statement.type === "TSExportAssignment" ||
      statement.type === "TSNamespaceExportDeclaration" ||
      (statement.type === "TSImportEqualsDeclaration" && statement.isExport)
    ) {
      assert.fail(
        `${filename} uses unsupported top-level export ${statement.type}`,
      );
    }
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
        declaration.type === "TSInterfaceDeclaration"
      ) {
        types.add(declaration.id.name);
      } else if (declaration.type === "TSDeclareFunction") {
        values.add(declaration.id.name);
      } else if (declaration.type === "TSEnumDeclaration") {
        values.add(declaration.id.name);
        types.add(declaration.id.name);
      } else if (declaration.type === "TSModuleDeclaration") {
        compilerJsxNamespaceMembers(declaration, filename);
      } else {
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
      assert.notEqual(
        name,
        "default",
        `${filename} uses an unsupported default export alias`,
      );
      const isType =
        statement.exportKind === "type" || specifier.exportKind === "type";
      (isType ? types : values).add(name);
    }
  }
  return { values, types };
}

function jsxNamespaceMembers(source, filename) {
  let names;
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
    assert.equal(names, undefined, `${filename} exports JSX more than once`);
    names = compilerJsxNamespaceMembers(declaration, filename);
  }
  assert.ok(names, `${filename} is missing its exported JSX namespace`);
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

function walkSyntax(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkSyntax(item, visit);
    return;
  }
  if (!value || typeof value !== "object" || typeof value.type !== "string") {
    return;
  }
  visit(value);
  for (const [key, child] of Object.entries(value)) {
    if (["comments", "loc", "start", "end", "extra"].includes(key)) continue;
    walkSyntax(child, visit);
  }
}

function identifierName(node) {
  return node?.type === "Identifier" ? node.name : undefined;
}

function memberName(node) {
  if (node?.type !== "MemberExpression" || node.computed) return undefined;
  return identifierName(node.property);
}

function jsxName(node) {
  return node?.type === "JSXIdentifier" ? node.name : undefined;
}

function callName(node) {
  return node?.type === "CallExpression"
    ? identifierName(node.callee)
    : undefined;
}

function stateBindings(program) {
  const bindings = new Map();
  walkSyntax(program, (node) => {
    if (
      node.type !== "VariableDeclarator" ||
      node.id?.type !== "ArrayPattern" ||
      callName(node.init) !== "crcState"
    ) {
      return;
    }
    const valueName = identifierName(node.id.elements[0]);
    if (valueName) bindings.set(valueName, node.init.arguments[0]);
  });
  return bindings;
}

function assertLayerEvidence(source) {
  const program = parseModule(source, "multi-child Layer evidence").program;
  const layers = [];
  walkSyntax(program, (node) => {
    if (
      node.type === "JSXElement" &&
      jsxName(node.openingElement?.name) === "Layer"
    ) {
      layers.push(node);
    }
  });
  assert.ok(layers.length > 0, "Layer evidence must render a Layer element");
  assert.ok(
    layers.some(
      (layer) =>
        layer.children.filter(
          (child) =>
            child.type === "JSXElement" || child.type === "JSXFragment",
        ).length >= 2,
    ),
    "Layer evidence must exercise a multi-child Layer with direct children",
  );
}

function assertNamedJsxEvidence(source, component) {
  const program = parseModule(
    source,
    `${component} composition evidence`,
  ).program;
  let found = false;
  walkSyntax(program, (node) => {
    if (
      node.type === "JSXElement" &&
      jsxName(node.openingElement?.name) === component
    ) {
      found = true;
    }
  });
  assert.ok(found, `${component} example must render a ${component} element`);
}

function assertTextEvidence(source) {
  const program = parseModule(source, "Text interpolation evidence").program;
  const stateNames = new Set(stateBindings(program).keys());
  let hasZero = false;
  let hasState = false;
  walkSyntax(program, (node) => {
    if (
      node.type !== "JSXElement" ||
      jsxName(node.openingElement?.name) !== "Text"
    ) {
      return;
    }
    for (const child of node.children) {
      if (child.type !== "JSXExpressionContainer") continue;
      if (
        child.expression?.type === "NumericLiteral" &&
        child.expression.value === 0
      ) {
        hasZero = true;
      }
      walkSyntax(child.expression, (expression) => {
        if (
          expression.type === "Identifier" &&
          stateNames.has(expression.name)
        ) {
          hasState = true;
        }
      });
    }
  });
  assert.ok(hasZero, "Text evidence must render numeric zero as a child");
  assert.ok(
    hasState,
    "Text evidence must render state interpolation as a child",
  );
}

function objectProperty(object, name) {
  if (object?.type !== "ObjectExpression") return undefined;
  const property = object.properties.find(
    (candidate) =>
      candidate.type === "ObjectProperty" &&
      !candidate.computed &&
      identifierName(candidate.key) === name,
  );
  return property?.value;
}

function assertNonJsxEvidence(source) {
  const program = parseModule(source, "complete non-JSX evidence").program;
  const bindings = stateBindings(program);
  const zeroStateNames = new Set(
    [...bindings]
      .filter(
        ([, initial]) =>
          initial?.type === "NumericLiteral" && initial.value === 0,
      )
      .map(([name]) => name),
  );
  const constructed = new Set();
  let hasJsx = false;
  let hasKey = false;
  let hasConditionalList = false;
  let hasDirectionalPolicy = false;
  let hasLifecycle = false;
  let hasMount = false;
  let textUsesZeroState = false;
  let textUsesDynamicState = false;

  walkSyntax(program, (node) => {
    if (node.type === "JSXElement" || node.type === "JSXFragment")
      hasJsx = true;
    if (callName(node) === "crcWhenChanged") hasLifecycle = true;
    if (callName(node) === "crc") hasMount = true;
    if (
      node.type === "CallExpression" &&
      memberName(node.callee) === "map" &&
      node.callee.object?.type === "ConditionalExpression"
    ) {
      hasConditionalList = true;
    }
    if (callName(node) !== "createElement") return;
    const typeName = identifierName(node.arguments[0]);
    if (typeName) constructed.add(typeName);
    const props = node.arguments[1];
    if (objectProperty(props, "key")) hasKey = true;
    if (
      typeName === "KeyboardNavigation" &&
      objectProperty(props, "mode")?.type === "StringLiteral" &&
      objectProperty(props, "mode").value === "directional"
    ) {
      hasDirectionalPolicy = true;
    }
    if (typeName !== "Text") return;
    const textChildren = [
      ...node.arguments.slice(2),
      objectProperty(props, "children"),
    ].filter(Boolean);
    for (const child of textChildren) {
      walkSyntax(child, (expression) => {
        if (expression.type !== "Identifier") return;
        if (zeroStateNames.has(expression.name)) textUsesZeroState = true;
        if (bindings.has(expression.name)) textUsesDynamicState = true;
      });
    }
  });

  assert.equal(hasJsx, false, "Complete non-JSX evidence must contain no JSX");
  assert.ok(
    constructed.has("Fragment"),
    "Complete non-JSX evidence lacks Fragment construction",
  );
  assert.ok(
    hasConditionalList,
    "Complete non-JSX evidence lacks dynamic list children",
  );
  assert.ok(hasKey, "Complete non-JSX evidence lacks explicit keys");
  assert.ok(
    textUsesZeroState,
    "Complete non-JSX evidence lacks Text numeric zero",
  );
  assert.ok(
    textUsesDynamicState,
    "Complete non-JSX evidence lacks dynamic Text children",
  );
  assert.ok(
    constructed.has("FocusManagement"),
    "Complete non-JSX evidence lacks FocusManagement",
  );
  assert.ok(
    constructed.has("KeyboardNavigation") && hasDirectionalPolicy,
    "Complete non-JSX evidence lacks directional KeyboardNavigation",
  );
  assert.ok(hasLifecycle, "Complete non-JSX evidence lacks hook lifecycle");
  assert.ok(hasMount, "Complete non-JSX evidence lacks root mounting");
}

function assertMountedNonJsxEvidence(source) {
  const program = parseModule(source, "mounted non-JSX evidence").program;
  let targetTest;
  walkSyntax(program, (node) => {
    if (
      node.type === "CallExpression" &&
      identifierName(node.callee) === "it" &&
      node.arguments[0]?.type === "StringLiteral" &&
      node.arguments[0].value.startsWith("mounts and drives fragments")
    ) {
      targetTest = node.arguments[1];
    }
  });
  assert.ok(
    targetTest,
    "Mounted non-JSX evidence lacks its focused executable test",
  );
  const calls = [];
  const literals = new Set();
  let disposes = 0;
  walkSyntax(targetTest, (node) => {
    if (node.type === "StringLiteral") literals.add(node.value);
    if (node.type !== "CallExpression") return;
    const name = identifierName(node.callee);
    if (name) calls.push([name, node.arguments[0]?.value]);
    if (
      node.callee?.type === "MemberExpression" &&
      identifierName(node.callee.object) === "controller" &&
      memberName(node.callee) === "dispose"
    ) {
      disposes += 1;
    }
  });
  assert.ok(
    calls.some(
      ([name, argument]) =>
        name === "renderLearningExample" &&
        argument === "create-element-authoring",
    ),
    "Mounted non-JSX evidence must mount the dedicated learning example",
  );
  assert.ok(
    calls.some(([name]) => name === "clickLogicalPoint"),
    "Mounted non-JSX evidence must drive pointer activation",
  );
  assert.ok(
    calls.some(
      ([name, argument]) => name === "pressKey" && argument === "ArrowRight",
    ) &&
      calls.some(
        ([name, argument]) => name === "pressKey" && argument === "Enter",
      ),
    "Mounted non-JSX evidence must drive directional focus and keyboard activation",
  );
  for (const value of [
    "SELECTED NONE · COUNT 0",
    "SELECTED A · COUNT 1",
    "SELECTED B · COUNT 2",
    "CHOICE C",
    "LIFECYCLE 1",
  ]) {
    assert.ok(
      literals.has(value),
      `Mounted non-JSX evidence must assert ${value}`,
    );
  }
  assert.ok(
    disposes >= 2,
    "Mounted non-JSX evidence must prove idempotent disposal",
  );
}

function assertDirectionalEvidence(source) {
  const program = parseModule(
    source,
    "directional-navigation evidence",
  ).program;
  let focus = false;
  let directional = false;
  walkSyntax(program, (node) => {
    if (node.type !== "JSXElement") return;
    const name = jsxName(node.openingElement?.name);
    if (name === "FocusManagement") focus = true;
    if (name !== "KeyboardNavigation") return;
    directional = node.openingElement.attributes.some(
      (attribute) =>
        attribute.type === "JSXAttribute" &&
        jsxName(attribute.name) === "mode" &&
        ((attribute.value?.type === "StringLiteral" &&
          attribute.value.value === "directional") ||
          (attribute.value?.type === "JSXExpressionContainer" &&
            attribute.value.expression?.type === "StringLiteral" &&
            attribute.value.expression.value === "directional")),
    );
  });
  assert.ok(
    focus && directional,
    "directional-navigation evidence must mount both focus and directional policies",
  );
}

export function assertExecutableEvidence(sources) {
  const required = (path) => {
    const source = sources.get(path);
    assert.equal(
      typeof source,
      "string",
      `Missing executable evidence ${path}`,
    );
    return source;
  };
  assertNamedJsxEvidence(
    required("packages/scenarios/src/learning/composition/group.example.tsx"),
    "Group",
  );
  assertNamedJsxEvidence(
    required("packages/scenarios/src/learning/composition/clip.example.tsx"),
    "Clip",
  );
  assertLayerEvidence(
    required("packages/scenarios/src/learning/composition/layer.example.tsx"),
  );
  assertTextEvidence(
    required("packages/scenarios/src/learning/drawing/text.example.tsx"),
  );
  assertNonJsxEvidence(
    required(
      "packages/scenarios/src/learning/start/create-element-authoring.example.tsx",
    ),
  );
  assertMountedNonJsxEvidence(
    required("packages/core/test/learning-examples.test.ts"),
  );
  assertDirectionalEvidence(
    required(
      "packages/scenarios/src/learning/keyboard-focus/directional-navigation.example.tsx",
    ),
  );
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
    /^> \*\*Historical status: [A-Z][^*]*\.\*\*/mu,
    `${path} must use a visible Historical status banner near the title`,
  );
  assert.doesNotMatch(
    opening,
    /^> \*\*Historical status: [^*\n]*\bCURRENT\b/mu,
    `${path} is classified as historical and must not claim CURRENT status`,
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
      "infinite iterables are unsupported",
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
      "Same-mount root, prop, and dimension updates",
    ],
  ],
  [
    "docs/design/runtime-hooks-contract.md",
    [
      "callers may ignore it",
      "measurement is nested during\nan active render",
      "consuming or reordering the parent component's hook slots",
      '`<Receiver> received duplicate CRC key "<key>" as a CRC child.`',
    ],
  ],
  [
    "docs/architecture/style-and-layout-architecture.md",
    [
      "needs a definite allocation when it hides",
      "those capabilities never attach",
    ],
  ],
  [
    "docs/design/event-resource-ownership.md",
    ["ignore the additive controller return value"],
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

const normativeContractPaths = [
  "docs/architecture/style-and-layout-architecture.md",
  ...currentMarkdownPaths.filter(
    (path) =>
      path.startsWith("docs/design/") &&
      path !== "docs/design/tfc-01-characterization-baseline.md",
  ),
].sort();
const contractPreservationBaseline = JSON.parse(
  await readFile(
    join(repositoryRoot, "tooling/docs-contract-preservation-baseline.json"),
    "utf8",
  ),
);
const approvalRecordSources = new Map(
  await Promise.all(
    contractPreservationBaseline.approvalRecords.map(async ({ path }) => [
      path,
      await readFile(join(repositoryRoot, path), "utf8"),
    ]),
  ),
);
const baselineStyleUnits = contractPreservationBaseline.contracts.find(
  ({ path }) => path === "docs/design/style-system-contract.md",
)?.baselineUnits;
assert.ok(
  baselineStyleUnits,
  "Contract baseline lacks the style-system contract",
);
const fieldTypePaths = [
  "packages/core/src/lib/types.ts",
  "packages/core/src/lib/style/types.ts",
  ...[
    "clip",
    "g",
    "horizontal-line",
    "img",
    "layer",
    "line",
    "path",
    "rect",
    "svg-path",
    "text",
    "vertical-line",
  ].map((name) => `packages/core/src/lib/components/${name}.ts`),
];
const legacyFieldTypePaths = fieldTypePaths.filter(
  (path) => path !== "packages/core/src/lib/style/types.ts",
);
const currentFieldTypeSources = new Map(
  await Promise.all(
    fieldTypePaths.map(async (path) => [
      path,
      await readFile(join(repositoryRoot, path), "utf8"),
    ]),
  ),
);
const legacyFieldTypeObject = spawnSync(
  "git",
  ["cat-file", "-e", `${LEGACY_FIELD_TYPE_COMMIT}^{commit}`],
  { cwd: repositoryRoot, encoding: "utf8" },
);
const legacyFieldTypeSources =
  legacyFieldTypeObject.status === 0
    ? new Map(
        legacyFieldTypePaths.map((path) => [
          path,
          sourceAtCommit(LEGACY_FIELD_TYPE_COMMIT, path),
        ]),
      )
    : undefined;
const fieldMigrationArguments = {
  baselineStyleUnits,
  currentStyleSource: currentSources.get(
    "docs/design/style-system-contract.md",
  ),
  currentTypeSources: currentFieldTypeSources,
  legacyTypeSources: legacyFieldTypeSources,
  migrationSource,
};
const fieldMigrationResult = assertFieldMigrationCompleteness(
  fieldMigrationArguments,
);
const trackedContractEvidencePaths = new Set(
  trackedRepositoryFiles(["packages/core/src", "packages/core/test"]),
);
const requestedContractEvidencePaths = new Set(
  contractPreservationBaseline.evidenceMappings.flatMap(({ source, test }) => [
    source.path,
    test.path,
  ]),
);
const contractEvidenceSources = new Map();
for (const path of requestedContractEvidencePaths) {
  if (!trackedContractEvidencePaths.has(path)) continue;
  contractEvidenceSources.set(
    path,
    await readFile(join(repositoryRoot, path), "utf8"),
  );
}

const provenanceRequirement = process.env.CRC_VERIFY_CONTRACT_PROVENANCE;
assert.ok(
  provenanceRequirement === undefined ||
    provenanceRequirement === "0" ||
    provenanceRequirement === "1",
  "CRC_VERIFY_CONTRACT_PROVENANCE must be 0, 1, or unset.",
);
const baselineObject = spawnSync(
  "git",
  ["cat-file", "-e", `${CONTRACT_BASELINE_COMMIT}^{commit}`],
  { cwd: repositoryRoot, encoding: "utf8" },
);
const baselineHistoryAvailable = baselineObject.status === 0;
if (provenanceRequirement === "1" && !baselineHistoryAvailable) {
  assert.fail(
    `Contract provenance was required, but Git commit ${CONTRACT_BASELINE_COMMIT} ` +
      "is unavailable. Fetch full history (for example, checkout with fetch-depth: 0) " +
      "or run without CRC_VERIFY_CONTRACT_PROVENANCE=1 to validate the embedded, " +
      "digest-locked semantic baseline.",
  );
}
const verifyBaselineProvenance =
  baselineHistoryAvailable && provenanceRequirement !== "0";
const baselineContractSources = verifyBaselineProvenance
  ? new Map(
      normativeContractPaths.map((path) => [
        path,
        sourceAtCommit(CONTRACT_BASELINE_COMMIT, path),
      ]),
    )
  : undefined;
const translationRecordSource = await readFile(
  join(repositoryRoot, CONTRACT_TRANSLATION_RECORD),
  "utf8",
);
const translationRecordBaselineSource = verifyBaselineProvenance
  ? sourceAtCommit(CONTRACT_BASELINE_COMMIT, CONTRACT_TRANSLATION_RECORD)
  : undefined;
const contractPreservationResult = assertContractPreservationBaseline({
  manifest: contractPreservationBaseline,
  expectedContractPaths: normativeContractPaths,
  baselineSources: baselineContractSources,
  currentSources,
  translationRecordSource,
  translationRecordBaselineSource,
  approvalRecordSources,
  evidenceSources: contractEvidenceSources,
  trackedEvidencePaths: trackedContractEvidencePaths,
});

const readme = currentSources.get("README.md");
const advancedStart = readme.indexOf("## Learn the API");
assert.ok(readme.indexOf("## Quick start") >= 0, "README needs a quick start.");
assert.ok(
  advancedStart > readme.indexOf("## Quick start"),
  "README quick start must precede advanced material.",
);
export function assertFixedConfigSignal(source) {
  assert.match(
    source,
    /fixed logical viewport with optional `fit`,\s*`pixelRatio`, and `signal`/u,
    "API reference must document signal for fixed CRCConfig as well as responsive CRCConfig",
  );
}
assertFixedConfigSignal(apiReference);
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
    evidence: ["text.example.tsx", "learning-examples.test.ts"],
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
    evidence: [
      "create-element-authoring.example.tsx",
      "learning-examples.test.ts",
    ],
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
    evidence: ["directional-navigation.example.tsx"],
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

const executableEvidencePaths = [
  "packages/core/test/learning-examples.test.ts",
  "packages/scenarios/src/learning/composition/clip.example.tsx",
  "packages/scenarios/src/learning/composition/group.example.tsx",
  "packages/scenarios/src/learning/composition/layer.example.tsx",
  "packages/scenarios/src/learning/drawing/text.example.tsx",
  "packages/scenarios/src/learning/keyboard-focus/directional-navigation.example.tsx",
  "packages/scenarios/src/learning/start/create-element-authoring.example.tsx",
];
const executableEvidenceSources = new Map(
  await Promise.all(
    executableEvidencePaths.map(async (path) => [
      path,
      await readFile(join(repositoryRoot, path), "utf8"),
    ]),
  ),
);
assertExecutableEvidence(executableEvidenceSources);

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
    "export const directValue = 1; export declare function declaredValue(): void; export interface DirectType {}",
    "direct-export-red-probe.ts",
  );
  assert.ok(direct.values.has("directValue"));
  assert.ok(direct.values.has("declaredValue"));
  assert.ok(direct.types.has("DirectType"));
  probes += 1;
  const wrongFieldMigration = migrationSource.replace(
    "`HorizontalLine` `style.x2`",
    "`HorizontalLine` `style.x1`",
  );
  assert.notEqual(
    wrongFieldMigration,
    migrationSource,
    "Field-level migration mutation fixture did not change",
  );
  throws(
    () =>
      assertFieldMigrationCompleteness({
        ...fieldMigrationArguments,
        migrationSource: wrongFieldMigration,
      }),
    /field-level migration.*wrong final replacement/iu,
  );
  const wrongFieldBehavior = migrationSource.replace(
    "`Rectangle` `style.fill`                      | Same fill value",
    "`Rectangle` `style.fill`                      | Different fill behavior",
  );
  assert.notEqual(
    wrongFieldBehavior,
    migrationSource,
    "Field-level behavior mutation fixture did not change",
  );
  throws(
    () =>
      assertFieldMigrationCompleteness({
        ...fieldMigrationArguments,
        migrationSource: wrongFieldBehavior,
      }),
    /field-level migration rect\.fillStyle has the wrong final behavior/iu,
  );
  const wrongFieldRequiredness = migrationSource.replace(
    "`Rectangle` `style.x`                         | Optional; defaults to `0`",
    "`Rectangle` `style.x`                         | Required; defaults to `0`",
  );
  assert.notEqual(
    wrongFieldRequiredness,
    migrationSource,
    "Field-level requiredness mutation fixture did not change",
  );
  throws(
    () =>
      assertFieldMigrationCompleteness({
        ...fieldMigrationArguments,
        migrationSource: wrongFieldRequiredness,
      }),
    /field-level migration rect\.x has the wrong final behavior/iu,
  );
  throws(
    () =>
      exportedSpecifiers(
        'export * from "./unknown.js";',
        "export-star-red-probe.ts",
      ),
    /fail closed/u,
  );
  for (const [source, form] of [
    [
      "export namespace Added { export const runtimeValue = 1 }",
      "namespace declaration",
    ],
    ["export = runtimeValue", "export assignment"],
    ["export as namespace Added", "namespace export"],
    ['export import Added = require("./added.js")', "exported import-equals"],
    ['export * as Added from "./added.js"', "namespace re-export specifier"],
  ]) {
    throws(
      () => exportedSpecifiers(source, `${form}-red-probe.ts`),
      /unsupported|fail closed/u,
    );
  }
  for (const source of [
    "const value = 1; export { value as default };",
    'export { default } from "./added.js";',
    "type Added = string; export type { Added as default };",
    'const value = 1; export { value as "default" };',
    'type Added = string; export type { Added as "default" };',
  ]) {
    throws(
      () => exportedSpecifiers(source, "default-alias-red-probe.ts"),
      /default export/u,
    );
  }
  throws(
    () =>
      exportedSpecifiers(
        "export namespace JSX { export const runtimeValue = 1 }",
        "packages/core/src/jsx-runtime.ts",
      ),
    /unsupported runtime member/u,
  );

  throws(
    () =>
      assertHistoricalBanner(
        "history.md",
        "# History\n\nInstructions continue.",
      ),
    /Historical status/u,
  );
  throws(
    () =>
      assertHistoricalBanner(
        "history.md",
        "# History\n\n> **Implementation status: CURRENT RECORD.** Work continues.",
      ),
    /Historical status/u,
  );
  throws(
    () => assertCurrentVocabulary("current.md", "Use the `clip` value."),
    /removed lowercase/u,
  );
  throws(
    () =>
      assertCurrentVocabulary(
        "packages/scenarios/src/learning/start/mutated.example.tsx",
        "const scene = rect({ width: 10, height: 10 });",
      ),
    /component-call vocabulary/u,
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
      assertFixedConfigSignal(
        apiReference.replace("`pixelRatio`, and `signal`", "`pixelRatio`"),
      ),
    /fixed CRCConfig/u,
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
        matrix.replaceAll(
          "directional-navigation.example.tsx",
          "missing-directional.example.tsx",
        ),
      ),
    /directional-navigation\.example\.tsx/u,
  );

  for (const [label, path, mutate, pattern] of [
    [
      "Group composition",
      "packages/scenarios/src/learning/composition/group.example.tsx",
      (source) =>
        source
          .replaceAll("<Group", "<MissingGroup")
          .replaceAll("</Group>", "</MissingGroup>"),
      /Group example/u,
    ],
    [
      "Clip composition",
      "packages/scenarios/src/learning/composition/clip.example.tsx",
      (source) =>
        source
          .replaceAll("<Clip", "<MissingClip")
          .replaceAll("</Clip>", "</MissingClip>"),
      /Clip example/u,
    ],
    [
      "multi-child Layer",
      "packages/scenarios/src/learning/composition/layer.example.tsx",
      () =>
        "const Scene = () => <Layer><Rectangle style={{ width: 1, height: 1 }} /></Layer>;",
      /multi-child Layer/u,
    ],
    [
      "Text zero",
      "packages/scenarios/src/learning/drawing/text.example.tsx",
      (source) => source.replace("{0}", '{"zero"}'),
      /numeric zero/u,
    ],
    [
      "Text state interpolation",
      "packages/scenarios/src/learning/drawing/text.example.tsx",
      (source) => source.replace("{accent}", '{"static"}'),
      /state interpolation/u,
    ],
    [
      "complete non-JSX Fragment",
      "packages/scenarios/src/learning/start/create-element-authoring.example.tsx",
      (source) =>
        source
          .replaceAll(
            "createElement(\n        Fragment,",
            "createElement(\n        Group,",
          )
          .replace(
            "createElement(\n    Fragment,",
            "createElement(\n    Group,",
          ),
      /Fragment/u,
    ],
    [
      "mounted non-JSX directional drive",
      "packages/core/test/learning-examples.test.ts",
      (source) => source.replace('await pressKey("ArrowRight");', ""),
      /Mounted.*directional/u,
    ],
    [
      "directional policy evidence",
      "packages/scenarios/src/learning/keyboard-focus/directional-navigation.example.tsx",
      (source) =>
        source.replace('mode={"directional"}', 'mode={"unsupported"}'),
      /directional-navigation/u,
    ],
  ]) {
    const mutated = new Map(executableEvidenceSources);
    const original = executableEvidenceSources.get(path);
    const changed = mutate(original);
    assert.notEqual(
      changed,
      original,
      `${label} RED mutation must alter source`,
    );
    mutated.set(path, changed);
    throws(() => assertExecutableEvidence(mutated), pattern);
  }

  for (const [path, markers] of contractPrecisionRequirements) {
    for (const marker of markers) {
      const mutatedSources = new Map(currentSources);
      mutatedSources.set(path, currentSources.get(path).replace(marker, ""));
      throws(() => assertContractPrecision(mutatedSources), /exact shipped/u);
    }
  }

  const assertPreservation = ({
    manifest = contractPreservationBaseline,
    sources = currentSources,
    baselineSources,
    baselineTranslation,
    embeddedOnly = false,
    approvalSources = approvalRecordSources,
    evidenceSources = contractEvidenceSources,
    evidencePaths = trackedContractEvidencePaths,
    reviewedManifestSha256,
  } = {}) =>
    assertContractPreservationBaseline({
      manifest,
      expectedContractPaths: normativeContractPaths,
      baselineSources: embeddedOnly
        ? undefined
        : (baselineSources ?? baselineContractSources),
      currentSources: sources,
      translationRecordSource,
      translationRecordBaselineSource: embeddedOnly
        ? undefined
        : (baselineTranslation ?? translationRecordBaselineSource),
      approvalRecordSources: approvalSources,
      evidenceSources,
      trackedEvidencePaths: evidencePaths,
      reviewedManifestSha256,
    });

  // The embedded snapshot remains a complete gate in shallow clones even when
  // the optional provenance commit is unavailable.
  assertPreservation({
    embeddedOnly: true,
  });
  probes += 1;

  const headingOnlySources = new Map(currentSources);
  for (const { path } of contractPreservationBaseline.contracts) {
    headingOnlySources.set(
      path,
      [...currentSources.get(path).matchAll(/^#{1,6}\s+.+$/gmu)]
        .map(([heading]) => heading)
        .join("\n"),
    );
  }
  throws(
    () => assertPreservation({ sources: headingOnlySources }),
    /reviewed complete semantic snapshot/u,
  );

  throws(
    () =>
      assertPreservation({
        manifest: {
          ...contractPreservationBaseline,
          sourceCommit: "0".repeat(40),
        },
      }),
    /reviewed pre-Task-14 commit/u,
  );

  for (const [label, before, after] of [
    [
      "natural negation",
      "Reference counts still collapse",
      "Reference counts still do not collapse",
    ],
    [
      "arbitrary token insertion",
      "one actual Canvas listener per type",
      "one actual unrelated Canvas listener per type",
    ],
  ]) {
    const path = "docs/design/event-resource-ownership.md";
    const mutatedSources = new Map(currentSources);
    const original = currentSources.get(path);
    const changed = original.replace(before, after);
    assert.notEqual(
      changed,
      original,
      `${label} mutation must alter contract prose`,
    );
    mutatedSources.set(path, changed);
    throws(
      () => assertPreservation({ sources: mutatedSources }),
      /reviewed complete semantic snapshot/u,
    );
  }

  const eventContract = contractPreservationBaseline.contracts.find(
    ({ path }) => path === "docs/design/event-resource-ownership.md",
  );
  const sharedListenerUnit = eventContract.currentUnits.find(({ text }) =>
    text.includes("Reference counts still collapse"),
  );
  assert.ok(sharedListenerUnit, "Shared-listener mutation unit is missing");
  for (const [label, replacement] of [
    ["heading", `## ${sharedListenerUnit.text}`],
    ["code", `\`\`\`text\n${sharedListenerUnit.text}\n\`\`\``],
  ]) {
    const path = eventContract.path;
    const mutatedSources = new Map(currentSources);
    mutatedSources.set(
      path,
      replaceContractUnit(
        currentSources.get(path),
        "c",
        sharedListenerUnit.id,
        replacement,
      ),
    );
    throws(
      () => assertPreservation({ sources: mutatedSources }),
      /reviewed complete semantic snapshot/u,
    );
    assert.ok(label);
  }

  const canvasContract = contractPreservationBaseline.contracts.find(
    ({ path }) => path === "docs/design/canvas-surface-contract.md",
  );
  const unmappedParagraph = canvasContract.currentUnits.find(({ text }) =>
    text.startsWith("Centering offsets may be fractional."),
  );
  assert.ok(unmappedParagraph, "Unmapped paragraph mutation unit is missing");
  assert.equal(
    contractPreservationBaseline.evidenceMappings.some(
      (mapping) =>
        mapping.contract === canvasContract.path &&
        unmappedParagraph.text.includes(mapping.claim.text),
    ),
    false,
    "Unmapped paragraph probe accidentally selected an evidence marker",
  );
  {
    const mutatedSources = new Map(currentSources);
    mutatedSources.set(
      canvasContract.path,
      replaceContractUnit(
        currentSources.get(canvasContract.path),
        "c",
        unmappedParagraph.id,
        "",
      ),
    );
    throws(
      () => assertPreservation({ sources: mutatedSources }),
      /reviewed complete semantic snapshot/u,
    );
  }

  const zeroSizeUnit = canvasContract.currentUnits.find(({ text }) =>
    text.startsWith("A zero-sized display axis"),
  );
  assert.ok(zeroSizeUnit, "Zero-size suppression mutation unit is missing");
  {
    const mutatedSources = new Map(currentSources);
    mutatedSources.set(
      canvasContract.path,
      replaceContractUnit(
        currentSources.get(canvasContract.path),
        "c",
        zeroSizeUnit.id,
        "",
      ),
    );
    throws(
      () => assertPreservation({ sources: mutatedSources }),
      /reviewed complete semantic snapshot/u,
    );
  }

  const layoutContract = contractPreservationBaseline.contracts.find(
    ({ path }) => path === "docs/design/layout-system-contract.md",
  );
  const flexDefaultRow = layoutContract.currentUnits.find(
    ({ kind, text }) => kind === "table" && text.includes("justifyContent"),
  );
  assert.ok(flexDefaultRow, "Flex default table mutation unit is missing");
  {
    const mutatedSources = new Map(currentSources);
    mutatedSources.set(
      layoutContract.path,
      replaceContractUnit(
        currentSources.get(layoutContract.path),
        "c",
        flexDefaultRow.id,
        flexDefaultRow.text.replace("(default)", "(changed default)"),
      ),
    );
    throws(
      () => assertPreservation({ sources: mutatedSources }),
      /reviewed complete semantic snapshot/u,
    );
  }

  const hooksContract = contractPreservationBaseline.contracts.find(
    ({ path }) => path === "docs/design/runtime-hooks-contract.md",
  );
  const memoRow = hooksContract.currentUnits.find(
    ({ kind, text }) =>
      kind === "table" && text.includes("crcMemo(create, deps)"),
  );
  assert.ok(memoRow, "Hook-specific table mutation unit is missing");
  {
    const mutatedSources = new Map(currentSources);
    mutatedSources.set(
      hooksContract.path,
      replaceContractUnit(
        currentSources.get(hooksContract.path),
        "c",
        memoRow.id,
        "",
      ),
    );
    throws(
      () => assertPreservation({ sources: mutatedSources }),
      /reviewed complete semantic snapshot/u,
    );
  }

  // Every prose paragraph, list obligation, table row, and code contract in all
  // twelve files must be indispensable, including clauses with no evidence map.
  for (const contract of contractPreservationBaseline.contracts) {
    const original = currentSources.get(contract.path);
    for (const unit of contract.currentUnits) {
      const mutatedSources = new Map(currentSources);
      const changed = replaceContractUnit(original, "c", unit.id, "");
      assert.notEqual(
        changed,
        original,
        `${contract.path}#${unit.id} deletion mutation must alter source`,
      );
      mutatedSources.set(contract.path, changed);
      throws(
        () => assertPreservation({ sources: mutatedSources }),
        /reviewed complete semantic snapshot/u,
      );
    }
  }

  const digestTamper = structuredClone(contractPreservationBaseline);
  digestTamper.contracts[0].sourceSha256 = "0".repeat(64);
  throws(
    () =>
      assertPreservation({
        manifest: digestTamper,
        embeddedOnly: true,
      }),
    /fixed reviewed snapshot/u,
  );

  if (baselineContractSources) {
    const tamperedBaselineSources = new Map(baselineContractSources);
    const path = contractPreservationBaseline.contracts[0].path;
    tamperedBaselineSources.set(
      path,
      `${tamperedBaselineSources.get(path)}\nBaseline provenance tamper.\n`,
    );
    throws(
      () => assertPreservation({ baselineSources: tamperedBaselineSources }),
      /baseline source digest/u,
    );
  }

  const irrelevantTranslation = structuredClone(contractPreservationBaseline);
  const samePathTranslations = irrelevantTranslation.translations.filter(
    ({ path }) => path === irrelevantTranslation.translations[0].path,
  );
  assert.ok(
    samePathTranslations.length >= 2,
    "Translation relevance mutation needs two mappings in one contract",
  );
  [samePathTranslations[0].currentIds, samePathTranslations[1].currentIds] = [
    samePathTranslations[1].currentIds,
    samePathTranslations[0].currentIds,
  ];
  const irrelevantTranslationDigest = sha256(
    JSON.stringify(irrelevantTranslation),
  );
  throws(
    () =>
      assertPreservation({
        manifest: irrelevantTranslation,
        reviewedManifestSha256: irrelevantTranslationDigest,
      }),
    /translation.*(?:transform|replacement|relevance)/iu,
  );

  // A current standard-shape clause must be authorized by the standard-shape
  // design itself, not by an unrelated but otherwise valid JSX-design unit.
  const unrelatedShapeApproval = structuredClone(contractPreservationBaseline);
  const standardShapeAddition = unrelatedShapeApproval.additions.find(
    ({ id }) =>
      id ===
      "design-drawing-components-contract-standard-shape-circle-matrix-addition",
  );
  assert.ok(
    standardShapeAddition,
    "Standard-shape approval mutation fixture is missing",
  );
  standardShapeAddition.approval = {
    recordId: "jsx-component-authoring",
    unitIds: ["a0006"],
  };
  standardShapeAddition.reason =
    "Approval record jsx-component-authoring unit a0006 purports to authorize exact current Circle matrix unit c0012 through the shared Circle, radius, and bounds anchors.";
  const unrelatedShapeApprovalDigest = sha256(
    JSON.stringify(unrelatedShapeApproval),
  );
  throws(
    () =>
      assertPreservation({
        manifest: unrelatedShapeApproval,
        reviewedManifestSha256: unrelatedShapeApprovalDigest,
      }),
    /standard-shape.*approval/iu,
  );

  const irrelevantEvidence = structuredClone(contractPreservationBaseline);
  const evidencePairs = irrelevantEvidence.evidenceMappings.map(
    ({ source, test }) => ({ source, test }),
  );
  for (const [
    index,
    mapping,
  ] of irrelevantEvidence.evidenceMappings.entries()) {
    const replacement = evidencePairs[(index + 1) % evidencePairs.length];
    mapping.source = replacement.source;
    mapping.test = replacement.test;
  }
  const irrelevantEvidenceDigest = sha256(JSON.stringify(irrelevantEvidence));
  throws(
    () =>
      assertPreservation({
        manifest: irrelevantEvidence,
        reviewedManifestSha256: irrelevantEvidenceDigest,
      }),
    /evidence.*(?:anchor|context|relevance)/iu,
  );

  const repeatedEvidence = structuredClone(contractPreservationBaseline);
  repeatedEvidence.evidenceMappings[26].source =
    repeatedEvidence.evidenceMappings[25].source;
  repeatedEvidence.evidenceMappings[26].test =
    repeatedEvidence.evidenceMappings[25].test;
  throws(
    () => assertPreservation({ manifest: repeatedEvidence }),
    /reuses identical generic/u,
  );

  const missingMarker = structuredClone(contractPreservationBaseline);
  missingMarker.evidenceMappings[0].source.marker =
    "missing reviewed implementation evidence marker";
  throws(
    () => assertPreservation({ manifest: missingMarker }),
    /lacks its exact reviewed marker/u,
  );

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
    `${contractPreservationResult.baselineUnitCount} pre-Task-14 and ` +
    `${contractPreservationResult.currentUnitCount} current semantic units across ` +
    `${contractPreservationBaseline.contracts.length} normative contracts, ` +
    `${contractPreservationResult.evidenceMappingCount} direct evidence mappings, ` +
    `${fieldMigrationResult.fieldMigrationCount} baseline-derived field migrations, ` +
    `baseline provenance ${contractPreservationResult.provenanceVerified ? "verified" : "embedded/digest-locked"}, ` +
    `${presentationSourcePaths.length} discovered presentation sources, and ` +
    `the extracted JavaScript program through Babel and esbuild.\n`,
);
