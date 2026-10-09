import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { transformAsync as babelTransform } from "@babel/core";
import { parse } from "@babel/parser";
import transformReactJsx from "@babel/plugin-transform-react-jsx";
import { transform } from "esbuild";
import {
  assertContractPreservationBaseline,
  assertPostBaselineContractPreservation,
  CONTRACT_BASELINE_COMMIT,
  CONTRACT_TRANSLATION_RECORD,
  extractContractUnits,
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
  const listing = spawnSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...pathspecs,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
  assert.equal(
    listing.status,
    0,
    `Could not inventory tracked repository files:\n${listing.stderr}`,
  );
  return [
    ...new Set(
      listing.stdout
        .split("\n")
        .filter((path) => path && existsSync(join(repositoryRoot, path))),
    ),
  ].sort();
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
const publicGuidePaths = [
  "docs/site/learn/guides/package-migration.md",
  "docs/site/learn/guides/author-without-jsx.md",
  "docs/site/learn/guides/components-props-and-children.md",
  "docs/site/learn/guides/compose-and-layout.md",
  "docs/site/learn/guides/configure-jsx.md",
  "docs/site/learn/guides/custom-components-and-primitives.md",
  "docs/site/learn/guides/focus-and-keyboard.md",
  "docs/site/learn/guides/jsx-troubleshooting.md",
  "docs/site/learn/guides/particle-effects.md",
  "docs/site/learn/guides/react-integration.md",
  "docs/site/learn/guides/signals-and-animation.md",
  "docs/site/learn/guides/physics-2d.md",
  "docs/site/learn/guides/state-and-lifecycle.md",
  "docs/site/learn/guides/style-and-draw.md",
  "docs/site/learn/guides/responsive-styles.md",
  "docs/site/learn/guides/three-js.md",
  "docs/site/learn/guides/procedural-textures.md",
  "docs/site/learn/guides/manipulation.md",
];
const publicSiteMarkdownPaths = [
  "docs/site/api/functions/record-frames.md",
  "docs/site/api/types/frame-recording.md",
  "docs/site/api/components/sprite.md",
  "docs/site/api/functions/machines.md",
  "docs/site/api/functions/play-animation.md",
  "docs/site/api/functions/sprite-sheets.md",
  "docs/site/api/hooks/use-machine.md",
  "docs/site/api/types/machines.md",
  "docs/site/api/types/sprites.md",
  "docs/site/learn/guides/machine-animation.md",
  "docs/site/learn/guides/sprites.md",
  "docs/site/learn/guides/state-machines.md",

  "docs/site/api/functions/path-transforms.md",
  "docs/site/api/hooks/use-visibility-transition.md",
  "docs/site/api/components/html-box.md",
  "docs/site/api/types/html-box.md",
  "docs/site/api/types/electric-textures.md",
  "docs/site/api/types/texture-resources.md",
  "docs/site/api/components/reaction-diffusion.md",
  "docs/site/api/components/procedural-texture.md",
  "docs/site/api/types/textures.md",
  "docs/site/api/types/electric-textures.md",
  "docs/site/api/functions/path-bending.md",
  "docs/site/api/functions/path-geometry.md",
  "docs/site/api/functions/text-geometry.md",
  "docs/site/api/functions/degrees.md",
  "docs/site/api/functions/pie-slices.md",
  "docs/site/api/hooks/use-manipulation.md",
  "docs/site/api/components/bar-series.md",
  "docs/site/api/components/drag-handle.md",
  "docs/site/api/components/manipulable.md",
  "docs/site/api/components/manipulation-frame.md",
  "docs/site/api/components/pie-layout.md",
  "docs/site/api/components/resize-handle.md",
  "docs/site/api/components/resize-handles.md",
  "docs/site/api/components/rotation-handle.md",
  "docs/site/learn/guides/data-visualization.md",
  "docs/site/api/components/scale.md",
  "docs/site/api/components/axis.md",
  "docs/site/api/components/axis-title.md",
  "docs/site/api/components/chart-lines.md",
  "docs/site/api/components/log-scale.md",
  "docs/site/api/components/numeric-ticks.md",
  "docs/site/api/components/symlog-point-scales.md",
  "docs/site/api/functions/utc-domains.md",
  "docs/site/api/components/line-series.md",
  "docs/site/api/components/area-series.md",
  "docs/site/api/functions/series-curves.md",
  "docs/site/api/functions/domain-navigation.md",
  "docs/site/api/components/color-scales.md",
  "docs/site/api/components/interval-band-series.md",
  "docs/site/api/components/point-series.md",
  "docs/site/api/components/plot-series.md",
  "docs/site/api/functions/nearest-point.md",
  "docs/site/api/functions/nearest-domain-value.md",
  "docs/site/api/components/hover-data.md",
  "docs/site/api/components/hover-card.md",
  "docs/site/api/components/anchored-layout.md",
  "docs/site/api/functions/define-series.md",
  "docs/site/api/functions/closest-point.md",
  "docs/site/api/functions/closest-x.md",
  "docs/site/api/functions/rendered-series-inspection.md",
  "docs/site/api/functions/interpolate-x.md",
  "docs/site/api/functions/linear-interpolation.md",

  "docs/site/api/components/scale-adjust.md",
  "docs/site/api/hooks/use-scale.md",
  "docs/site/api/index.md",
  "docs/site/api/components/absolute.md",
  "docs/site/api/components/arc.md",
  "docs/site/api/components/circle.md",
  "docs/site/api/components/clip.md",
  "docs/site/api/components/ellipse.md",
  "docs/site/api/components/flex.md",
  "docs/site/api/components/flow.md",
  "docs/site/api/components/focus-management.md",
  "docs/site/api/components/grid.md",
  "docs/site/api/components/group.md",
  "docs/site/api/components/horizontal-line.md",
  "docs/site/api/components/image.md",
  "docs/site/api/components/keyboard-navigation.md",
  "docs/site/api/components/layer.md",
  "docs/site/api/components/line.md",
  "docs/site/api/components/overlay.md",
  "docs/site/api/components/path.md",
  "docs/site/api/components/particles-2d.md",
  "docs/site/api/components/polygon.md",
  "docs/site/api/components/rectangle.md",
  "docs/site/api/components/regular-polygon.md",
  "docs/site/api/components/star.md",
  "docs/site/api/components/svg-path.md",
  "docs/site/api/components/text.md",
  "docs/site/api/components/vertical-line.md",
  "docs/site/api/components/wedge.md",
  "docs/site/api/functions/batch.md",
  "docs/site/api/functions/pibbl.md",
  "docs/site/api/functions/computed.md",
  "docs/site/api/functions/create-arc-path.md",
  "docs/site/api/functions/create-circle-path.md",
  "docs/site/api/functions/create-element.md",
  "docs/site/api/functions/create-ellipse-path.md",
  "docs/site/api/functions/create-line-path.md",
  "docs/site/api/functions/create-polygon-path.md",
  "docs/site/api/functions/create-rectangle-path.md",
  "docs/site/api/functions/create-regular-polygon-path.md",
  "docs/site/api/functions/create-star-path.md",
  "docs/site/api/functions/create-svg-path.md",
  "docs/site/api/functions/create-wedge-path.md",
  "docs/site/api/functions/define-animation.md",
  "docs/site/api/functions/define-render-layer.md",
  "docs/site/api/functions/define-three-layer.md",
  "docs/site/api/functions/define-primitive.md",
  "docs/site/api/functions/easing.md",
  "docs/site/api/functions/is-signal.md",
  "docs/site/api/functions/keyframes.md",
  "docs/site/api/functions/layout-diagnostic.md",
  "docs/site/api/functions/marker.md",
  "docs/site/api/functions/measure-element.md",
  "docs/site/api/functions/normalize-edges.md",
  "docs/site/api/functions/parallel.md",
  "docs/site/api/functions/define-particle-effect-2d.md",
  "docs/site/api/functions/particle-descriptors.md",
  "docs/site/api/functions/physics-2d-testing.md",
  "docs/site/api/functions/physics-2d.md",
  "docs/site/api/functions/physics-obstacles.md",
  "docs/site/api/functions/repeat.md",
  "docs/site/api/functions/resolve-signal-value.md",
  "docs/site/api/functions/resolve-box.md",
  "docs/site/api/functions/resolve-length.md",
  "docs/site/api/functions/sequence.md",
  "docs/site/api/functions/signal.md",
  "docs/site/api/functions/spring.md",
  "docs/site/api/functions/stepper.md",
  "docs/site/api/functions/drive.md",
  "docs/site/api/functions/tween.md",
  "docs/site/api/functions/untracked.md",
  "docs/site/api/functions/wait.md",
  "docs/site/api/hooks/use-canvas-context.md",
  "docs/site/api/hooks/use-computed.md",
  "docs/site/api/hooks/use-const.md",
  "docs/site/api/hooks/use-cursor.md",
  "docs/site/api/hooks/use-event-listener.md",
  "docs/site/api/hooks/use-event-target.md",
  "docs/site/api/hooks/use-flow-field.md",
  "docs/site/api/hooks/use-layout-box.md",
  "docs/site/api/hooks/use-line-path.md",
  "docs/site/api/hooks/use-particle-system.md",
  "docs/site/api/hooks/use-playback.md",
  "docs/site/api/hooks/use-rect-path.md",
  "docs/site/api/hooks/use-reaction.md",
  "docs/site/api/hooks/use-ref.md",
  "docs/site/api/hooks/use-signal.md",
  "docs/site/api/hooks/use-svg-path.md",
  "docs/site/api/hooks/use-animated-value.md",
  "docs/site/api/types/canvas-runtime.md",
  "docs/site/api/types/elements-components.md",
  "docs/site/api/types/events.md",
  "docs/site/api/types/filters.md",
  "docs/site/api/types/layout.md",
  "docs/site/api/types/particles.md",
  "docs/site/api/types/physics-2d.md",
  "docs/site/api/types/physics-2d-testing.md",
  "docs/site/api/types/signal-inputs.md",
  "docs/site/api/types/styles.md",
  "docs/site/api/types/texture-resources.md",
  "docs/site/api/types/three.md",
  "docs/site/learn/index.md",
  "docs/site/learn/tutorials/diagram-editor/index.md",
  "docs/site/learn/tutorials/diagram-editor/canvas-scene.md",
  "docs/site/learn/tutorials/diagram-editor/first-node.md",
  "docs/site/learn/tutorials/diagram-editor/connect-nodes.md",
  "docs/site/learn/tutorials/diagram-editor/reusable-node.md",
  "docs/site/learn/tutorials/diagram-editor/editor-chrome.md",
  "docs/site/learn/tutorials/diagram-editor/selection.md",
  "docs/site/learn/tutorials/diagram-editor/dragging.md",
  "docs/site/learn/tutorials/diagram-editor/pan-and-zoom.md",
  "docs/site/learn/tutorials/diagram-editor/viewport-and-layer.md",
  "docs/site/learn/tutorials/diagram-editor/filters.md",
  "docs/site/learn/tutorials/diagram-editor/keyboard-interaction.md",
  "docs/site/learn/tutorials/diagram-editor/finished-editor.md",
  ...publicGuidePaths,
];
const currentMarkdownPaths = [
  "docs/design/frame-recording-contract.md",
  "website/README.md",
  "docs/design/path-transforms-contract.md",
  "docs/design/component-manipulation-contract.md",
  "docs/design/text-geometry-contract.md",
  "docs/site/api/functions/path-transforms.md",
  "docs/site/api/hooks/use-visibility-transition.md",
  "packages/text/README.md",
  "docs/design/html-box-contract.md",
  "docs/design/weighted-electric-sources-contract.md",
  "docs/design/textures-contract.md",
  "packages/core/src/features/textures/README.md",
  "AGENTS.md",
  "README.md",
  "packages/core/README.md",
  "packages/pibbl/README.md",
  "packages/core/src/features/viz/README.md",
  "packages/core/src/features/particles/README.md",
  "packages/core/src/features/physics/README.md",
  "packages/three/README.md",
  "docs/architecture/style-and-layout-architecture.md",
  "docs/design/canvas-accessibility-guidance.md",
  "docs/design/canvas-surface-contract.md",
  "docs/design/animation-contract.md",
  "docs/design/drawing-components-contract.md",
  "docs/design/event-resource-ownership.md",
  "docs/design/focus-and-keyboard-navigation-contract.md",
  "docs/design/layout-system-contract.md",
  "docs/design/mouse-interaction-contract.md",
  "docs/design/runtime-hooks-contract.md",
  "docs/design/render-layer-and-three-contract.md",
  "docs/design/runtime-resource-ownership.md",
  "docs/design/signals-and-scheduling-contract.md",
  "docs/design/style-system-contract.md",
  "docs/design/user-events-contract.md",
  "docs/documentation-follow-up.md",
  "docs/follow-ups.md",
  "docs/library-status.md",
  "docs/migrations/signals-centric-hooks.md",
  "docs/project-plans/README.md",
  "docs/project-plans/WORKFLOW.md",
  "docs/scenario-index.md",
  "docs/design/physics-2d-contract.md",
  "tooling/physics-comparison/README.md",
  "tooling/texture-wasm-spike/README.md",
  "tooling/agent-verification/README.md",
  "docs/strategy/README.md",
  "docs/strategy/responsive-style-queries.md",
  "docs/strategy/agent-verification-inventory.md",
  "docs/strategy/agent-verification-progress.md",
  "docs/strategy/particle-effects-research.md",
  "docs/testing/dependency-freshness.md",
  "docs/testing/dependency-inventory.md",
  "docs/testing/scenario-gallery.md",
  "docs/testing/test-tooling-opportunities.md",
  "docs/testing/trust-gate.md",
  ...publicSiteMarkdownPaths,
];
const linkCheckedPaths = [
  ...currentMarkdownPaths,
  "docs/migrations/default-pointer-participation.md",
  "docs/migrations/filter-factory-values.md",
  "docs/migrations/jsx-authoring-pivot.md",
];
const migrationMarkdownPaths = new Set([
  "docs/migrations/animated-value-hook.md",
  "docs/migrations/default-pointer-participation.md",
  "docs/migrations/filter-factory-values.md",
  "docs/migrations/jsx-authoring-pivot.md",
]);
const operationalMarkdownPaths = new Set([
  "docs/alpha-publishing.md",
  "docs/testing/field-notes/visibility-transition-integration.md",
  ...trackedRepositoryFiles([
    "docs/website-rebuild/*.md",
    // Private brand handoffs and verification are operational assets, never public docs.
    "output/brand/**/*.md",
    "games/kube-inferno/*.md",
    "games/brick-climb/assets/*.md",
  ]),
  "tooling/fancy-transition-wasm/README.md",
  "tooling/transition-wasm-spike/README.md",
  // Active execution records are not historical shipped contracts.
  "docs/project-plans/004-html-box.md",
  "docs/project-plans/006-kube-inferno.md",
  "docs/superpowers/specs/2026-10-02-html-host-design.md",
  "docs/superpowers/plans/2026-10-02-html-box-implementation.md",
  "docs/testing/field-notes/html-box.md",
  "tooling/texture-wasm-spike/README.md",
  ".beads/README.md",
  "packages/text/test/fixtures/source-serif/LICENSE.md",
  "docs/superpowers/plans/2026-09-15-first-class-physics-3d-implementation.md",
  "tooling/studio-docs/fixtures/invalid-script.md",
  "tooling/studio-docs/fixtures/valid-guide.md",
]);
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
  /^docs\/testing\/runtime-performance-audit\//u,
  /^\.superpowers\/sdd\//u,
  /^docs\/design\/tfc-01-characterization-baseline\.md$/u,
  /^docs\/project-plans\/\d{3}-/u,
  /^docs\/project-plans\/(?:remaining-viz-roadmap|viz-.*)\.md$/u,
  /^docs\/testing\/evidence\/component-manipulation\/progress\.md$/u,
  /^docs\/superpowers\/(?:plans|specs)\//u,
  /^docs\/testing\/dep-\d+-upgrade-notes\.md$/u,
  /^docs\/testing\/field-notes\//u,
  /^docs\/testing\/pre-upgrade-baseline\.md$/u,
  /^docs\/strategy\/agent-verification-evidence\/public-inspection-pilot-\d{4}-\d{2}-\d{2}\/README\.md$/u,
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

function apiSymbolsFromFrontmatter(source, filename) {
  const match = source.match(/^symbols:\s*\[([^\]]*)\]\s*$/mu);
  assert.ok(match, `${filename} is missing a symbols frontmatter list`);
  return new Set(
    match[1]
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0),
  );
}

function assertDocumentedTokenNames(source, names, label) {
  for (const name of names) {
    assert.ok(source.includes("`" + name + "`"), `${label} is missing ${name}`);
  }
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
    // Studio routes are validated against the public documentation manifest;
    // they are not repository-local heading anchors.
    if (target.startsWith("#/")) continue;
    target = target.split(/\s+["']/u, 1)[0];
    const hashIndex = target.indexOf("#");
    const encodedFile = hashIndex < 0 ? target : target.slice(0, hashIndex);
    const encodedAnchor = hashIndex < 0 ? "" : target.slice(hashIndex + 1);
    const decodedFile = encodedFile ? decodeURIComponent(encodedFile) : "";
    const localPath = encodedFile
      ? decodedFile.startsWith("/")
        ? resolvePublicAssetPath(decodedFile)
        : resolve(repositoryRoot, dirname(path), decodedFile)
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

function resolvePublicAssetPath(decodedFile) {
  if (/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/$/.test(decodedFile)) {
    const page = resolve(
      repositoryRoot,
      "docs/site/website",
      `${decodedFile.slice(1, -1)}.mdx`,
    );
    if (existsSync(page)) return page;
  }
  const publicAssetRoot = resolve(repositoryRoot, "playground/public");
  const localPath = resolve(
    publicAssetRoot,
    `.${decodedFile.replaceAll("\\", "/")}`,
  );
  const relativePath = relative(publicAssetRoot, localPath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error(
      `Root-relative public asset ${JSON.stringify(decodedFile)} must remain under playground/public.`,
    );
  }
  return localPath;
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
  for (const [path, source] of sources) {
    for (const marker of source.matchAll(
      /<!-- docs:complete-snippet:start ([a-z0-9-]+) -->\n([\s\S]*?)<!-- docs:complete-snippet:end -->/gu,
    )) {
      const id = marker[1];
      const fences = [
        ...marker[2].matchAll(/^```(ts|tsx|js|jsx)\n([\s\S]*?)^```$/gmu),
      ];
      assert.ok(
        fences.length > 0,
        `Complete snippet ${id} in ${path} must contain a TypeScript or JavaScript fence`,
      );
      assert.ok(!snippets.has(id), `Duplicate complete snippet marker ${id}`);
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
    const fencesById = new Map();
    for (const match of source.matchAll(
      /^```(ts|tsx|js|jsx)(?:\s+docs:complete-snippet=([a-z0-9-]+))?\n([\s\S]*?)^```$/gmu,
    )) {
      const id = match[2];
      if (id === undefined) continue;
      const fences = fencesById.get(id) ?? [];
      fences.push(match);
      fencesById.set(id, fences);
    }
    for (const [id, fences] of fencesById) {
      assert.ok(!snippets.has(id), `Duplicate complete snippet marker ${id}`);
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
        source: fences.map((fence) => fence[3]).join("\n"),
      });
    }
  }
  return snippets;
}

function extractApiSnippets(sources) {
  const snippets = new Map();
  for (const [path, source] of sources) {
    if (!path.startsWith("docs/site/api/")) continue;
    const fences = [...source.matchAll(/^```(ts|tsx)\n([\s\S]*?)^```$/gmu)];
    const groups =
      fences.length > 1 &&
      fences.every((match) => /export default/.test(match[2]))
        ? fences.map((fence) => [fence])
        : [fences];
    for (const [index, group] of groups.entries()) {
      if (!group.length) continue;
      const id = `api-snippet-${path.replaceAll(/[^a-z0-9]+/giu, "-")}-${index}`;
      snippets.set(id, {
        id,
        path,
        language: group.some((match) => match[1] === "tsx") ? "tsx" : "ts",
        source: appendPibblComponentChecks(
          group.map((match) => match[2]).join("\n"),
        ),
      });
    }
    assertNoBareApiPseudoLinks(path, source);
  }
  return snippets;
}

function appendPibblComponentChecks(source) {
  const componentNames = new Set(
    [
      ...source.matchAll(
        /^function ([A-Z][A-Za-z0-9_]*)\s*(?:<[^>]+>)?\s*\(/gmu,
      ),
    ].map((match) => match[1]),
  );
  if (componentNames.size === 0) return source;
  return `${source}\n${[...componentNames]
    .sort()
    .map(
      (name) =>
        `const __pibblComponentCheck_${name}: import("@pibbl/core").PibblComponent<any> = ${name};`,
    )
    .join("\n")}\n`;
}

function assertNoBareApiPseudoLinks(path, source) {
  const prose = source
    .replace(/^---\n[\s\S]*?^---\n/mu, "")
    .replace(/^```[\s\S]*?^```$/gmu, "");
  const referenceLabels = new Set(
    [...prose.matchAll(/^\s{0,3}\[([^\]\n]+)\]:\s+\S.*$/gmu)].map((match) =>
      normalizeReferenceLabel(match[1]),
    ),
  );
  const markdown = stripInlineCode(prose).replace(
    /^\s{0,3}\[[^\]\n]+\]:\s+\S.*$/gmu,
    "",
  );
  for (const match of markdown.matchAll(
    /(^|[^!\\])\[([^\]\n]+)\](?![\t ]*(?:\(|\[))/gmu,
  )) {
    if (referenceLabels.has(normalizeReferenceLabel(match[2]))) continue;
    // Numeric intervals are ordinary mathematical prose, not broken links.
    if (
      /^\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*,\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*$/u.test(
        match[2],
      )
    )
      continue;
    throw new Error(
      `${path} contains a bare bracket-only pseudo-link. Use a canonical Markdown link.`,
    );
  }
}

function normalizeReferenceLabel(label) {
  return label.trim().replace(/\s+/gu, " ").toLowerCase();
}

function stripInlineCode(source) {
  return source.replace(/(`+)[\s\S]*?\1/gu, "");
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
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "pibbl-docs-check-"));
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
            jsxImportSource: "@pibbl/core",
            lib: ["ESNext", "DOM"],
            module: "ESNext",
            moduleDetection: "force",
            moduleResolution: "Bundler",
            noEmit: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            paths: Object.fromEntries(
              Object.entries(
                JSON.parse(
                  await readFile(join(repositoryRoot, "tsconfig.json"), "utf8"),
                ).compilerOptions.paths,
              ).map(([name, paths]) => [
                name,
                paths.map((path) => resolve(repositoryRoot, path)),
              ]),
            ),
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
      statement.source.value !== "@pibbl/core"
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
    ["hook lifecycle", /useSignal\(/u],
    ["root mounting", /\bpibbl\(canvas,/u],
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
      node.id?.type !== "Identifier" ||
      callName(node.init) !== "useSignal"
    ) {
      return;
    }
    const valueName = identifierName(node.id);
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
    if (callName(node) === "useReaction") hasLifecycle = true;
    if (callName(node) === "pibbl") hasMount = true;
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
  assert.equal(entry[1]?.importSource, "@pibbl/core");
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
    /from "@pibbl\/core\/jsx-runtime"/u,
    "Babel did not select the documented Pibbl automatic runtime",
  );
  assert.doesNotMatch(
    babelResult.code,
    /react(?:\/jsx-runtime)?/u,
    "Babel emitted a React dependency for Pibbl JSX",
  );

  const esbuildResult = await transform(source, {
    format: "esm",
    jsx: "automatic",
    jsxImportSource: "@pibbl/core",
    loader: "jsx",
    sourcefile: "documented-runtime.jsx",
  });
  assert.match(
    esbuildResult.code,
    /from "@pibbl\/core\/jsx-runtime"/u,
    "esbuild did not select the documented Pibbl automatic runtime",
  );
}

const discoveredGuides = await readdir(join(repositoryRoot, "docs/guides"))
  .then((entries) => entries.filter((name) => extname(name) === ".md").sort())
  .catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
assert.deepEqual(
  discoveredGuides,
  [],
  "Migrated public guides must have one canonical source under docs/site/learn/guides.",
);

const currentSources = new Map();
let parsedSnippetCount = 0;
await assert.doesNotReject(
  () =>
    assertLocalLinks(
      "docs/site/learn/tutorials/diagram-editor/index.md",
      "[finished editor](/tutorials/diagram-editor/finished-editor.png)",
    ),
  "Studio-served root-relative public assets must resolve from playground/public.",
);
await assert.rejects(
  () =>
    assertLocalLinks(
      "docs/site/learn/tutorials/diagram-editor/index.md",
      "[outside public assets](/../../package.json)",
    ),
  /must remain under playground\/public/u,
  "Studio-served root-relative public assets must reject traversal outside playground/public.",
);
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
const repositoryMarkdownPaths = markdownListing.stdout
  .trim()
  .split("\n")
  .filter((path) => existsSync(join(repositoryRoot, path)));
const currentMarkdownSet = new Set(currentMarkdownPaths);
const historicalMarkdownPaths = repositoryMarkdownPaths.filter(
  (path) =>
    !operationalMarkdownPaths.has(path) &&
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

const historicalSources = new Map(
  await Promise.all(
    historicalMarkdownPaths.map(async (path) => [
      path,
      await readFile(join(repositoryRoot, path), "utf8"),
    ]),
  ),
);

export function assertHistoricalBanners() {
  for (const [path, source] of historicalSources) {
    assertHistoricalBanner(path, source);
  }
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
  if (
    path.startsWith("docs/site/") &&
    path !== "docs/site/learn/guides/package-migration.md"
  ) {
    assert.doesNotMatch(
      source,
      /@pibbl\/(?:viz|particles|physics|textures|types|webgl)(?=[/`'"\s.,;:)]|$)/u,
      `${path} recommends a retired package; use current package entries`,
    );
  }
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
    /Pibbl(?:'s)? mouse-only contract/giu,
    `${path} claims Pibbl has only a mouse contract`,
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

const apiDocumentationSources = publicSiteMarkdownPaths
  .filter((path) => path.startsWith("docs/site/api/"))
  .map((path) => [path, currentSources.get(path)]);
const documentedApiSymbols = new Set(
  apiDocumentationSources.flatMap(([path, source]) => [
    ...apiSymbolsFromFrontmatter(source, path),
  ]),
);
const apiOverview = currentSources.get("docs/site/api/index.md");
const canvasRuntimeTypes = currentSources.get(
  "docs/site/api/types/canvas-runtime.md",
);
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
const threeSource = await readFile(
  join(repositoryRoot, "packages/three/src/index.ts"),
  "utf8",
);
const particlesSource = await readFile(
  join(repositoryRoot, "packages/core/src/features/particles/index.ts"),
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
const threeExports = exportedSpecifiers(
  threeSource,
  "packages/three/src/index.ts",
);
const particleExports = exportedSpecifiers(
  particlesSource,
  "packages/core/src/features/particles/index.ts",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) => rootExports.values.has(name)),
  rootExports.values,
  "Documented root runtime values",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) => rootExports.types.has(name)),
  rootExports.types,
  "Documented root types",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) => runtimeExports.values.has(name)),
  runtimeExports.values,
  "Documented jsx-runtime values",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) =>
    devRuntimeExports.values.has(name),
  ),
  devRuntimeExports.values,
  "Documented jsx-dev-runtime values",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) => threeExports.values.has(name)),
  threeExports.values,
  "Documented @pibbl/three runtime values",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) => threeExports.types.has(name)),
  threeExports.types,
  "Documented @pibbl/three types",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) => particleExports.values.has(name)),
  particleExports.values,
  "Documented @pibbl/core/particles runtime values",
);
assertSameNames(
  [...documentedApiSymbols].filter((name) => particleExports.types.has(name)),
  particleExports.types,
  "Documented @pibbl/core/particles types",
);
const vizSource = await readFile(
  join(repositoryRoot, "packages/core/src/features/viz/index.ts"),
  "utf8",
);
const vizExports = exportedSpecifiers(
  vizSource,
  "packages/core/src/features/viz/index.ts",
);
for (const kind of ["values", "types"])
  assertSameNames(
    [...documentedApiSymbols].filter((name) => vizExports[kind].has(name)),
    vizExports[kind],
    `Documented @pibbl/core/viz ${kind}`,
  );
const filterSource = await readFile(
  join(repositoryRoot, "packages/core/src/filters.ts"),
  "utf8",
);
const filterExports = exportedSpecifiers(
  filterSource,
  "packages/core/src/filters.ts",
);
for (const kind of ["values", "types"])
  assertSameNames(
    [...documentedApiSymbols].filter((name) => filterExports[kind].has(name)),
    filterExports[kind],
    `Documented @pibbl/core/filters ${kind}`,
  );
const textureSource = await readFile(
  join(repositoryRoot, "packages/core/src/features/textures/index.ts"),
  "utf8",
);
const textureExports = exportedSpecifiers(
  textureSource,
  "packages/core/src/features/textures/index.ts",
);
for (const kind of ["values", "types"])
  assertSameNames(
    [...documentedApiSymbols].filter((name) => textureExports[kind].has(name)),
    textureExports[kind],
    `Documented @pibbl/core/textures ${kind}`,
  );
const namespaceMembers = jsxNamespaceMembers(
  runtimeSource,
  "packages/core/src/jsx-runtime.ts",
);
assertDocumentedTokenNames(
  apiOverview,
  namespaceMembers,
  "Documented JSX namespace types",
);
assertSameNames(
  jsxNamespaceMembers(devRuntimeSource, "packages/core/src/jsx-dev-runtime.ts"),
  namespaceMembers,
  "Development JSX namespace types",
);

const coreManifest = JSON.parse(
  await readFile(join(repositoryRoot, "packages/core/package.json"), "utf8"),
);
for (const entry of [
  ".",
  "./internal",
  "./jsx-runtime",
  "./jsx-dev-runtime",
  "./types",
]) {
  assert.ok(
    coreManifest.exports[entry],
    `@pibbl/core package exports is missing ${entry}`,
  );
}
for (const dependencies of [
  coreManifest.dependencies,
  coreManifest.devDependencies,
  coreManifest.peerDependencies,
]) {
  assert.ok(!dependencies?.react, "@pibbl/core must not depend on React.");
}
assert.match(coreManifest.description, /JSX.*createElement/u);
const threeManifest = JSON.parse(
  await readFile(join(repositoryRoot, "packages/three/package.json"), "utf8"),
);
assert.deepEqual(
  Object.keys(threeManifest.exports),
  [".", "./package.json"],
  "@pibbl/three must expose only its adapter root and manifest entries.",
);
assert.deepEqual(
  threeManifest.peerDependencies,
  { "@pibbl/core": coreManifest.version, three: "^0.186.0" },
  "@pibbl/three must peer on the matching @pibbl/core release and application's Three.js.",
);
assert.equal(
  threeManifest.dependencies,
  undefined,
  "@pibbl/three must not ship a second renderer dependency graph.",
);
assert.equal(threeManifest.sideEffects, false);
for (const dependencies of [
  threeManifest.dependencies,
  threeManifest.devDependencies,
  threeManifest.peerDependencies,
]) {
  assert.ok(!dependencies?.react, "@pibbl/three must not depend on React.");
  assert.ok(
    !dependencies?.["@pibbl/types"],
    "@pibbl/three must not depend on @pibbl/types.",
  );
}
for (const entry of [
  "particles",
  "viz",
  "textures",
  "physics/2d",
  "physics/2d/geometry",
  "physics/2d/testing",
]) {
  assert.ok(
    coreManifest.exports[`./${entry}`],
    `Missing consolidated entry ${entry}`,
  );
}
assert.equal(coreManifest.sideEffects, false);
assert.equal(
  Object.keys(coreManifest.dependencies ?? {}).length,
  0,
  "Core must have no consumer runtime dependencies.",
);
assert.ok(
  coreManifest.devDependencies["@dimforge/rapier2d-compat"],
  "Rapier is a private build dependency.",
);
// Dated migration certification is a separate audit, not a current-behavior gate.
const auditHistoricalPreservation = process.argv.includes(
  "--historical-preservation",
);
const trustWorkflow = await readFile(
  join(repositoryRoot, ".github/workflows/trust.yml"),
  "utf8",
);
const rootManifest = JSON.parse(
  await readFile(join(repositoryRoot, "package.json"), "utf8"),
);
assert.match(
  trustWorkflow,
  /run: pnpm run trust:\$\{\{ matrix.stage \}\}/u,
  "CI must dispatch the canonical trust stages; parity is verified by trust-workflow.test.mjs.",
);
assertWorkflowCommandOrder(
  rootManifest.scripts["trust:static"],
  [
    " docs:check",
    " studio-docs:check",
    " test:studio-docs:production-boundary",
    " typecheck",
  ],
  "Static documentation and type checks",
);
assertWorkflowCommandOrder(
  rootManifest.scripts["trust:browser"],
  [
    " test:ci",
    " test:studio-docs",
    " test:visual-safeguard",
    " test:smoke:built",
  ],
  "Browser, documentation, and visual checks",
);
assert.equal(
  rootManifest.scripts["test:studio-docs"],
  "node tooling/test-studio-docs.mjs",
  "test:studio-docs must use the isolated acceptance-output runner.",
);
assert.equal(
  rootManifest.scripts["test:studio-docs:production-boundary"],
  "VITE_PIBBL_STUDIO_ACCEPTANCE_SEARCH_FAIL_ONCE=1 corepack pnpm@11.21.0 playground:build && node tooling/verify-studio-production-output.mjs",
  "The production boundary regression must build ordinary output with a hostile stale VITE value.",
);
assert.match(
  rootManifest.scripts["trust:static"],
  /\bstudio-docs:check\b/u,
  "The local static trust command must include studio-docs:check.",
);
assert.match(
  rootManifest.scripts["trust:browser"],
  /\btest:studio-docs\b[\s\S]*\btest:visual-safeguard\b/u,
  "The local browser trust command must retain Studio acceptance and portable visual safeguards.",
);
assert.equal(
  rootManifest.scripts["audit:studio-visual"],
  "corepack pnpm@11.21.0 test:studio-visual",
  "Platform-sensitive Studio snapshots must remain available as an explicit visual audit.",
);
assert.match(
  rootManifest.scripts["test:studio-visual"],
  /\bplayground:build\b/u,
  "test:studio-visual must audit an explicit normal-production build.",
);
const studioDocsRunner = await readFile(
  join(repositoryRoot, "tooling/test-studio-docs.mjs"),
  "utf8",
);
assert.match(
  studioDocsRunner,
  /\.studio-docs-acceptance-dist/u,
  "Studio acceptance must use its explicit isolated output directory.",
);
assert.match(
  studioDocsRunner,
  /assertNormalOutputUnchanged/u,
  "Studio acceptance must preserve the normal production output.",
);
assert.match(
  studioDocsRunner,
  /finally[\s\S]*rm\(acceptanceOutput/u,
  "Studio acceptance must clean its exact output directory on success and failure.",
);
assert.doesNotMatch(
  studioDocsRunner,
  /VITE_PIBBL_STUDIO_ACCEPTANCE_SEARCH_FAIL_ONCE/u,
  "Studio acceptance must derive retry behavior from its build mode, not an ambient VITE value.",
);
const studioMain = await readFile(
  join(repositoryRoot, "playground/src/main.ts"),
  "utf8",
);
assert.match(
  studioMain,
  /__PIBBL_STUDIO_DOCS_ACCEPTANCE__/u,
  "Studio retry composition must use the private mode-defined constant.",
);
assert.doesNotMatch(
  studioMain,
  /import\.meta\.env\.(?!VITE_PIBBL_WEBSITE_URL\b)|VITE_PIBBL_STUDIO_ACCEPTANCE_SEARCH_FAIL_ONCE/u,
  "Studio retry composition must not read ambient VITE values; the website destination is configurable.",
);
assert.match(
  studioMain,
  /import\.meta\.env\.VITE_PIBBL_WEBSITE_URL/u,
  "Studio documentation redirects must have an explicit website URL setting.",
);
const studioViteConfig = await readFile(
  join(repositoryRoot, "playground/vite.config.ts"),
  "utf8",
);
assert.match(
  studioViteConfig,
  /define:[\s\S]*__PIBBL_STUDIO_DOCS_ACCEPTANCE__/u,
  "Vite must define the private retry flag from studio-docs-acceptance mode.",
);
const productionOutputVerifier = await readFile(
  join(repositoryRoot, "tooling/verify-studio-production-output.mjs"),
  "utf8",
);
for (const marker of [
  "pibblStudioSearchRetry",
  "Intentional verifier search loader failure.",
  "createAcceptanceSearchLoaderOptions",
]) {
  assert.match(
    productionOutputVerifier,
    new RegExp(marker.replaceAll(/[.]/gu, "\\."), "u"),
    `Production output verifier must reject ${marker}.`,
  );
}
const studioHtml = await readFile(
  join(repositoryRoot, "playground/index.html"),
  "utf8",
);
assert.match(studioHtml, /editable TSX/u);
assert.doesNotMatch(studioHtml, /editable TypeScript/u);

function assertWorkflowCommandOrder(source, commands, label) {
  let previous = -1;
  for (const command of commands) {
    const position = source.indexOf(command);
    assert.ok(position > previous, `${label} must run ${command} in order.`);
    previous = position;
  }
}

const configuring = currentSources.get(
  "docs/site/learn/guides/configure-jsx.md",
);
for (const marker of [
  "@pibbl/core/jsx-runtime",
  "@pibbl/core/jsx-dev-runtime",
  "## Vite and esbuild",
  "--jsx=automatic",
  "## Babel automatic runtime",
  'runtime: "automatic"',
  'importSource: "@pibbl/core"',
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
    "docs/site/learn/guides/components-props-and-children.md",
    ["finite synchronous iterables", "Numeric zero", "## Fragments and keys"],
  ],
  [
    "docs/site/learn/guides/components-props-and-children.md",
    ["ordinary synchronous"],
  ],
  ["docs/site/learn/guides/style-and-draw.md", ["## Local, closed style"]],
  ["docs/site/learn/guides/compose-and-layout.md", ["useLayoutBox()"]],
  [
    "docs/site/learn/guides/custom-components-and-primitives.md",
    ["useCanvasContext()", "normalizeStyle", "resolveStyle", "measure"],
  ],
  [
    "docs/site/learn/guides/focus-and-keyboard.md",
    [
      "FocusManagement",
      "KeyboardNavigation",
      "## Accessibility responsibility",
    ],
  ],
  [
    "docs/site/learn/guides/compose-and-layout.md",
    ["## Group", "## Clip", "## Layer", "specified author value"],
  ],
  [
    "docs/site/learn/guides/react-integration.md",
    ["one JSX runtime", "createPibblElement", "expression-level pragma"],
  ],
  [
    "docs/site/learn/guides/signals-and-animation.md",
    [
      "## Pass signals to their receivers",
      "## Event-triggered playback",
      "## One frame transaction",
      "Pibbl never automatically promotes components",
    ],
  ],
  [
    "docs/site/learn/guides/state-and-lifecycle.md",
    [
      "immediate Canvas runtime",
      "useReaction",
      "## Identity, failure, and disposal",
    ],
  ],
  [
    "docs/site/learn/guides/author-without-jsx.md",
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
    "docs/design/animation-contract.md",
    [
      "There is no free `play(program)` function",
      "The frozen `easing` object contains",
      "before a competing run is cancelled and before any writer lease\nsurvives",
      "512th occurrence is allowed; work that would enter the 513th fails",
      "one shared 512-descent\nconstruction budget",
      "The handoff is provisional until Commit",
      "Candidate program/options validation occurs synchronously during Render",
      "On an idle, cancelled, or finished handle it creates a paused\nrun; on an active running or paused run it preserves that status, and a running\nseek schedules continued advancement.",
      "Capture one logical time/frame identity and drain accepted commands",
      "Sample registered playbacks in registration order",
      "Validate and publish every playback's stages",
      "Validate computed dependencies and collect the exact dirty",
      "Repaint planned Layer and render-layer children before ancestors",
      "a dirty external render layer updates, renders, and settles interaction before ancestor Canvas composition",
      "Finalize successful transactions, release ended runs/leases",
      "accept them\ndirectly at declared inputs",
      "Pibbl never automatically promotes\na stable component",
      "External render layers and the official `@pibbl/three` adapter use this same",
      "Pibbl exposes no public scheduler clock, frame-step API,\ntrace history",
      "Worker or WASM number crunching may use packed buffers only if Begin",
    ],
  ],
  [
    "docs/design/runtime-resource-ownership.md",
    [
      "| Playback command/Advance registration",
      "| Playback milestone/error delivery",
      "| Output writer leases",
      "| Evaluator/stepper activation state",
    ],
  ],
  [
    "docs/design/signals-and-scheduling-contract.md",
    [
      "declared reactive input positions",
      "`set(value)` always treats `value` as data, including when `T` is a function",
      "When an observed computed first becomes pending, its Plan work requests and\ncoalesces the realm host frame",
      "Signal writes are forbidden during component traversal",
      "including writes that would be equality no-ops",
      "Direct `set()` and\n`update()` calls are also forbidden inside scheduler Advance participants",
      "Each frame has six ordered active phases",
      "Managed Layers are scheduler\ninstances, never separately registered top-level roots",
      "Errors are collected and thrown singly or as an aggregate only after Complete",
      "The friend entry is not a stable third-party API, is not re-exported by\n`@pibbl/core`, and is intentionally absent from the ordinary Studio declaration\nand runtime surface",
      "| Signal-to-component edge",
      "| Computed-to-source edge",
      "Exact component consumer",
    ],
  ],
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
      '`<Receiver> received duplicate Pibbl key "<key>" as a Pibbl child.`',
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

// Current normative inventory can grow after the dated pre-Task-14 snapshot.
// Keep new implemented contracts classified and precision-checked without
// fabricating provenance for files that did not exist at the snapshot commit.
const currentNormativeContractPaths = [
  "docs/architecture/style-and-layout-architecture.md",
  ...currentMarkdownPaths.filter(
    (path) =>
      path.startsWith("docs/design/") &&
      path !== "docs/design/tfc-01-characterization-baseline.md",
  ),
].sort();
const postBaselineNormativeContractPaths = new Set([
  "docs/design/html-box-contract.md",
  "docs/design/textures-contract.md",
  "docs/design/animation-contract.md",
  "docs/design/component-manipulation-contract.md",
  "docs/design/signals-and-scheduling-contract.md",
  "docs/design/physics-2d-contract.md",
  "docs/design/render-layer-and-three-contract.md",
  "docs/design/text-geometry-contract.md",
]);
// This shipped contract predates this migration but was never registered in the
// approved-design mapping manifest. Preserve its exact committed bytes; do not
// invent an approval record or silently exclude it from the normative inventory.
// Snapshot source: 1d1a2ec49f6bca52be99abf24bd34e1b3cb3f16e:docs/design/weighted-electric-sources-contract.md
const shippedContractSnapshots = new Map([
  [
    "docs/design/weighted-electric-sources-contract.md",
    "920fc18c95a64afcb38d2f1ac97cceaa7c88a02f871687a3a4aaff38f8b1e484",
  ],
]);
export function assertShippedContractSnapshots(sources) {
  for (const [path, digest] of shippedContractSnapshots) {
    assert.equal(
      typeof sources.get(path),
      "string",
      `Missing shipped contract ${path}`,
    );
    assert.equal(
      sha256(sources.get(path)),
      digest,
      `Shipped contract changed without a reviewed preservation mapping: ${path}`,
    );
  }
}
if (auditHistoricalPreservation) assertShippedContractSnapshots(currentSources);
else
  for (const path of shippedContractSnapshots.keys())
    assert.ok(currentSources.has(path), `Missing shipped contract ${path}`);
const baselineSnapshotContractPaths = currentNormativeContractPaths.filter(
  (path) =>
    !postBaselineNormativeContractPaths.has(path) &&
    !shippedContractSnapshots.has(path),
);

export function assertCurrentNormativeContractInventory(paths) {
  assert.deepEqual(
    [...paths].sort(),
    currentNormativeContractPaths,
    "Current normative contract inventory must include every implemented contract exactly once",
  );
}

assertCurrentNormativeContractInventory(currentNormativeContractPaths);
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

const approvalRecordsById = new Map(
  contractPreservationBaseline.approvalRecords.map((record) => [
    record.id,
    {
      ...record,
      units: extractContractUnits(
        approvalRecordSources.get(record.path),
        record.unitPrefix,
      ),
    },
  ]),
);
assert.deepEqual(
  contractPreservationBaseline.postBaselineContracts.map(({ path }) => path),
  [...postBaselineNormativeContractPaths],
  "Post-baseline preservation inventory must cover each current contract outside the dated snapshot",
);
const postBaselineContractRecordsByPath = new Map(
  contractPreservationBaseline.postBaselineContracts.map((record) => [
    record.path,
    record,
  ]),
);
const postBaselineSignalContractRecord = postBaselineContractRecordsByPath.get(
  "docs/design/signals-and-scheduling-contract.md",
);
const postBaselineAnimationContractRecord =
  postBaselineContractRecordsByPath.get("docs/design/animation-contract.md");
const postBaselineThreeContractRecord = postBaselineContractRecordsByPath.get(
  "docs/design/render-layer-and-three-contract.md",
);

export function assertThreePivotPostBaselineApprovals({
  animationRecord,
  signalRecord,
}) {
  const animationMappings = new Map(
    animationRecord.mappings.map((mapping) => [mapping.id, mapping]),
  );
  const signalMappings = new Map(
    signalRecord.mappings.map((mapping) => [mapping.id, mapping]),
  );
  assert.deepEqual(
    animationMappings.get("scheduler-render-webgl-lifecycle")
      ?.supplementalApprovals,
    [{ recordId: "three-full-pivot", unitIds: ["p0005", "p0028"] }],
    "Animation Render lifecycle unit m0042 must retain exact render-layer pivot approval",
  );
  assert.deepEqual(
    animationMappings.get("webgl-animation-scene-lifecycle")
      ?.supplementalApprovals,
    [{ recordId: "three-full-pivot", unitIds: ["p0005", "p0026", "p0028"] }],
    "Animation external-layer lifecycle unit m0051 must retain exact pivot approval",
  );
  assert.deepEqual(
    signalMappings.get("realm-render-webgl-lifecycle")?.supplementalApprovals,
    [{ recordId: "three-full-pivot", unitIds: ["p0005", "p0028"] }],
    "Scheduler Render lifecycle unit s0023 must retain exact render-layer pivot approval",
  );
}

assertThreePivotPostBaselineApprovals({
  animationRecord: postBaselineAnimationContractRecord,
  signalRecord: postBaselineSignalContractRecord,
});

export function assertThreePivotDrawingApprovals(manifest) {
  const additionsById = new Map(
    manifest.additions.map((addition) => [addition.id, addition]),
  );
  const pivot = additionsById.get("three-pivot-drawing-components-contract");
  assert.deepEqual(
    pivot?.currentIds,
    ["c0045", "c0046", "c0047", "c0054", "c0063", "c0066", "c0075"],
    "Drawing contract must isolate the approved render-layer, Three, and pure-geometry clauses",
  );
  assert.deepEqual(
    pivot?.approval,
    {
      recordId: "three-full-pivot",
      unitIds: ["p0003", "p0005", "p0006", "p0008", "p0024", "p0029", "p0030"],
    },
    "Drawing contract must retain exact Three-pivot design approval",
  );
}

assertThreePivotDrawingApprovals(contractPreservationBaseline);
const postBaselineContractResults = (
  auditHistoricalPreservation
    ? contractPreservationBaseline.postBaselineContracts
    : []
).map((record) =>
  assertPostBaselineContractPreservation({
    record,
    currentSource: currentSources.get(record.path),
    approvalRecordsById,
  }),
);
const postBaselineUnitCount = postBaselineContractResults.reduce(
  (total, result) => total + result.currentUnitCount,
  0,
);

export function assertTask9EvidenceMappings(manifest) {
  const byId = new Map(
    manifest.evidenceMappings.map((mapping) => [mapping.id, mapping]),
  );
  const statePrecedence = byId.get("pending-root-precedence");
  assert.equal(
    statePrecedence?.claim.text,
    "A state request cannot erase it.",
    "State pending-root precedence must retain its own exact claim",
  );
  assert.equal(
    statePrecedence?.test.marker,
    "does not lose a pending root replacement to a component-owned signal update",
    "State pending-root precedence must retain component-owned signal evidence",
  );
  const signalPrecedence = byId.get("pending-root-precedence-signal");
  assert.equal(
    signalPrecedence?.test.marker,
    "does not lose a pending root replacement to a signal request",
    "Signal pending-root precedence requires signal-specific executable evidence",
  );
  assert.deepEqual(
    signalPrecedence?.relevance.sharedAnchors,
    ["request", "signal"],
    "Signal pending-root precedence must retain signal relevance",
  );
  const retainedHookSignal = byId.get("retained-hook-signal");
  assert.equal(
    retainedHookSignal?.test.marker,
    "keeps a retained hook signal usable but inert after owner removal",
    "Retained hook-signal evidence must cover owner removal",
  );
  assert.ok(
    retainedHookSignal?.relevance.sharedAnchors.includes("signal"),
    "Retained hook-signal evidence must retain signal relevance",
  );
}

export function assertMixedLegacyTask9Preservation(manifest) {
  const translationsById = new Map(
    manifest.translations.map((mapping) => [mapping.id, mapping]),
  );
  const additionsById = new Map(
    manifest.additions.map((mapping) => [mapping.id, mapping]),
  );
  const publicPackage = translationsById.get(
    "design-runtime-hooks-contract-md-public-package-boundary",
  );
  assert.deepEqual(
    publicPackage?.approval,
    {
      id: "a0105",
      kind: "prose",
      text: "TypeScript, Bundler, and NodeNext declarations must agree.",
    },
    "Public-package JSX translation must retain approved unit a0105",
  );
  assert.deepEqual(
    publicPackage?.currentIds,
    ["c0056"],
    "Public-package JSX translation must remain isolated from signal additions",
  );
  assert.deepEqual(
    publicPackage?.sharedAnchors,
    ["consumers", "entries", "nodenext"],
    "Public-package JSX translation must retain its distinctive relevance anchors",
  );
  const deterministicEvidence = translationsById.get(
    "design-runtime-hooks-contract-md-deterministic-evidence",
  );
  assert.deepEqual(
    deterministicEvidence?.approval,
    {
      recordId: "signals-centric-authoring",
      unitIds: ["c0447", "c0448", "c0503", "c0504", "c0506", "c0522"],
    },
    "Deterministic-evidence translation must retain exact Signals-centric approval",
  );
  assert.deepEqual(
    deterministicEvidence?.currentIds,
    ["c0059"],
    "Deterministic-evidence JSX translation must remain isolated from signal additions",
  );
  assert.deepEqual(
    deterministicEvidence?.sharedAnchors,
    ["tests"],
    "Deterministic-evidence JSX translation must retain its distinctive relevance anchors",
  );

  const publicSignalAddition = additionsById.get(
    "design-runtime-hooks-contract-public-signal-package-addition",
  );
  assert.deepEqual(
    publicSignalAddition?.approval,
    {
      recordId: "signals-centric-authoring",
      unitIds: ["c0092", "c0551", "c0552"],
    },
    "Public signal package unit must retain bounded Signals-centric approval",
  );
  assert.deepEqual(
    publicSignalAddition?.currentIds,
    ["c0058"],
    "Public signal package proof must remain a separate semantic addition",
  );
  const signalEvidenceAddition = additionsById.get(
    "design-runtime-hooks-contract-signal-evidence-addition",
  );
  assert.deepEqual(
    signalEvidenceAddition?.approval,
    {
      recordId: "first-class-signals-and-scheduler",
      unitIds: ["g0064", "g0136", "g0153", "g0165", "g0188"],
    },
    "Signal evidence unit must retain bounded signal-design approval",
  );
  assert.deepEqual(
    signalEvidenceAddition?.currentIds,
    ["c0061"],
    "Signal evidence proof must remain a separate semantic addition",
  );
}

assertTask9EvidenceMappings(contractPreservationBaseline);
assertMixedLegacyTask9Preservation(contractPreservationBaseline);
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
  trackedRepositoryFiles([
    "packages/core/src",
    "packages/core/test",
    "packages/core/src/features/physics",
    "packages/core/test/features/physics",
    "packages/three/src",
    "packages/three/test",
  ]),
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

const provenanceRequirement = process.env.PIBBL_VERIFY_CONTRACT_PROVENANCE;
assert.ok(
  provenanceRequirement === undefined ||
    provenanceRequirement === "0" ||
    provenanceRequirement === "1",
  "PIBBL_VERIFY_CONTRACT_PROVENANCE must be 0, 1, or unset.",
);
const baselineObject = spawnSync(
  "git",
  ["cat-file", "-e", `${CONTRACT_BASELINE_COMMIT}^{commit}`],
  { cwd: repositoryRoot, encoding: "utf8" },
);
const baselineHistoryAvailable = baselineObject.status === 0;
if (
  auditHistoricalPreservation &&
  provenanceRequirement === "1" &&
  !baselineHistoryAvailable
) {
  assert.fail(
    `Contract provenance was required, but Git commit ${CONTRACT_BASELINE_COMMIT} ` +
      "is unavailable. Fetch full history (for example, checkout with fetch-depth: 0) " +
      "or run without PIBBL_VERIFY_CONTRACT_PROVENANCE=1 to validate the embedded, " +
      "digest-locked semantic baseline.",
  );
}
const verifyBaselineProvenance =
  auditHistoricalPreservation &&
  baselineHistoryAvailable &&
  provenanceRequirement !== "0";
const baselineContractSources = verifyBaselineProvenance
  ? new Map(
      baselineSnapshotContractPaths.map((path) => [
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
const contractPreservationResult = auditHistoricalPreservation
  ? assertContractPreservationBaseline({
      manifest: contractPreservationBaseline,
      expectedContractPaths: baselineSnapshotContractPaths,
      baselineSources: baselineContractSources,
      currentSources,
      translationRecordSource,
      translationRecordBaselineSource,
      approvalRecordSources,
      evidenceSources: contractEvidenceSources,
      trackedEvidencePaths: trackedContractEvidencePaths,
    })
  : undefined;

const readme = currentSources.get("README.md");
const advancedStart = readme.indexOf("## Learn Pibbl");
assert.ok(readme.indexOf("## Quick start") >= 0, "README needs a quick start.");
assert.ok(
  advancedStart > readme.indexOf("## Quick start"),
  "README quick start must precede advanced material.",
);
export function assertFixedConfigSignal(source) {
  assert.match(
    source,
    /fixed logical viewport with optional `fit`,\s*`pixelRatio`, and `signal`/u,
    "Canvas/runtime types must document signal for fixed PibblConfig as well as responsive PibblConfig",
  );
}
assertFixedConfigSignal(canvasRuntimeTypes);
assert.ok(
  readme.indexOf("docs/site/learn/guides/author-without-jsx.md") <
    advancedStart,
  "README must link the standalone non-JSX path before advanced material.",
);

const matrixRequirements = [
  {
    topic: /Complete interactive JSX quick start/u,
    guides: [
      "site/learn/guides/configure-jsx.md",
      "design/runtime-hooks-contract.md",
    ],
    evidence: ["getting-started.example.tsx"],
  },
  {
    topic: /TypeScript automatic runtime/u,
    guides: ["site/learn/guides/configure-jsx.md", "site/api/index.md"],
    evidence: ["package-consumer/jsx.tsx"],
  },
  {
    topic: /No React dependency/u,
    guides: [
      "site/learn/guides/configure-jsx.md",
      "site/learn/guides/react-integration.md",
    ],
    evidence: ["verify-packed-pivot.mjs"],
  },
  {
    topic: /Vite\/esbuild setup/u,
    guides: ["site/learn/guides/configure-jsx.md"],
    evidence: ["verify-docs.mjs"],
  },
  {
    topic: /Babel automatic runtime/u,
    guides: ["site/learn/guides/configure-jsx.md"],
    evidence: ["verify-docs.mjs"],
  },
  {
    topic: /Components, props, events/u,
    guides: [
      "site/learn/guides/style-and-draw.md",
      "design/style-system-contract.md",
    ],
    evidence: ["getting-started.example.tsx"],
  },
  {
    topic: /Arbitrary interpolation/u,
    guides: [
      "site/learn/guides/components-props-and-children.md",
      "design/runtime-hooks-contract.md",
    ],
    evidence: ["children.test.ts"],
  },
  {
    topic: /Fragments, lists/u,
    guides: ["site/learn/guides/components-props-and-children.md"],
    evidence: ["fragment.test.tsx"],
  },
  {
    topic: /Text children/u,
    guides: [
      "site/learn/guides/components-props-and-children.md",
      "design/drawing-components-contract.md",
    ],
    evidence: ["text.example.tsx", "learning-examples.test.ts"],
  },
  {
    topic: /Layout and specified style/u,
    guides: [
      "site/learn/guides/compose-and-layout.md",
      "design/layout-system-contract.md",
    ],
    evidence: ["flex.example.tsx"],
  },
  {
    topic: /`Group`, `Clip`/u,
    guides: [
      "site/learn/guides/compose-and-layout.md",
      "design/drawing-components-contract.md",
    ],
    evidence: ["group.example.tsx", "clip.example.tsx", "layer.example.tsx"],
  },
  {
    topic: /State, immediate lifecycle/u,
    guides: [
      "site/learn/guides/state-and-lifecycle.md",
      "design/runtime-hooks-contract.md",
    ],
    evidence: ["runtime-hooks.example.tsx"],
  },
  {
    topic: /Signals, direct inputs, computed graphs, reactions/u,
    guides: [
      "design/signals-and-scheduling-contract.md",
      "site/learn/guides/state-and-lifecycle.md",
      "site/api/types/signal-inputs.md",
    ],
    evidence: [
      "graph.test.ts",
      "resolve-primitive-inputs.test.tsx",
      "use-computed.test.tsx",
      "use-reaction.test.tsx",
      "realm-scheduler.test.ts",
    ],
  },
  {
    topic: /Definitions, programs, playback/u,
    guides: [
      "site/learn/guides/signals-and-animation.md",
      "design/animation-contract.md",
    ],
    evidence: [
      "animation-lab.test.ts",
      "animation-rendering.test.tsx",
      "final-public-vocabulary.tsx",
    ],
  },
  {
    topic: /Ordinary composite/u,
    guides: ["site/learn/guides/custom-components-and-primitives.md"],
    evidence: ["use-canvas-context.test.tsx"],
  },
  {
    topic: /Full `definePrimitive`/u,
    guides: [
      "site/learn/guides/custom-components-and-primitives.md",
      "design/style-system-contract.md",
    ],
    evidence: ["define-primitive.test.tsx"],
  },
  {
    topic: /Complete non-JSX API/u,
    guides: ["site/learn/guides/author-without-jsx.md"],
    evidence: [
      "create-element-authoring.example.tsx",
      "learning-examples.test.ts",
    ],
  },
  {
    topic: /One runtime per file/u,
    guides: [
      "site/learn/guides/react-integration.md",
      "site/learn/guides/configure-jsx.md",
    ],
    evidence: ["mixed-runtime/react-host.tsx"],
  },
  {
    topic: /Wrong-runtime diagnostics/u,
    guides: ["site/learn/guides/jsx-troubleshooting.md"],
    evidence: ["foreign-runtime-diagnostics.test.tsx"],
  },
  {
    topic: /Focus and directional keyboard/u,
    guides: [
      "site/learn/guides/focus-and-keyboard.md",
      "design/focus-and-keyboard-navigation-contract.md",
    ],
    evidence: ["directional-navigation.example.tsx"],
  },
  {
    topic: /Accessibility limitations/u,
    guides: [
      "design/canvas-accessibility-guidance.md",
      "site/learn/guides/focus-and-keyboard.md",
    ],
    evidence: ["focus-navigation.example.tsx"],
  },
  {
    topic: /Complete public values/u,
    guides: ["site/api/index.md", "site/api/types/canvas-runtime.md"],
    evidence: ["final-public-vocabulary.tsx"],
  },
  {
    topic: /One-time breaking migration/u,
    guides: ["migrations/jsx-authoring-pivot.md"],
    evidence: ["public-api.test.ts"],
  },
  {
    topic: /Deterministic Canvas particle effects/u,
    guides: [
      "site/learn/guides/particle-effects.md",
      "site/api/types/particles.md",
    ],
    evidence: ["particle-effects.example.tsx"],
  },
  {
    topic: /Signal-owned component move, resize, rotation/u,
    guides: [
      "site/learn/guides/manipulation.md",
      "design/component-manipulation-contract.md",
    ],
    evidence: ["manipulation.example.tsx", "manipulation-interaction.test.tsx"],
  },
  {
    topic: /Procedural textures/u,
    guides: [
      "site/learn/guides/procedural-textures.md",
      "design/textures-contract.md",
    ],
    evidence: ["material.test.tsx", "reaction-diffusion.test.tsx"],
  },
  {
    topic: /Generic external-renderer lifecycle/u,
    guides: [
      "site/api/functions/define-render-layer.md",
      "design/render-layer-and-three-contract.md",
      "design/runtime-resource-ownership.md",
    ],
    evidence: ["define-render-layer.test.tsx"],
  },
  {
    topic: /Direct Three.js scenes/u,
    guides: [
      "site/learn/guides/three-js.md",
      "site/api/functions/define-three-layer.md",
      "site/api/types/three.md",
    ],
    evidence: [
      "three-layer.example.tsx",
      "three-instancing.example.tsx",
      "define-three-layer.test.tsx",
    ],
  },
  {
    topic: /Canvas\/Three paint order/u,
    guides: [
      "site/learn/guides/three-js.md",
      "design/user-events-contract.md",
      "design/focus-and-keyboard-navigation-contract.md",
    ],
    evidence: ["three-layer.example.tsx", "three-instancing.example.tsx"],
  },
  {
    topic: /Default drawing participation migration/u,
    guides: ["migrations/default-pointer-participation.md"],
    evidence: ["public-pointer-events.test.ts"],
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
      /\]\([^)]*(?:guides|design|migrations|site\/api)[^)]*\.md(?:#[^)]*)?\)/u,
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
for (const guide of publicGuidePaths) {
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
const compiledApiSnippetCount = await typecheckCompleteSnippets(
  extractApiSnippets(currentSources),
);
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

  throws(
    () =>
      extractApiSnippets(
        new Map([
          [
            "docs/site/api/lowercase-pseudo-link.md",
            "# Fixture\n\n[lowercase example]",
          ],
        ]),
      ),
    /bare bracket-only pseudo-link/u,
  );
  assert.doesNotThrow(
    () =>
      extractApiSnippets(
        new Map([
          [
            "docs/site/api/valid-markdown-links.md",
            "![Diagram](diagram.png)\n\n[Inline](#/api/index)\n\n[Reference]: #/api/index\n\n[reference]\n\n[Short form][reference]\n\n`[code]`",
          ],
        ]),
      ),
    "Images, inline links, reference links, definitions, and code must remain valid",
  );
  assert.doesNotThrow(
    () =>
      extractApiSnippets(
        new Map([
          [
            "docs/site/api/numeric-intervals.md",
            "# Ranges\n\nValues in [0, 1], [-1,1], and [-0.5, +.5] are numeric intervals.",
          ],
        ]),
      ),
    "Numeric intervals must not be mistaken for Markdown links",
  );
  const pibblPathApiPath = "docs/site/api/hooks/use-rect-path.md";
  const brokenPibblPathSources = new Map(currentSources);
  const pibblPathSource = currentSources.get(pibblPathApiPath);
  const brokenPibblPathSource = pibblPathSource.replace(
    'return <Path style={{ d: path, fill: "#2563eb" }} />;',
    "return path;",
  );
  assert.notEqual(
    brokenPibblPathSource,
    pibblPathSource,
    "useRectPath component-return mutation fixture did not change",
  );
  brokenPibblPathSources.set(pibblPathApiPath, brokenPibblPathSource);
  await rejects(
    () => typecheckCompleteSnippets(extractApiSnippets(brokenPibblPathSources)),
    /failed typecheck/u,
  );
  if (auditHistoricalPreservation) {
    throws(
      () =>
        assertCurrentNormativeContractInventory(
          currentNormativeContractPaths.filter(
            (path) => path !== "docs/design/signals-and-scheduling-contract.md",
          ),
        ),
      /Current normative contract inventory/u,
    );
    throws(
      () =>
        assertCurrentNormativeContractInventory(
          currentNormativeContractPaths.filter(
            (path) => path !== "docs/design/animation-contract.md",
          ),
        ),
      /Current normative contract inventory/u,
    );
    throws(
      () =>
        assertCurrentNormativeContractInventory(
          currentNormativeContractPaths.filter(
            (path) => path !== "docs/design/render-layer-and-three-contract.md",
          ),
        ),
      /Current normative contract inventory/u,
    );
    const alteredSignalContract = replaceContractUnit(
      currentSources.get("docs/design/signals-and-scheduling-contract.md"),
      "s",
      "s0008",
      "Signals may implicitly unwrap and update during render.",
    );
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: postBaselineSignalContractRecord,
          currentSource: alteredSignalContract,
          approvalRecordsById,
        }),
      /reviewed complete semantic inventory/u,
    );
    const alteredAnimationContract = replaceContractUnit(
      currentSources.get("docs/design/animation-contract.md"),
      "m",
      "m0008",
      "Animation easing is mutable and may run on its own clock.",
    );
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: postBaselineAnimationContractRecord,
          currentSource: alteredAnimationContract,
          approvalRecordsById,
        }),
      /reviewed complete semantic inventory/u,
    );
    const alteredThreeContract = replaceContractUnit(
      currentSources.get("docs/design/render-layer-and-three-contract.md"),
      "t",
      "t0016",
      "The adapter silently replaces the application's Three scene on every frame.",
    );
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: postBaselineThreeContractRecord,
          currentSource: alteredThreeContract,
          approvalRecordsById,
        }),
      /reviewed complete semantic inventory/u,
    );
    const unmappedThreeContract = structuredClone(
      postBaselineThreeContractRecord,
    );
    unmappedThreeContract.mappings
      .find(({ id }) => id === "three-js-adapter")
      .currentIds.shift();
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: unmappedThreeContract,
          currentSource: currentSources.get(
            "docs/design/render-layer-and-three-contract.md",
          ),
          approvalRecordsById,
        }),
      /current text is not exhaustively mapped/u,
    );
    const unmappedSignalContract = structuredClone(
      postBaselineSignalContractRecord,
    );
    const boundaryMapping = unmappedSignalContract.mappings.find(
      ({ id }) => id === "deliberate-boundaries",
    );
    boundaryMapping.currentIds = boundaryMapping.currentIds.filter(
      (id) => id !== "s0044",
    );
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: unmappedSignalContract,
          currentSource: currentSources.get(
            "docs/design/signals-and-scheduling-contract.md",
          ),
          approvalRecordsById,
        }),
      /current text is not exhaustively mapped/u,
    );
    const unmappedAnimationContract = structuredClone(
      postBaselineAnimationContractRecord,
    );
    const animationBoundaryMapping = unmappedAnimationContract.mappings.find(
      ({ id }) => id === "deliberate-animation-boundaries",
    );
    animationBoundaryMapping.currentIds =
      animationBoundaryMapping.currentIds.filter((id) => id !== "m0060");
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: unmappedAnimationContract,
          currentSource: currentSources.get(
            "docs/design/animation-contract.md",
          ),
          approvalRecordsById,
        }),
      /current text is not exhaustively mapped/u,
    );
    const missingPivotRenderApproval = structuredClone(
      postBaselineAnimationContractRecord,
    );
    const renderLifecycleMapping = missingPivotRenderApproval.mappings.find(
      ({ id }) => id === "scheduler-render-webgl-lifecycle",
    );
    delete renderLifecycleMapping.supplementalApprovals;
    throws(
      () =>
        assertThreePivotPostBaselineApprovals({
          animationRecord: missingPivotRenderApproval,
          signalRecord: postBaselineSignalContractRecord,
        }),
      /m0042 must retain exact render-layer pivot approval/u,
    );
    const incompleteAnimationSceneApproval = structuredClone(
      postBaselineAnimationContractRecord,
    );
    const animationSceneMapping =
      incompleteAnimationSceneApproval.mappings.find(
        ({ id }) => id === "webgl-animation-scene-lifecycle",
      );
    animationSceneMapping.supplementalApprovals[0].unitIds = ["p0026"];
    throws(
      () =>
        assertThreePivotPostBaselineApprovals({
          animationRecord: incompleteAnimationSceneApproval,
          signalRecord: postBaselineSignalContractRecord,
        }),
      /m0051 must retain exact pivot approval/u,
    );
    const incompleteDrawingPivotUnits = structuredClone(
      contractPreservationBaseline,
    );
    incompleteDrawingPivotUnits.additions
      .find(({ id }) => id === "three-pivot-drawing-components-contract")
      .currentIds.pop();
    throws(
      () => assertThreePivotDrawingApprovals(incompleteDrawingPivotUnits),
      /must isolate the approved render-layer/u,
    );
    const incompleteDrawingPivotApproval = structuredClone(
      contractPreservationBaseline,
    );
    incompleteDrawingPivotApproval.additions
      .find(({ id }) => id === "three-pivot-drawing-components-contract")
      .approval.unitIds.pop();
    throws(
      () => assertThreePivotDrawingApprovals(incompleteDrawingPivotApproval),
      /must retain exact Three-pivot design approval/u,
    );
    const animationApprovalMutation = structuredClone(
      postBaselineSignalContractRecord,
    );
    const publicSignalMapping = animationApprovalMutation.mappings.find(
      ({ id }) => id === "public-signal-api",
    );
    publicSignalMapping.approval.unitIds = ["g0084"];
    publicSignalMapping.reason += " g0084";
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: animationApprovalMutation,
          currentSource: currentSources.get(
            "docs/design/signals-and-scheduling-contract.md",
          ),
          approvalRecordsById,
        }),
      /out-of-scope approved-design unit g0084 from Animation value definitions/u,
    );
    const signalApprovalMutation = structuredClone(
      postBaselineAnimationContractRecord,
    );
    const animationModelMapping = signalApprovalMutation.mappings.find(
      ({ id }) => id === "animation-document-and-public-model",
    );
    animationModelMapping.approval.unitIds = ["g0062"];
    animationModelMapping.reason += " g0062";
    throws(
      () =>
        assertPostBaselineContractPreservation({
          record: signalApprovalMutation,
          currentSource: currentSources.get(
            "docs/design/animation-contract.md",
          ),
          approvalRecordsById,
        }),
      /out-of-scope approved-design unit g0062 from Public signal API/u,
    );
    const missingSignalPrecedence = structuredClone(
      contractPreservationBaseline,
    );
    missingSignalPrecedence.evidenceMappings =
      missingSignalPrecedence.evidenceMappings.filter(
        ({ id }) => id !== "pending-root-precedence-signal",
      );
    throws(
      () => assertTask9EvidenceMappings(missingSignalPrecedence),
      /Signal pending-root precedence requires signal-specific executable evidence/u,
    );
    const weakenedRetainedSignal = structuredClone(
      contractPreservationBaseline,
    );
    const weakenedRetainedSignalMapping =
      weakenedRetainedSignal.evidenceMappings.find(
        ({ id }) => id === "retained-hook-signal",
      );
    weakenedRetainedSignalMapping.test.marker =
      "detaches every signal edge when a component is removed";
    throws(
      () => assertTask9EvidenceMappings(weakenedRetainedSignal),
      /owner removal/u,
    );
    const missingPublicPackageLegacyApproval = structuredClone(
      contractPreservationBaseline,
    );
    missingPublicPackageLegacyApproval.translations.find(
      ({ id }) =>
        id === "design-runtime-hooks-contract-md-public-package-boundary",
    ).approval = {
      recordId: "first-class-signals-and-scheduler",
      unitIds: ["g0061", "g0158"],
    };
    throws(
      () =>
        assertMixedLegacyTask9Preservation(missingPublicPackageLegacyApproval),
      /must retain approved unit a0105/u,
    );
    const weakenedPublicPackageAnchors = structuredClone(
      contractPreservationBaseline,
    );
    weakenedPublicPackageAnchors.translations.find(
      ({ id }) =>
        id === "design-runtime-hooks-contract-md-public-package-boundary",
    ).sharedAnchors = ["package", "pibbl"];
    throws(
      () => assertMixedLegacyTask9Preservation(weakenedPublicPackageAnchors),
      /must retain its distinctive relevance anchors/u,
    );
    const missingDeterministicSignalsApproval = structuredClone(
      contractPreservationBaseline,
    );
    missingDeterministicSignalsApproval.translations.find(
      ({ id }) =>
        id === "design-runtime-hooks-contract-md-deterministic-evidence",
    ).approval = {
      recordId: "first-class-signals-and-scheduler",
      unitIds: ["g0064", "g0136", "g0153", "g0165", "g0192"],
    };
    throws(
      () =>
        assertMixedLegacyTask9Preservation(missingDeterministicSignalsApproval),
      /must retain exact Signals-centric approval/u,
    );
    const weakenedDeterministicAnchors = structuredClone(
      contractPreservationBaseline,
    );
    weakenedDeterministicAnchors.translations.find(
      ({ id }) =>
        id === "design-runtime-hooks-contract-md-deterministic-evidence",
    ).sharedAnchors = ["render"];
    throws(
      () => assertMixedLegacyTask9Preservation(weakenedDeterministicAnchors),
      /must retain its distinctive relevance anchors/u,
    );
  }

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
    "`Rectangle` `style.width`                     | Required",
    "`Rectangle` `style.width`                     | Optional",
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
    /field-level migration rect\.width has the wrong final behavior/iu,
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
        "docs/site/learn/guides/configure-jsx.md",
        "# Existing\n\n[missing](#not-an-anchor)",
      ),
    /Broken local anchor/u,
  );
  throws(
    () =>
      assertFixedConfigSignal(
        canvasRuntimeTypes.replace(
          "`fit`, `pixelRatio`, and `signal`",
          "`fit` and `pixelRatio`",
        ),
      ),
    /fixed PibblConfig/u,
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
      (source) => source.replace("      {accent.get()}", '      {"static"}'),
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

  if (auditHistoricalPreservation) {
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
        expectedContractPaths: baselineSnapshotContractPaths,
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

    const duplicatePrimaryDrawingSupplement = structuredClone(
      contractPreservationBaseline,
    );
    const duplicatePrimaryGeometry =
      duplicatePrimaryDrawingSupplement.additions.find(
        ({ id }) => id === "three-pivot-drawing-components-contract",
      );
    duplicatePrimaryGeometry.supplementalApprovals = [
      {
        recordId: "three-full-pivot",
        unitIds: ["p0005"],
      },
    ];
    throws(
      () =>
        assertPreservation({
          manifest: duplicatePrimaryDrawingSupplement,
          reviewedManifestSha256: sha256(
            JSON.stringify(duplicatePrimaryDrawingSupplement),
          ),
        }),
      /must use a record distinct from the primary approval/u,
    );

    const oldTask9TranslationApproval = structuredClone(
      contractPreservationBaseline,
    );
    const oldTask9Translation = oldTask9TranslationApproval.translations.find(
      ({ id }) => id === "design-canvas-surface-contract-realm-scheduling",
    );
    oldTask9Translation.approval = {
      id: "a0177",
      kind: "prose",
      text: "Existing design contracts are updated together",
    };
    oldTask9Translation.reason =
      "Approved-design unit a0177 purports to authorize the Task 9 realm scheduler translation.";
    throws(
      () =>
        assertPreservation({
          manifest: oldTask9TranslationApproval,
          reviewedManifestSha256: sha256(
            JSON.stringify(oldTask9TranslationApproval),
          ),
        }),
      /must use approved-design record first-class-signals-and-scheduler/u,
    );

    const animationTask9TranslationApproval = structuredClone(
      contractPreservationBaseline,
    );
    const animationTask9Translation =
      animationTask9TranslationApproval.translations.find(
        ({ id }) => id === "design-canvas-surface-contract-realm-scheduling",
      );
    animationTask9Translation.approval.unitIds = ["g0084"];
    animationTask9Translation.reason =
      "first-class-signals-and-scheduler unit g0084 purports to authorize b0034 b0035 to c0037 c0038 through root scheduler density anchors.";
    throws(
      () =>
        assertPreservation({
          manifest: animationTask9TranslationApproval,
          reviewedManifestSha256: sha256(
            JSON.stringify(animationTask9TranslationApproval),
          ),
        }),
      /out-of-scope approved-design unit g0084 from Animation value definitions/u,
    );

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
    const refRow = hooksContract.currentUnits.find(
      ({ kind, text }) => kind === "table" && text.includes("useRef(init?)"),
    );
    assert.ok(refRow, "Hook-specific table mutation unit is missing");
    {
      const mutatedSources = new Map(currentSources);
      mutatedSources.set(
        hooksContract.path,
        replaceContractUnit(
          currentSources.get(hooksContract.path),
          "c",
          refRow.id,
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
    const unrelatedShapeApproval = structuredClone(
      contractPreservationBaseline,
    );
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
    const firstGapEvidence = repeatedEvidence.evidenceMappings.find(
      ({ id }) => id === "flex-gap-default",
    );
    const secondGapEvidence = repeatedEvidence.evidenceMappings.find(
      ({ id }) => id === "flex-axis-gap-precedence",
    );
    assert.ok(firstGapEvidence && secondGapEvidence);
    secondGapEvidence.source = firstGapEvidence.source;
    secondGapEvidence.test = firstGapEvidence.test;
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
    ["lifecycle", nonJsx.replace("useSignal(", "missingSignal(")],
    [
      "mount",
      nonJsx.replace("return pibbl(canvas,", "return missingMount(canvas,"),
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
          'import { Rectangle } from "@pibbl/core";\nconst broken = <MissingIdentifier />;\nvoid Rectangle;\nvoid broken;',
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
          "/** @jsxImportSource @pibbl/core */",
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
  assertHistoricalBanners();
}

process.stdout.write(
  `Documentation checks passed: ${publicGuidePaths.length} guides, ` +
    `${linkCheckedPaths.length} current/migration files, ` +
    `${historicalMarkdownPaths.length} historical/work records, ` +
    `${rootExports.values.size} values, ${rootExports.types.size} types, ` +
    `${matrixRows.length} acceptance rows, ${parsedSnippetCount} parsed ` +
    `code snippets, ${compiledSnippetCount} extracted TypeScript programs, ` +
    `${compiledApiSnippetCount} compiler-checked API example programs, ` +
    `${currentNormativeContractPaths.length} current normative contracts, ` +
    `${fieldMigrationResult.fieldMigrationCount} field migrations, ` +
    `historical preservation ${auditHistoricalPreservation ? `audited (${contractPreservationResult.currentUnitCount} snapshot units, ${postBaselineUnitCount} post-baseline units)` : "not audited (use audit:docs:preservation)"}, ` +
    `${presentationSourcePaths.length} discovered presentation sources, and ` +
    `the extracted JavaScript program through Babel and esbuild.\n`,
);

if (
  resolve(process.argv[1] ?? "") ===
  join(repositoryRoot, "tooling/verify-docs.mjs")
) {
  assertHistoricalBanners();
}
