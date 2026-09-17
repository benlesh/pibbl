# Diagram Editor Tutorial Implementation Plan

> **Historical status: PROPOSED IMPLEMENTATION PLAN.** This plan records the approved design's implementation sequence; current shipped behavior remains governed by `docs/design/` until every shipping gate below passes.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a twelve-chapter, independently runnable diagram-editor tutorial whose landing page previews and links to the finished editor.

**Architecture:** Keep tutorial prose in the validated `docs/site/` tree and add a dedicated tutorial-snapshot catalog beside, but separate from, the ordinary learning-example and deterministic-scenario catalogs. Reuse the existing sandboxed TypeScript workbench through a small shared source-entry contract, derive chapter relationships during the documentation build, and prove the cumulative editor with semantic browser checks before capturing its landing-page teaser.

**Tech Stack:** TypeScript 5.9, TSX with `@crc/core` automatic JSX, CRC Canvas 2D components/hooks, Vite, Markdown-It, Monaco, Vitest Browser with Playwright Chromium, and the repository's static documentation and visual-verification tooling.

**Spec:** `docs/superpowers/specs/2026-09-13-diagram-editor-tutorial-design.md`

## Global Constraints

- Use Node 24.15 or newer on the Node 24 LTS line and pnpm 11.21.0 through `corepack pnpm@11.21.0`.
- Preserve unrelated working-tree changes and untracked files. Stage and commit only the files named by the active task.
- Define each observable behavior with a failing test before changing production code or publishing its chapter.
- Tutorial sources use named public imports from `@crc/core`; they must not import source paths, `@crc/core/lib/*`, or `@crc/core/internal`.
- Every snapshot uses descriptive JSX, contains no `createElement`, relative import, dynamic import, test control, or source marker, and exports exactly `default function mount(canvas: HTMLCanvasElement): CRCController`.
- Every snapshot is self-contained. Do not extract shared tutorial application code into another module because the editable sandbox accepts direct CRC package imports only.
- The canonical logical Canvas is exactly 960 by 600. The toolbar is 56 logical pixels high, the workspace occupies y=56 through y=568, and the status strip is 32 logical pixels high.
- Use the stable node IDs `idea`, `sketch`, `build`, and `ship`; node cards are 168 by 84. Initial node positions are Idea `(92, 180)`, Sketch `(326, 92)`, Build `(392, 318)`, and Ship `(696, 210)` in workspace coordinates.
- Use edges `Idea -> Sketch`, `Sketch -> Build`, `Sketch -> Ship`, and `Build -> Ship`. Derive endpoints from current node geometry; never infer state from pixels.
- Use colors Idea `#ff6b57`, Sketch `#f7c948`, Build `#74d3ae`, Ship `#1f4bd8`, ink `#17211d`, paper `#fffdf6`, and workspace `#eef2e8` unless a chapter's exercise explicitly asks the reader to change one.
- Root-logical pointer coordinates stay authoritative. Convert to workspace coordinates by subtracting the workspace origin and inverting the current pan/zoom.
- Clamp zoom to exactly `0.6 <= zoom <= 1.8`, and preserve the workspace point under the wheel pointer when changing zoom.
- Decorative grid, edge, arrowhead, label, port, and selection paint uses `pointerEvents="none"`. Structural containers add listeners but never invent hit geometry.
- `Layer` owns only the stable grid subtree. Nodes and connections remain on the immediate path. Nonempty filters and `Layer` retain their documented `OffscreenCanvas`/Canvas-filter requirements.
- Logical focus is not semantic accessibility. Chapter 11 and the final chapter must state that a production editor still needs an application-owned semantic alternative with equivalent data and operations.
- Semantic state and geometry assertions precede screenshot or exact-pixel evidence. Never update a visual baseline solely to clear a failure.
- Do not report dated test totals as current. Record only fresh commands and output from the implementation revision.

## Canonical Tutorial Vocabulary

Use these chapter files, routes, snapshot slugs, titles, and orders exactly:

| Order | Markdown file             | Route suffix           | Snapshot slug                         | Title                             |
| ----: | ------------------------- | ---------------------- | ------------------------------------- | --------------------------------- |
|     1 | `canvas-scene.md`         | `canvas-scene`         | `diagram-editor-canvas-scene`         | Create the Canvas scene           |
|     2 | `first-node.md`           | `first-node`           | `diagram-editor-first-node`           | Draw the first node               |
|     3 | `connect-nodes.md`        | `connect-nodes`        | `diagram-editor-connect-nodes`        | Connect two nodes                 |
|     4 | `reusable-node.md`        | `reusable-node`        | `diagram-editor-reusable-node`        | Extract a reusable node component |
|     5 | `editor-chrome.md`        | `editor-chrome`        | `diagram-editor-editor-chrome`        | Build the editor chrome           |
|     6 | `selection.md`            | `selection`            | `diagram-editor-selection`            | Select nodes with state           |
|     7 | `dragging.md`             | `dragging`             | `diagram-editor-dragging`             | Drag nodes safely                 |
|     8 | `pan-and-zoom.md`         | `pan-and-zoom`         | `diagram-editor-pan-and-zoom`         | Pan and zoom the workspace        |
|     9 | `viewport-and-layer.md`   | `viewport-and-layer`   | `diagram-editor-viewport-and-layer`   | Constrain the viewport            |
|    10 | `filters.md`              | `filters`              | `diagram-editor-filters`              | Polish selection with filters     |
|    11 | `keyboard-interaction.md` | `keyboard-interaction` | `diagram-editor-keyboard-interaction` | Add keyboard interaction          |
|    12 | `finished-editor.md`      | `finished-editor`      | `diagram-editor-finished`             | Finish and harden the editor      |

Every chapter frontmatter uses this exact shape with the row-specific values substituted:

```yaml
---
id: tutorial-diagram-editor-<route-suffix>
title: "<title>"
summary: <one outcome-oriented sentence>
kind: tutorial
slug: <route-suffix>
tutorial: diagram-editor
order: <1-12>
exampleSlug: <snapshot-slug>
keywords: [diagram editor, tutorial, <chapter concepts>]
---
```

Every chapter body has these level-two headings in this order:

```markdown
## What you will make

## How it works

## Build the change

## Predict and try

## Check your result

## What you learned
```

## Canonical Editor Model and Geometry

Repeat these definitions in each snapshot beginning with Chapter 4; earlier chapters introduce only the subset they need:

```ts
type NodeId = "idea" | "sketch" | "build" | "ship";

interface DiagramNode {
  readonly id: NodeId;
  readonly title: string;
  readonly subtitle: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
}

interface DiagramEdge {
  readonly id: string;
  readonly from: NodeId;
  readonly to: NodeId;
}

interface ViewTransform {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

const INITIAL_NODES: readonly DiagramNode[] = [
  {
    id: "idea",
    title: "IDEA",
    subtitle: "Find the spark",
    color: "#ff6b57",
    x: 92,
    y: 180,
  },
  {
    id: "sketch",
    title: "SKETCH",
    subtitle: "Shape the flow",
    color: "#f7c948",
    x: 326,
    y: 92,
  },
  {
    id: "build",
    title: "BUILD",
    subtitle: "Make it real",
    color: "#74d3ae",
    x: 392,
    y: 318,
  },
  {
    id: "ship",
    title: "SHIP",
    subtitle: "Share the work",
    color: "#1f4bd8",
    x: 696,
    y: 210,
  },
] as const;

const EDGES: readonly DiagramEdge[] = [
  { id: "idea-sketch", from: "idea", to: "sketch" },
  { id: "sketch-build", from: "sketch", to: "build" },
  { id: "sketch-ship", from: "sketch", to: "ship" },
  { id: "build-ship", from: "build", to: "ship" },
] as const;

const INITIAL_VIEW: ViewTransform = { panX: 0, panY: 0, zoom: 1 };
const WORKSPACE_TOP = 56;
const WORKSPACE_HEIGHT = 512;
const NODE_WIDTH = 168;
const NODE_HEIGHT = 84;
```

The final coordinate helpers have these signatures and formulas:

```ts
function rootToWorkspace(
  point: Readonly<{ x: number; y: number }>,
  view: Readonly<ViewTransform>,
): { x: number; y: number } {
  return {
    x: (point.x - view.panX) / view.zoom,
    y: (point.y - WORKSPACE_TOP - view.panY) / view.zoom,
  };
}

function zoomAroundPoint(
  view: Readonly<ViewTransform>,
  point: Readonly<{ x: number; y: number }>,
  deltaY: number,
): ViewTransform {
  const anchor = rootToWorkspace(point, view);
  const zoom = Math.min(
    1.8,
    Math.max(0.6, view.zoom * Math.exp(-deltaY * 0.001)),
  );
  return {
    zoom,
    panX: point.x - anchor.x * zoom,
    panY: point.y - WORKSPACE_TOP - anchor.y * zoom,
  };
}
```

## File Responsibility Map

### Tutorial content and sources

- `docs/site/learn/tutorials/diagram-editor/index.md` — outcome-first landing, final teaser, prerequisites, linked curriculum, and scope contract.
- `docs/site/learn/tutorials/diagram-editor/*.md` — twelve authored chapter pages; each owns prose and one snapshot reference.
- `packages/scenarios/src/tutorial-types.ts` — minimal metadata and module types for tutorial snapshots and workbench source entries.
- `packages/scenarios/src/tutorial-catalog.ts` — validated ordered tutorial snapshot catalog, lookup, and loader.
- `packages/scenarios/src/tutorials/diagram-editor/*.example.tsx` — twelve self-contained canonical editor snapshots.
- `packages/scenarios/src/index.ts` — package exports for tutorial metadata, catalog, lookup, and loader.

### Studio and documentation infrastructure

- `playground/src/learning-sources.ts` — raw-source discovery and loading for both ordinary lessons and tutorial snapshots.
- `playground/src/editor-workbench.ts` — consumes the shared minimal workbench-entry interface.
- `playground/src/docs/markdown-page.ts` — resolves either source kind and renders generated tutorial pagination after the workbench.
- `playground/src/style.css` — accessible responsive pagination and landing teaser presentation.
- `tooling/studio-docs/model.ts` — browser-safe tutorial relationship type.
- `tooling/studio-docs/build.ts` — workbench-source validation and derived tutorial relationships.
- `tooling/studio-docs/learning-catalog-adapter.ts` — serializes normal examples separately from the combined workbench inventory.
- `tooling/studio-docs/vite-plugin.ts` — supplies and invalidates both catalogs.
- `tooling/scenario-source-discovery.ts` — classifies `/tutorials/` sources as public learning sources rather than test labs.
- `tooling/scenario-catalog.ts` — validates tutorial sources and emits their separate generated index section.
- `docs/scenario-index.md` — generated inventory containing Examples, Tutorial snapshots, and Automated Test Labs as distinct sections.

### Evidence and release records

- `packages/core/test/tutorial-snapshots.test.tsx` — catalog, source, mount, semantic state/geometry, interaction, focus, and ownership evidence.
- `packages/core/test/support/user-input.ts` — reusable logical drag and wheel helpers for real browser input.
- `tooling/studio-docs/build.check.ts` — frontmatter/source-reference/order/relationship/search-exclusion evidence.
- `tooling/studio-docs/search-index.check.ts` — real chapter indexing, ranking, and snapshot-exclusion evidence.
- `playground/test/markdown-page.test.ts` — pagination semantics and rendering order.
- `tooling/verify-studio-docs.mjs` — real-route landing, chapter, sandbox, pagination, reset/share, and lifecycle acceptance.
- `tooling/verify-diagram-editor-teaser.mjs` — captures or verifies the public teaser against the canonical finished snapshot.
- `tooling/verify-studio-visuals.mjs` — landing-page and completed-editor visual comparisons.
- `playground/public/tutorials/diagram-editor/finished-editor.png` — public teaser generated from Chapter 12.
- `packages/core/test/visual-baselines/studio-diagram-editor-landing.expected.png` — landing visual oracle.
- `packages/core/test/visual-baselines/studio-diagram-editor-finished.expected.png` — completed editor visual oracle.
- `package.json` — focused teaser check/update scripts folded into the visual gate.
- `docs/documentation-follow-up.md` — removes the now-completed tutorial from deferred work.
- `docs/testing/field-notes/2026-09-13-diagram-editor-tutorial.md` — fresh environment, commands, results, and reviewed visual changes.
- `tooling/verify-docs.mjs` — the public Markdown inventory entries required by the twelve new chapter pages.

---

### Task 1: Derive and Render Tutorial Progression

**Files:**

- Modify: `tooling/studio-docs/model.ts`
- Modify: `tooling/studio-docs/build.ts`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `playground/src/docs/markdown-page.ts`
- Modify: `playground/test/markdown-page.test.ts`
- Modify: `playground/src/style.css`

**Interfaces:**

- Consumes: Existing validated `kind: tutorial`, `tutorial`, `order`, title, and route fields.
- Produces: `TutorialPageRelationship` and optional `tutorialRelationship` on built/browser pages; `.tutorial-pagination` DOM after the optional workbench.

- [ ] **Step 1: Add failing build checks for derived relationships**

Extend the multiple-tutorial fixture in `tooling/studio-docs/build.check.ts` to assert root exclusion, Chapter 1 back-linking, ordered neighbors, and terminal behavior:

```ts
const timeline =
  multipleTutorials.pageByRoute[
    "#/learn/tutorials/advanced-animation/timeline"
  ];
const publish =
  multipleTutorials.pageByRoute["#/learn/tutorials/advanced-animation/publish"];

assert.deepEqual(timeline.tutorialRelationship, {
  rootRoute: "#/learn/tutorials/advanced-animation",
  chapter: 1,
  chapterCount: 2,
  previous: {
    route: "#/learn/tutorials/advanced-animation",
    title: "Animate a scene",
  },
  next: {
    route: "#/learn/tutorials/advanced-animation/publish",
    title: "publish",
  },
});
assert.deepEqual(publish.tutorialRelationship?.previous, {
  route: "#/learn/tutorials/advanced-animation/timeline",
  title: "timeline",
});
assert.equal(publish.tutorialRelationship?.next, undefined);
assert.equal(
  multipleTutorials.pageByRoute["#/learn/tutorials/advanced-animation"]
    .tutorialRelationship,
  undefined,
);
```

- [ ] **Step 2: Run the build check and verify the new assertion fails**

Run: `corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts`

Expected: FAIL because `tutorialRelationship` is absent.

- [ ] **Step 3: Define and derive the relationship model**

Add this type to `tooling/studio-docs/model.ts`:

```ts
export interface TutorialPageRelationship {
  readonly rootRoute: string;
  readonly chapter: number;
  readonly chapterCount: number;
  readonly previous?: { readonly route: string; readonly title: string };
  readonly next?: { readonly route: string; readonly title: string };
}
```

Add `tutorialRelationship?: TutorialPageRelationship` to the loaded page shape. In `build.ts`, replace the validation-only tutorial pass with `deriveTutorialRelationships(pages)`. Sort each tutorial's chapters by `frontmatter.order`, preserve the existing exactly-one-root and contiguous-order failures, and return new page objects whose chapter metadata is:

```ts
{
  rootRoute: root.route,
  chapter: index + 1,
  chapterCount: chapters.length,
  previous:
    index === 0
      ? { route: root.route, title: root.frontmatter.title }
      : { route: chapters[index - 1].route, title: chapters[index - 1].frontmatter.title },
  ...(chapters[index + 1] === undefined
    ? {}
    : {
        next: {
          route: chapters[index + 1].route,
          title: chapters[index + 1].frontmatter.title,
        },
      }),
}
```

Ensure `StudioDocumentationBrowserPage` retains `tutorialRelationship` so the relationship survives virtual-module serialization.

- [ ] **Step 4: Run the build check and verify relationship derivation passes**

Run: `corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts`

Expected: PASS with the existing deterministic manifest message.

- [ ] **Step 5: Add failing Markdown-page pagination tests**

Create a tutorial fixture from `fixtureDocument` in `playground/test/markdown-page.test.ts`. Give it `tutorialRelationship` with previous and next destinations, mount a fake workbench, and assert DOM order and accessible labels:

```ts
expect(
  [...container.querySelector("article")!.children].map(
    (element) => element.className,
  ),
).toEqual([
  "documentation-breadcrumb",
  "documentation-header",
  "documentation-body",
  "documentation-workbench lesson-workbench-loading",
  "tutorial-pagination",
]);
expect(
  container
    .getElementsByClassName("tutorial-pagination")[0]
    ?.getAttribute("aria-label"),
).toBe("Tutorial chapters");
expect(
  container.querySelector<HTMLAnchorElement>(
    "[data-tutorial-direction='previous']",
  )?.href,
).toContain("#/learn/tutorials/diagram-editor/first-node");
expect(
  container.querySelector<HTMLAnchorElement>("[data-tutorial-direction='next']")
    ?.textContent,
).toContain("Next: Extract a reusable node component");
```

Add a terminal fixture whose `next` is absent and assert a `Back to the tutorial overview` link to `rootRoute`.

- [ ] **Step 6: Run the Markdown-page test and verify it fails**

Run: `corepack pnpm@11.21.0 exec vitest run playground/test/markdown-page.test.ts`

Expected: FAIL because `.tutorial-pagination` is not rendered.

- [ ] **Step 7: Render pagination after the workbench and style it responsively**

In `markdown-page.ts`, append `tutorialPagination(options.document)` after the optional workbench host. The helper returns no node for a root/guide/API page, gives links descriptive visible text, and uses the overview link only when `next` is absent. Use ordinary anchors so hash routing, browser history, and focus behavior remain owned by the existing shell.

Add CSS that renders two bordered actions in a two-column row on desktop and a one-column stack below 700px. Keep visible focus styles from the existing link system and avoid fixed heights that clip long chapter titles.

- [ ] **Step 8: Run the focused documentation UI checks**

Run: `corepack pnpm@11.21.0 exec vitest run playground/test/markdown-page.test.ts playground/test/navigation.test.ts playground/test/routes.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit the progression slice**

```bash
git add tooling/studio-docs/model.ts tooling/studio-docs/build.ts tooling/studio-docs/build.check.ts playground/src/docs/markdown-page.ts playground/test/markdown-page.test.ts playground/src/style.css
git commit -m "feat(docs): add tutorial chapter progression"
```

### Task 2: Add the Isolated Tutorial Snapshot Pipeline

**Files:**

- Create: `packages/scenarios/src/tutorial-types.ts`
- Create: `packages/scenarios/src/tutorial-catalog.ts`
- Modify: `packages/scenarios/src/learning-types.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `playground/src/learning-sources.ts`
- Modify: `playground/src/editor-workbench.ts`
- Modify: `playground/src/examples/example-pages.ts`
- Modify: `playground/src/docs/markdown-page.ts`
- Modify: `tooling/studio-docs/build.ts`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `tooling/studio-docs/search-index.check.ts`
- Modify: `tooling/studio-docs/learning-catalog-adapter.ts`
- Modify: `tooling/studio-docs/vite-plugin.ts`
- Test: `packages/core/test/tutorial-snapshots.test.tsx`

**Interfaces:**

- Consumes: Existing learning-example catalog, raw-source loader, workbench, and `exampleSlug` frontmatter.
- Produces: `WorkbenchSourceMetadata`, `TutorialSnapshotMetadata`, `TutorialSnapshotCatalogEntry`, `tutorialSnapshotCatalog`, `validateTutorialSnapshotCatalog`, `getTutorialSnapshotBySlug`, `loadTutorialSnapshot`, `getWorkbenchEntryBySlug`, and a build-only `workbenchSources` inventory.

- [ ] **Step 1: Write failing validator and namespace tests**

Create `packages/core/test/tutorial-snapshots.test.tsx` with synthetic records so pipeline behavior can be proven before real chapters exist:

```ts
import {
  getWorkbenchEntryBySlug,
  learningExampleCatalog,
  tutorialSnapshotCatalog,
  validateTutorialSnapshotCatalog,
  type TutorialSnapshotCatalogEntry,
} from "@crc/scenarios";

const module = async () => ({ default: () => ({ dispose() {} }) });
const record = (
  chapter: number,
  slug = `diagram-editor-chapter-${String(chapter)}`,
): TutorialSnapshotCatalogEntry => ({
  slug,
  tutorial: "diagram-editor",
  chapter,
  title: `Chapter ${String(chapter)}`,
  authoring: "jsx",
  canvas: { width: 960, height: 600 },
  source: {
    path: `packages/scenarios/src/tutorials/diagram-editor/${String(chapter).padStart(2, "0")}-chapter-${String(chapter)}.example.tsx`,
  },
  load: module,
});

it("validates one ordered tutorial prefix and rejects gaps", () => {
  expect(validateTutorialSnapshotCatalog([record(1), record(2)])).toHaveLength(
    2,
  );
  expect(() => validateTutorialSnapshotCatalog([record(1), record(3)])).toThrow(
    /contiguous from 1/u,
  );
});

it("keeps tutorial and ordinary learning slugs in one workbench namespace", () => {
  expect(tutorialSnapshotCatalog).toEqual([]);
  expect(getWorkbenchEntryBySlug(learningExampleCatalog[0]!.slug)).toBe(
    learningExampleCatalog[0],
  );
  expect(() =>
    validateTutorialSnapshotCatalog([
      record(1, learningExampleCatalog[0]!.slug),
    ]),
  ).toThrow(/duplicate workbench slug/u);
});
```

Also cover the wrong tutorial name, non-JSX authoring, dimensions other than
960 by 600, invalid path, duplicate chapter, duplicate path, and missing default
mount module.

- [ ] **Step 2: Run the new test and verify imports fail**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL because tutorial catalog exports do not exist.

- [ ] **Step 3: Define the shared source and tutorial types**

Move the minimal workbench fields into `WorkbenchSourceMetadata` in
`learning-types.ts` and let `LearningExampleMetadata` extend it:

```ts
export interface WorkbenchSourceMetadata {
  slug: string;
  canvas: { width: number; height: number };
  source: { path: string };
}

export interface LearningExampleMetadata extends WorkbenchSourceMetadata {
  authoring: LearningAuthoring;
  title: string;
  shortTitle: string;
  section: LearningSectionId;
  browseGroup?: LearningBrowseGroup;
  order: number;
  summary: string;
  api: readonly string[];
  objectives: readonly [string, string];
  prompts: LearningPrompt;
  apiNotes: readonly string[];
  relationships: LearningRelationships;
}
```

In `tutorial-types.ts`, import `LearningExampleModule` and
`WorkbenchSourceMetadata`, then define the exact types from the approved spec.
Keep these types in private `@crc/scenarios`; do not add anything to the public
`@crc/core` packages.

- [ ] **Step 4: Implement an empty production catalog plus strict prefix validation**

Create `tutorial-catalog.ts`. `validateTutorialSnapshotCatalog()` must accept an
empty in-progress catalog, otherwise require chapters to equal `index + 1`, and
reject a slug already present in `learningExampleCatalog`. Validate exact
`tutorial: "diagram-editor"`, exact `authoring: "jsx"`, exact 960 by 600 Canvas,
unique path, `.example.tsx`, and the
`packages/scenarios/src/tutorials/diagram-editor/NN-` prefix.

Export:

```ts
export const tutorialSnapshotCatalog = validateTutorialSnapshotCatalog([]);

export function getTutorialSnapshotBySlug(
  slug: string,
): TutorialSnapshotCatalogEntry | undefined;

export function getWorkbenchEntryBySlug(
  slug: string,
): LearningExampleCatalogEntry | TutorialSnapshotCatalogEntry | undefined;

export async function loadTutorialSnapshot(
  entry: TutorialSnapshotCatalogEntry,
): Promise<LearningExampleModule>;
```

`loadTutorialSnapshot` rejects a module whose default is not a function. Export
the values and types from `packages/scenarios/src/index.ts`.

- [ ] **Step 5: Run the catalog test and verify it passes**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: PASS with the empty real catalog and synthetic validation cases.

- [ ] **Step 6: Add failing raw-source and documentation-reference checks**

In `tutorial-snapshots.test.tsx`, assert distinct discovered sets:

```ts
expect(learningSourcePaths).toEqual(
  learningExampleCatalog.map((entry) => entry.source.path).sort(),
);
expect(tutorialSourcePaths).toEqual([]);
expect(workbenchSourcePaths).toEqual(learningSourcePaths);
```

In `tooling/studio-docs/build.check.ts`, construct one fixture tutorial page
whose `exampleSlug` appears only in `workbenchSources`, not `examples`. Assert
that the page builds, the slug does not appear in normalized public examples,
and `toStudioDocumentationSearchInput()` receives no independent tutorial
snapshot record.

- [ ] **Step 7: Run the focused checks and verify the new interfaces fail**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
```

Expected: FAIL because source arrays and `workbenchSources` are missing.

- [ ] **Step 8: Generalize source discovery and workbench consumption**

In `learning-sources.ts`, use two explicit globs and one combined map:

```ts
const learningModules = import.meta.glob(
  "../../packages/scenarios/src/learning/**/*.example.tsx",
  { import: "default", query: "?raw" },
);
const tutorialModules = import.meta.glob(
  "../../packages/scenarios/src/tutorials/**/*.example.tsx",
  { import: "default", query: "?raw" },
);

export const learningSourcePaths = sourcePaths(learningModules);
export const tutorialSourcePaths = sourcePaths(tutorialModules);
export const workbenchSourcePaths = [
  ...learningSourcePaths,
  ...tutorialSourcePaths,
].sort();
```

Rename the generalized loader to `loadWorkbenchSource(entry:
WorkbenchSourceMetadata)`. Keep `loadLearningSource` as a compatibility alias
that delegates to it because `learning-examples.test.ts` and
`animation-lab.test.ts` still import that established test helper. Update the
example page and Markdown page to use the generalized name; leave the existing
learning-only tests on the alias. Change `WorkbenchOptions.entry` to
`WorkbenchSourceMetadata`; the editor continues to read only slug, canvas, and
source.

Use `getWorkbenchEntryBySlug()` in `markdown-page.ts` so an `exampleSlug` can
resolve either catalog without exposing tutorial snapshots in Examples.

- [ ] **Step 9: Separate public examples from workbench-source validation**

Add this build-only input to `tooling/studio-docs/build.ts`:

```ts
export interface StudioDocumentationWorkbenchInput {
  readonly slug: string;
  readonly source: { readonly path: string };
}

export interface StudioDocumentationBuildOptions {
  readonly repositoryRoot: string;
  readonly docsDirectory?: string;
  readonly apiInventory?: PublicApiInventory;
  readonly examples?: readonly StudioDocumentationExampleInput[];
  readonly workbenchSources?: readonly StudioDocumentationWorkbenchInput[];
}
```

Normalize/search `examples` exactly as today. Validate `exampleSlug` against
`workbenchSources ?? examples`, assert workbench slugs and paths are unique, and
change the error to `Unknown workbench source "<slug>" referenced by
exampleSlug.`

Replace `loadStudioLearningExamples()` with `loadStudioLearningCatalogs()` in
the adapter. Its short-lived TypeScript process imports both catalogs and emits:

```ts
{
  examples: learningExampleCatalog.map(toExampleInput),
  workbenchSources: [...learningExampleCatalog, ...tutorialSnapshotCatalog]
    .map(({ slug, source }) => ({ slug, source: { path: source.path } })),
}
```

Spread both arrays from `studioDocumentationBuildOptions()` and watch
`tutorial-catalog.ts` plus `tutorial-types.ts` in Vite's invalidation list. Update
the real-repository build calls in both `build.check.ts` and
`search-index.check.ts` to pass the combined workbench inventory. Keep fixture
builds independent by allowing their omitted `workbenchSources` to fall back to
their fixture `examples` array.

- [ ] **Step 10: Run the pipeline checks**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx packages/core/test/learning-examples.test.ts
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
corepack pnpm@11.21.0 typecheck
```

Expected: PASS; existing example counts, routes, raw sources, and search records
remain unchanged, and the empty tutorial catalog is accepted as infrastructure
for the following content slices.

- [ ] **Step 11: Commit the snapshot pipeline**

```bash
git add packages/scenarios/src/tutorial-types.ts packages/scenarios/src/tutorial-catalog.ts packages/scenarios/src/learning-types.ts packages/scenarios/src/index.ts playground/src/learning-sources.ts playground/src/editor-workbench.ts playground/src/examples/example-pages.ts playground/src/docs/markdown-page.ts tooling/studio-docs/build.ts tooling/studio-docs/build.check.ts tooling/studio-docs/search-index.check.ts tooling/studio-docs/learning-catalog-adapter.ts tooling/studio-docs/vite-plugin.ts packages/core/test/tutorial-snapshots.test.tsx
git commit -m "feat(docs): add tutorial snapshot pipeline"
```

### Task 3: Publish Chapters 1-2 and Their First Visual Payoffs

**Files:**

- Create: `packages/scenarios/src/tutorials/diagram-editor/01-canvas-scene.example.tsx`
- Create: `packages/scenarios/src/tutorials/diagram-editor/02-first-node.example.tsx`
- Create: `docs/site/learn/tutorials/diagram-editor/canvas-scene.md`
- Create: `docs/site/learn/tutorials/diagram-editor/first-node.md`
- Modify: `packages/scenarios/src/tutorial-catalog.ts`
- Modify: `tooling/scenario-source-discovery.ts`
- Modify: `tooling/scenario-source-discovery.check.ts`
- Modify: `tooling/scenario-catalog.ts`
- Modify: `docs/scenario-index.md` (generated)
- Modify: `packages/core/test/tutorial-snapshots.test.tsx`
- Modify: `tooling/studio-docs/build.check.ts`

**Interfaces:**

- Consumes: Task 2 tutorial catalog/workbench pipeline and Task 1 derived pagination.
- Produces: The first two catalog entries, source-backed chapter routes, the separate generated Tutorial snapshots inventory, and the reusable runtime-test harness for subsequent chapters.

- [ ] **Step 1: Add failing real-catalog and source-discovery assertions**

Replace the empty-catalog assertion in `tutorial-snapshots.test.tsx` with:

```ts
expect(
  tutorialSnapshotCatalog.map(({ chapter, slug, source }) => ({
    chapter,
    slug,
    path: source.path,
  })),
).toEqual([
  {
    chapter: 1,
    slug: "diagram-editor-canvas-scene",
    path: "packages/scenarios/src/tutorials/diagram-editor/01-canvas-scene.example.tsx",
  },
  {
    chapter: 2,
    slug: "diagram-editor-first-node",
    path: "packages/scenarios/src/tutorials/diagram-editor/02-first-node.example.tsx",
  },
]);
expect(tutorialSourcePaths).toEqual(
  tutorialSnapshotCatalog.map((entry) => entry.source.path),
);
```

Add a test that reads every cataloged source, applies
`validateLearningSourceText(source, { authoring: "jsx", label, sourcePath })`,
and confirms `loadTutorialSnapshot(entry)` has one default mount.

- [ ] **Step 2: Run the tutorial test and verify it fails**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL because the real catalog and source files are empty/missing.

- [ ] **Step 3: Author the Chapter 1 source**

Use only `crc`, `Rectangle`, `Text`, and `CRCController`. Paint the three fixed
regions and explanatory copy with ordinary elements:

```tsx
function DiagramEditor() {
  return [
    <Rectangle style={{ width: 960, height: 56, fill: "#fffdf6" }} />,
    <Text
      pointerEvents="none"
      style={{ x: 24, y: 34, fill: "#17211d", font: "900 22px sans-serif" }}
    >
      WORKFLOW MAP
    </Text>,
    <Rectangle
      style={{ x: 0, y: 56, width: 960, height: 512, fill: "#eef2e8" }}
    />,
    <Text
      pointerEvents="none"
      style={{
        x: 480,
        y: 310,
        fill: "#66736b",
        font: "700 16px monospace",
        textAlign: "center",
      }}
    >
      YOUR DIAGRAM STARTS HERE
    </Text>,
    <Rectangle
      style={{ x: 0, y: 568, width: 960, height: 32, fill: "#17211d" }}
    />,
    <Text
      pointerEvents="none"
      style={{ x: 20, y: 589, fill: "#fffdf6", font: "700 12px monospace" }}
    >
      READY · 100%
    </Text>,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <DiagramEditor />);
}
```

Do not add interaction or layout components yet. The workspace `Rectangle`
participates by default; this becomes useful in the later pan chapter.

- [ ] **Step 4: Author the Chapter 2 source**

Start from the complete Chapter 1 file, add `Group`, and replace the workspace
placeholder text with one concrete Idea card at workspace position `(92, 180)`.
Its root position is therefore `(92, 236)` after the fixed workspace offset.
Paint the card inside `<Group style={{ translateX: 92, translateY: 236 }}>`.
Use a rounded body, title, subtitle, and two 10-pixel ports; set every text/port
decoration to `pointerEvents="none"`.

The body style is exact:

```tsx
style={{
  width: 168,
  height: 84,
  fill: "#ff6b57",
  stroke: "#17211d",
  strokeWidth: 3,
  cornerRadius: 16,
}}
```

Use title baseline y=34 and subtitle baseline y=59. The output port center is
`(168, 42)` and the input port center is `(0, 42)` in card-local coordinates.

- [ ] **Step 5: Add both entries to the production tutorial catalog**

Use a `drafts` array whose record includes slug, chapter, title, source path,
and lazy load. Map it through `validateTutorialSnapshotCatalog()`. Do not add
ordinary-example fields such as browse group, prompts, API tags, or example
routes.

```ts
{
  slug: "diagram-editor-canvas-scene",
  tutorial: "diagram-editor",
  chapter: 1,
  title: "Create the Canvas scene",
  authoring: "jsx",
  canvas: { width: 960, height: 600 },
  source: {
    path: "packages/scenarios/src/tutorials/diagram-editor/01-canvas-scene.example.tsx",
  },
  load: () => import("./tutorials/diagram-editor/01-canvas-scene.example"),
}
```

Add the equivalent Chapter 2 record using its canonical names.

- [ ] **Step 6: Teach source discovery about tutorial paths**

Change `assertExampleSourceDiscovery()` to accept four lists:

```ts
export function assertExampleSourceDiscovery(
  discoveredPaths: readonly string[],
  scenarioCatalogPaths: readonly string[],
  learningCatalogPaths: readonly string[],
  tutorialCatalogPaths: readonly string[],
): void;
```

Classify paths containing `/learning/` as Learning, paths containing
`/tutorials/` as Tutorial, and everything else as Scenario. Extend the fixture
check with one cataloged tutorial source and one uncataloged tutorial source so
an omission fails with `Tutorial source discovery disagrees with the catalog`.

In `tooling/scenario-catalog.ts`, validate and load every tutorial source with
the learning-source policy. Add a generated **Tutorial snapshots** table between
Learning studio and Automated test labs with columns Chapter, Snapshot, Route,
and Canonical source. Derive the route suffix from the basename by removing its
two-digit prefix and `.example.tsx`, then render
`#/learn/tutorials/${entry.tutorial}/${routeSuffix}`; never route a snapshot
through Examples. Include the tutorial count in the generated introduction and
the validator's success/write messages. Regenerate the index with:

```sh
corepack pnpm@11.21.0 scenarios:write-index
```

- [ ] **Step 7: Author Chapter 1 Markdown**

Use summary `Mount a fixed logical Canvas and paint the three regions that frame the editor.`
and keywords `[diagram editor, tutorial, crc, canvas, disposal]`. The six
sections must cover:

- the visible three-region frame and changing `WORKFLOW MAP` as the exercise;
- ordinary synchronous components and a full traversal on render;
- `crc(canvas, <DiagramEditor />)` plus the stable controller;
- the fixed 960 by 600 logical viewport versus scaled CSS presentation;
- scheduled initial paint and idempotent `dispose()`;
- links to `#/api/functions/crc`, `#/api/components/rectangle`,
  `#/api/components/text`, and `#/learn/guides/configure-jsx`.

The check section says successful output shows all three regions and the status
copy; it warns that changing Canvas CSS size does not change this fixed logical
coordinate system.

- [ ] **Step 8: Author Chapter 2 Markdown**

Use summary `Compose Rectangle and Text primitives to place the first workflow node in local coordinates.`
and keywords `[diagram editor, tutorial, rectangle, text, group, style]`. Explain
closed local style, local card coordinates under the translated `Group`, and
decorative pointer opt-out. The exercise changes the Idea color and subtitle.
Link `#/api/components/group`, `#/api/components/rectangle`,
`#/api/components/text`, and `#/learn/guides/style-and-draw`.

The check section distinguishes workspace `(92, 180)`, root `(92, 236)`, and
card-local `(0, 0)`; it warns against adding the group translation to each child
again.

- [ ] **Step 9: Add the reusable mount/paint/dispose harness**

In `tutorial-snapshots.test.tsx`, create `renderTutorialSnapshot(slug)` by
following the existing public learning-example harness: create a 960 by 600
Canvas, intercept `fillText` to record transformed text positions, load the
catalog module, mount, and await two animation frames. Track controllers in
`afterEach` and remove canvases.

Add:

```ts
it.each(tutorialSnapshotCatalog)(
  "loads, mounts, paints, and disposes $slug",
  async (entry) => {
    const { canvas, controller } = await renderTutorialSnapshot(entry.slug);
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, 960, 600).data;
    expect(pixels.some((channel) => channel !== 0)).toBe(true);
    controller.dispose();
    controller.dispose();
    removeTrackedController(controller);
  },
  15_000,
);
```

Assert Chapter 2's latest text paints contain `IDEA` near root `(176, 270)` and
`Find the spark` below it.

- [ ] **Step 10: Add real-documentation assertions and run focused checks**

In `build.check.ts`, assert both new routes exist, have orders 1 and 2, point to
their exact snapshot slugs, and derive root/neighbor relationships. Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
```

Expected: PASS; the generated index reports two tutorial snapshots separately
from ordinary lessons and test labs.

- [ ] **Step 11: Commit Chapters 1-2**

```bash
git add packages/scenarios/src/tutorials/diagram-editor/01-canvas-scene.example.tsx packages/scenarios/src/tutorials/diagram-editor/02-first-node.example.tsx docs/site/learn/tutorials/diagram-editor/canvas-scene.md docs/site/learn/tutorials/diagram-editor/first-node.md packages/scenarios/src/tutorial-catalog.ts tooling/scenario-source-discovery.ts tooling/scenario-source-discovery.check.ts tooling/scenario-catalog.ts docs/scenario-index.md packages/core/test/tutorial-snapshots.test.tsx tooling/studio-docs/build.check.ts
git commit -m "docs(tutorial): create the Canvas and first node"
```

### Task 4: Publish Chapters 3-4 and Make the Diagram Data-Driven

**Files:**

- Create: `packages/scenarios/src/tutorials/diagram-editor/03-connect-nodes.example.tsx`
- Create: `packages/scenarios/src/tutorials/diagram-editor/04-reusable-node.example.tsx`
- Create: `docs/site/learn/tutorials/diagram-editor/connect-nodes.md`
- Create: `docs/site/learn/tutorials/diagram-editor/reusable-node.md`
- Modify: `packages/scenarios/src/tutorial-catalog.ts`
- Modify: `packages/core/test/tutorial-snapshots.test.tsx`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `docs/scenario-index.md` (generated)

**Interfaces:**

- Consumes: Chapters 1-2 visual constants, catalog conventions, and workbench route behavior.
- Produces: `connectionPath(from, to): Path2D`, `Connection`, `NodeCard`, the canonical node/edge model, and four-node data-driven paint order used by every later chapter.

- [ ] **Step 1: Add failing Chapter 3-4 catalog and rendering assertions**

Assert catalog slugs/orders 1-4, exact new paths, and exact real Markdown
routes. Add runtime assertions that Chapter 3 paints `IDEA` and `SKETCH`, and
that Chapter 4 paints each of `IDEA`, `SKETCH`, `BUILD`, and `SHIP` exactly once
in the last frame.

Wrap the Chapter 3 root context's `clearRect`, `stroke`, and `fill` methods and
record the current paint style for each call, segmented by frame. In the last
frame, assert an ink `stroke` occurs before the first fill whose `fillStyle` is
Idea's `#ff6b57`. Keep the assertion about operation order, not antialiased
pixels.

- [ ] **Step 2: Run the focused test and verify the new chapters are missing**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL with missing Chapter 3-4 catalog entries/routes.

- [ ] **Step 3: Author the Chapter 3 source**

Start with the complete Chapter 2 source and add Sketch at `(326, 92)` workspace
coordinates. Add `Path` and create the connector before either card:

```ts
function connectionPath(
  from: Readonly<{ x: number; y: number }>,
  to: Readonly<{ x: number; y: number }>,
): Path2D {
  const path = new Path2D();
  const bend = Math.max(56, Math.abs(to.x - from.x) * 0.5);
  path.moveTo(from.x, from.y);
  path.bezierCurveTo(from.x + bend, from.y, to.x - bend, to.y, to.x, to.y);
  return path;
}
```

Use endpoints Idea `(260, 222)` and Sketch `(326, 134)` in workspace
coordinates, then add `WORKSPACE_TOP` while this chapter still paints in root
coordinates. Paint the connection as a 4-pixel ink stroke and a small filled
ink arrowhead. Both use `pointerEvents="none"` and appear before both card
groups in the returned array.

- [ ] **Step 4: Author the Chapter 4 source**

Use the canonical editor model from Global Constraints. Define:

```ts
interface NodeCardProps {
  readonly node: DiagramNode;
}

function NodeCard({ node }: NodeCardProps) {
  return (
    <Group style={{ translateX: node.x, translateY: node.y }}>
      <Rectangle
        style={{
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          fill: node.color,
          stroke: "#17211d",
          strokeWidth: 3,
          cornerRadius: 16,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{ x: -5, y: 37, width: 10, height: 10, fill: "#17211d", cornerRadius: 5 }}
      />
      <Rectangle
        pointerEvents="none"
        style={{ x: 163, y: 37, width: 10, height: 10, fill: "#17211d", cornerRadius: 5 }}
      />
      <Text
        pointerEvents="none"
        style={{ x: 84, y: 34, fill: "#17211d", font: "900 16px sans-serif", textAlign: "center" }}
      >
        {node.title}
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 84, y: 59, fill: "#17211d", font: "600 13px sans-serif", textAlign: "center" }}
      >
        {node.subtitle}
      </Text>
    </Group>
  );
}

interface ConnectionProps {
  readonly edge: DiagramEdge;
  readonly nodes: readonly DiagramNode[];
}
```

`Connection` resolves `from` and `to` by stable ID, throws an actionable error
`Unknown node in edge "<id>".` if either endpoint is missing, and derives port
centers from `NODE_WIDTH`/`NODE_HEIGHT`. Return a fragment with
`EDGES.map((edge) => <Connection key={edge.id} edge={edge} nodes={INITIAL_NODES} />)`
before
`INITIAL_NODES.map((node) => <NodeCard key={node.id} node={node} />)`.

Chapter 4 workspace content is local: wrap it in
`<Group style={{ translateY: WORKSPACE_TOP }}>` so node data remains pure
workspace coordinates.

- [ ] **Step 5: Append catalog entries and author both chapter pages**

Append canonical entries 3 and 4, regenerate `docs/scenario-index.md`, and
author all six required headings per page.

Chapter 3 summary is `Draw a curved connection behind two cards and make paint order part of the design.`
Its exercise moves Sketch and updates the explicit connector endpoint. Explain
`Path2D`, cubic control points, source paint order, and why the edge must not win
input. Link `#/api/components/path`, `#/api/components/group`, and
`#/learn/guides/style-and-draw`.

Chapter 4 summary is `Turn four workflow records and four edges into keyed reusable components.`
Its exercise adds a temporary fifth node without an edge. Explain props,
fragments, array children, stable sibling keys, component-function identity,
and missing-node validation. Link
`#/learn/guides/components-props-and-children` and
`#/api/types/elements-components`.

- [ ] **Step 6: Run source, catalog, and documentation checks**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
```

Expected: PASS with four contiguous chapters and four tutorial snapshots.

- [ ] **Step 7: Commit Chapters 3-4**

```bash
git add packages/scenarios/src/tutorials/diagram-editor/03-connect-nodes.example.tsx packages/scenarios/src/tutorials/diagram-editor/04-reusable-node.example.tsx docs/site/learn/tutorials/diagram-editor/connect-nodes.md docs/site/learn/tutorials/diagram-editor/reusable-node.md packages/scenarios/src/tutorial-catalog.ts packages/core/test/tutorial-snapshots.test.tsx tooling/studio-docs/build.check.ts docs/scenario-index.md
git commit -m "docs(tutorial): connect reusable diagram nodes"
```

### Task 5: Publish Chapters 5-6 and Introduce Layout and Selection

**Files:**

- Create: `packages/scenarios/src/tutorials/diagram-editor/05-editor-chrome.example.tsx`
- Create: `packages/scenarios/src/tutorials/diagram-editor/06-selection.example.tsx`
- Create: `docs/site/learn/tutorials/diagram-editor/editor-chrome.md`
- Create: `docs/site/learn/tutorials/diagram-editor/selection.md`
- Modify: `packages/scenarios/src/tutorial-catalog.ts`
- Modify: `packages/core/test/tutorial-snapshots.test.tsx`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `docs/scenario-index.md` (generated)

**Interfaces:**

- Consumes: The four-node model and paint-order contract from Task 4.
- Produces: `Toolbar`, `Workspace`, and `StatusBar` layout receivers; `selectedNodeId` state; `NodeCard` selection props and target body; semantic selection evidence used by later interaction chapters.

- [ ] **Step 1: Add failing allocation and selection tests**

Add Chapter 5-6 catalog/path assertions. For Chapter 5, intercept transformed
rectangle geometry and assert the toolbar, workspace, and status allocations
resolve to `{ y: 0, height: 56 }`, `{ y: 56, height: 512 }`, and
`{ y: 568, height: 32 }` respectively.

For Chapter 6, render the canonical initial selection (`sketch`), assert the
status text contains `SELECTED · SKETCH`, click the Idea body at root logical
`(176, 278)`, await the next paint, and assert the latest status contains
`SELECTED · IDEA`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL because Chapter 5-6 sources and selection behavior are missing.

- [ ] **Step 3: Author the Chapter 5 layout source**

Use `Absolute`, `useLayoutBox`, `BoxStyle`, and `LayoutItemStyle`. Define one
shared receiver prop and three focused components:

```ts
interface RegionProps {
  readonly style: BoxStyle & LayoutItemStyle;
}

function Toolbar({ style: _specifiedStyle }: RegionProps) {
  const box = useLayoutBox();
  return <Rectangle style={{ width: box.width, height: box.height, fill: "#fffdf6" }} />;
}
```

`Workspace` uses its allocation's width/height for the workspace background and
returns connections before cards in local coordinates. `StatusBar` uses its
allocation to paint the dark bar and `READY · 100%`. Compose:

```tsx
<Absolute style={{ width: 960, height: 600 }}>
  <Toolbar style={{ left: 0, top: 0, width: "100%", height: 56 }} />
  <Workspace style={{ left: 0, top: 56, width: "100%", height: 512 }} />
  <StatusBar style={{ left: 0, top: 568, width: "100%", height: 32 }} />
</Absolute>
```

Paint an inert Reset view control at toolbar x=820, y=12, width=116, height=32.
Do not attach its click behavior yet. Do not forward the complete composite
style object into a child drawing primitive.

- [ ] **Step 4: Author the Chapter 6 selection source**

Add `useState<NodeId | null>("sketch")` in `DiagramEditor`. Pass selection and
handler props through `Workspace`:

```ts
interface NodeCardProps {
  readonly node: DiagramNode;
  readonly selected: boolean;
  readonly onSelect: () => void;
}
```

Attach `onClick={onSelect}` and `cursor: "pointer"` only to the rounded body.
Use selected stroke `#17211d` at width 5 and unselected stroke at width 3. Keep
title, subtitle, ports, and any selection accent non-targeting. The workspace
background clears selection on click. `StatusBar` receives the selected node
and paints `SELECTED · <TITLE>` or `NO SELECTION`, followed by `ZOOM · 100%`.

- [ ] **Step 5: Append catalog entries and author both chapter pages**

Append entries 5 and 6, regenerate the index, and author the six-section pages.

Chapter 5 summary is `Allocate toolbar, workspace, and status regions without mixing layout placement into drawing geometry.`
Its exercise changes region heights while preserving total height 600. Explain
specified style, `useLayoutBox()`, direct-child allocation, and double-placement
mistakes. Link `#/api/components/absolute`, `#/api/hooks/use-layout-box`,
`#/learn/guides/compose-and-layout`, and `#/api/types/layout`.

Chapter 6 summary is `Select a node through its painted body and render model state on the next scheduled frame.`
Its exercise toggles the selected node off when clicked again. Explain explicit
application IDs, `useState`, future coalesced paint, and decorative target
occlusion. Link `#/api/hooks/use-state`, `#/api/types/events`, and
`#/learn/guides/style-and-draw`.

- [ ] **Step 6: Run focused source, layout, and documentation checks**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 typecheck
```

Expected: PASS with six contiguous chapter routes and semantic selection proof.

- [ ] **Step 7: Commit Chapters 5-6**

```bash
git add packages/scenarios/src/tutorials/diagram-editor/05-editor-chrome.example.tsx packages/scenarios/src/tutorials/diagram-editor/06-selection.example.tsx docs/site/learn/tutorials/diagram-editor/editor-chrome.md docs/site/learn/tutorials/diagram-editor/selection.md packages/scenarios/src/tutorial-catalog.ts packages/core/test/tutorial-snapshots.test.tsx tooling/studio-docs/build.check.ts docs/scenario-index.md
git commit -m "docs(tutorial): lay out and select diagram nodes"
```

### Task 6: Publish Chapters 7-8 and Complete Pointer Navigation

**Files:**

- Create: `packages/scenarios/src/tutorials/diagram-editor/07-dragging.example.tsx`
- Create: `packages/scenarios/src/tutorials/diagram-editor/08-pan-and-zoom.example.tsx`
- Create: `docs/site/learn/tutorials/diagram-editor/dragging.md`
- Create: `docs/site/learn/tutorials/diagram-editor/pan-and-zoom.md`
- Modify: `packages/scenarios/src/tutorial-catalog.ts`
- Modify: `packages/core/test/support/user-input.ts`
- Modify: `packages/core/test/tutorial-snapshots.test.tsx`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `docs/scenario-index.md` (generated)

**Interfaces:**

- Consumes: Task 5 node selection, allocated workspace, stable node IDs, and status output.
- Produces: `NodeDragSession`, `PanSession`, `rootToWorkspace`, `zoomAroundPoint`, logical browser `dragPointerLogicalPoint()` and `wheelLogicalPoint()` test helpers, and a working Reset view control.

- [ ] **Step 1: Add real logical drag and wheel input helpers**

Extend `packages/core/test/support/user-input.ts` with these public test
signatures:

```ts
export async function dragPointerLogicalPoint(
  canvas: HTMLCanvasElement,
  from: MousePoint,
  to: MousePoint,
  intermediate: readonly MousePoint[] = [],
): Promise<void>;

export async function wheelLogicalPoint(
  canvas: HTMLCanvasElement,
  point: MousePoint,
  deltaY: number,
  deltaX = 0,
): Promise<void>;
```

Use the existing `logicalScreenPoint()` conversion. Drag dispatches CDP
`mousePressed`, each `mouseMoved` with `buttons: 1`, and `mouseReleased`, all
with `button: "left"` and `pointerType: "mouse"`. Wheel dispatches
`Input.dispatchMouseEvent` with `type: "mouseWheel"`, the converted point, and
the exact deltas.

- [ ] **Step 2: Add failing Chapter 7 drag assertions**

Render Chapter 7, record the latest transformed title positions, then drag Idea
from root `(176, 278)` through `(280, 420)` to `(360, 450)`. The final point is
outside Idea's original body. Before the gesture, add a capturing native
`pointerdown` listener to the Canvas and record its `pointerId`. Await a paint
and assert:

- latest `IDEA` text moved by approximately `(184, 172)` logical pixels;
- `SKETCH`, `BUILD`, and `SHIP` did not move;
- the Idea-to-Sketch connector's first path point moved with Idea;
- selection/status is still Idea;
- `canvas.hasPointerCapture(recordedPointerId)` is false after release.

For cancellation, press without releasing, dispatch a bubbling/cancelable
`PointerEvent("pointercancel", { pointerId: recordedPointerId })` at the Canvas,
then release the native mouse button and assert a later move cannot change the
node. In a separate mount, press, call
`canvas.releasePointerCapture(recordedPointerId)`, await the browser's
`lostpointercapture`, release, and make the same no-later-movement assertion.

- [ ] **Step 3: Run the drag test and verify Chapter 7 is missing**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL because Chapter 7 and its pointer handlers do not exist.

- [ ] **Step 4: Author the Chapter 7 source with synchronous gesture ownership**

Add `useRef` and `CRCPointerEvent`. Define:

```ts
interface NodeDragSession {
  readonly kind: "node";
  readonly pointerId: number;
  readonly nodeId: NodeId;
  readonly pointerStart: { readonly x: number; readonly y: number };
  readonly nodeStart: { readonly x: number; readonly y: number };
}
```

`DiagramEditor` owns `nodes` through `useState<readonly DiagramNode[]>(INITIAL_NODES)`
and `dragSession` through `useRef<NodeDragSession | null>(null)`. Pass one
handler object to each `NodeCard`. On pointer down:

```ts
const point = rootToWorkspace(event, INITIAL_VIEW);
event.currentTarget.setPointerCapture(event.pointerId);
dragSession.current = {
  kind: "node",
  pointerId: event.pointerId,
  nodeId: node.id,
  pointerStart: point,
  nodeStart: { x: node.x, y: node.y },
};
setSelectedNodeId(node.id);
```

On matching captured move, calculate the absolute next position from the stored
origins and use a functional immutable update:

```ts
setNodes((current) =>
  current.map((candidate) =>
    candidate.id === session.nodeId
      ? {
          ...candidate,
          x: session.nodeStart.x + point.x - session.pointerStart.x,
          y: session.nodeStart.y + point.y - session.pointerStart.y,
        }
      : candidate,
  ),
);
```

Clear the ref on matching pointer up, pointer cancel, and lost capture. Request
release on pointer up only while the current target still reports capture.
Connections consume current `nodes`, so no separate edge state is introduced.

- [ ] **Step 5: Add failing Chapter 8 pan, zoom, and reset assertions**

Render Chapter 8 and:

1. Drag empty workspace from root `(40, 520)` to `(140, 470)`; assert every node
   title moves by `(100, -50)` while pairwise node distances stay constant.
2. Wheel with `deltaY: -160` at `(480, 300)`; derive the workspace point before
   and after from observed geometry and assert it stays within 0.5 logical pixel.
3. Wheel repeatedly in both directions and assert status never reports below
   60% or above 180%.
4. Click Reset view at `(878, 28)` and assert node presentation returns to the
   initial view while any node movement performed before the pan remains in the
   model.
5. Spy on the native wheel event and assert it is default-prevented over the
   owned workspace.

- [ ] **Step 6: Run the focused test and verify Chapter 8 behavior is missing**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL with missing Chapter 8/catalog behavior.

- [ ] **Step 7: Author the Chapter 8 source**

Add the exact `ViewTransform`, `rootToWorkspace()`, and `zoomAroundPoint()` from
Global Constraints. Replace the node-only ref with:

```ts
interface PanSession {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly pointerStart: { readonly x: number; readonly y: number };
  readonly viewStart: Readonly<ViewTransform>;
}

type GestureSession = NodeDragSession | PanSession;
```

The workspace background owns pan pointer handlers. Its move updates only
`panX` and `panY` from the root-logical delta; do not divide that presentation
delta by zoom. Wrap workspace background plus transformed content in a
structural `Group` with `onWheel`. For every owned wheel event, call
`event.preventDefault()` and set view through `zoomAroundPoint(current, event,
event.deltaY)`.

Apply presentation only once:

```tsx
<Group
  style={{
    translateX: view.panX / view.zoom,
    translateY: view.panY / view.zoom,
    scaleX: view.zoom,
    scaleY: view.zoom,
  }}
>
  {connections}
  {nodes}
</Group>
```

CRC composes Group scale before translation. Dividing the stored root-pixel pan
by zoom keeps the final presentation translation equal to `panX`/`panY`;
alternatively, an equivalent explicit matrix composition would be acceptable.

Convert node drag points through the current view. Make Reset view's body an
actual click target that calls `setView(INITIAL_VIEW)` and uses `cursor:
"pointer"`. Status rounds `view.zoom * 100` for display.

- [ ] **Step 8: Append catalog entries and author both chapter pages**

Append entries 7 and 8, regenerate the index, and author the six-section pages.

Chapter 7 summary is `Keep a node drag owned after the pointer leaves its painted card.`
Teach pointer capture per pointer ID, root-logical coordinates, synchronous refs
versus frame-coalesced render state, immutable functional updates, and every
terminal cleanup path. The exercise clamps node position to x `-40..1232` and
y `-40..816`, leaving enough overscan for later panning. Link
`#/api/hooks/use-ref`, `#/api/types/events`, and
`#/learn/guides/state-and-lifecycle`.

Chapter 8 summary is `Pan empty workspace and zoom around the pointer without moving domain data.`
Teach inner workspace coordinates, outer `Group` presentation, inverse mapping,
wheel cancellation, zoom anchoring/clamping, and reset. The exercise changes
the exponent coefficient from `0.001` to `0.0015` and predicts that anchor
stability remains unchanged. Link `#/api/components/group`,
`#/api/types/styles`, and `#/api/types/events`.

- [ ] **Step 9: Run interaction and documentation checks**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx packages/core/test/learning-examples.test.ts
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
```

Expected: PASS with eight contiguous chapters and real captured drag/zoom
evidence.

- [ ] **Step 10: Commit Chapters 7-8**

```bash
git add packages/scenarios/src/tutorials/diagram-editor/07-dragging.example.tsx packages/scenarios/src/tutorials/diagram-editor/08-pan-and-zoom.example.tsx docs/site/learn/tutorials/diagram-editor/dragging.md docs/site/learn/tutorials/diagram-editor/pan-and-zoom.md packages/scenarios/src/tutorial-catalog.ts packages/core/test/support/user-input.ts packages/core/test/tutorial-snapshots.test.tsx tooling/studio-docs/build.check.ts docs/scenario-index.md
git commit -m "docs(tutorial): drag and navigate the diagram"
```

### Task 7: Publish Chapters 9-10 and Add Retained and Filtered Composition

**Files:**

- Create: `packages/scenarios/src/tutorials/diagram-editor/09-viewport-and-layer.example.tsx`
- Create: `packages/scenarios/src/tutorials/diagram-editor/10-filters.example.tsx`
- Create: `docs/site/learn/tutorials/diagram-editor/viewport-and-layer.md`
- Create: `docs/site/learn/tutorials/diagram-editor/filters.md`
- Modify: `packages/scenarios/src/tutorial-catalog.ts`
- Modify: `packages/core/test/tutorial-snapshots.test.tsx`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `docs/scenario-index.md` (generated)

**Interfaces:**

- Consumes: Task 6 view transform, gesture ownership, and connection/card ordering.
- Produces: Stable `GRID_DOTS`, local workspace `Clip`, grid-only `Layer`, selected-card typed filter boundary, and public behavior evidence for clip/hit alignment and layer reuse.

- [ ] **Step 1: Add failing clip and Layer-reuse tests**

Add Chapter 9 catalog/path assertions. Spy on
`OffscreenCanvasRenderingContext2D.prototype.fill` before mount, render Chapter
9, record the grid's offscreen fill count, pan empty workspace by `(80, -40)`,
and assert the count does not increase. Confirm root Canvas composition still
changes the visible node positions.

Pan upward far enough that Idea's transformed card would overlap toolbar space
without a clip. Click its would-be root position above y=56 and assert selection
does not change. Assert a point on the same card inside the viewport still
selects it after resetting view.

- [ ] **Step 2: Run the focused test and verify Chapter 9 is missing**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL because no Chapter 9 snapshot owns a clip or grid Layer.

- [ ] **Step 3: Author the Chapter 9 source**

Add `Clip`, `Layer`, and `Path`. Build stable module-owned paths once per
compiled snapshot:

```ts
function createGridPath(): Path2D {
  const path = new Path2D();
  for (let y = 20; y < 900; y += 24) {
    for (let x = 20; x < 1400; x += 24) {
      path.rect(x, y, 2, 2);
    }
  }
  return path;
}

const GRID_DOTS = createGridPath();
const WORKSPACE_CLIP = new Path2D();
WORKSPACE_CLIP.rect(0, 0, 960, 512);
```

Inside the allocated `Workspace`, use the style contract exactly:

```tsx
<Clip style={{ d: WORKSPACE_CLIP, width: 960, height: 512 }} onWheel={onWheel}>
  <Rectangle
    style={{ width: 960, height: 512, fill: "#eef2e8" }}
    {...panHandlers}
  />
  <Group style={viewPresentation}>
    <Layer style={{ width: 1400, height: 900 }}>
      <Path pointerEvents="none" style={{ d: GRID_DOTS, fill: "#c8d2c6" }} />
    </Layer>
    {connections}
    {nodes}
  </Group>
</Clip>
```

Keep the fixed workspace background outside the transformed `Group`, but inside
the Clip so it supplies empty-space hit geometry. Move the wheel propagation
listener from the former wrapper Group to Clip.

- [ ] **Step 4: Add failing filter-boundary and hit-geometry tests**

Render Chapter 10 and record offscreen composition calls for the initially
selected Sketch card. Click empty workspace to clear selection and assert the
next frame takes the direct path without executing a filter boundary. Click
Idea and assert one filtered combined subtree is executed at Idea's position.
Then click root `(268, 278)`, which is outside Idea's body but inside the visible
right-hand shadow region, and assert the workspace background clears selection
rather than reselecting Idea. Select Sketch again and confirm the filter
boundary moves with that card while node geometry remains unchanged.

- [ ] **Step 5: Run the focused test and verify Chapter 10 is missing**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL because Chapter 10/filter behavior is absent.

- [ ] **Step 6: Author the Chapter 10 source**

Place the filter on the `NodeCard` Group so body, labels, and ports form one
silhouette:

```tsx
<Group
  style={{
    translateX: node.x,
    translateY: node.y,
    filter: selected
      ? {
          type: "dropShadow",
          offsetX: 6,
          offsetY: 8,
          blurRadius: 10,
          color: "rgb(23 33 29 / 35%)",
        }
      : [],
  }}
>
  {cardPaint}
</Group>
```

Do not put the filter on individual card children. Keep `[]` for the unselected
direct path. Do not alter layout, pointer, focus, or navigation bounds to match
blurred pixels.

- [ ] **Step 7: Append catalog entries and author both chapter pages**

Append entries 9 and 10 and regenerate the index.

Chapter 9 summary is `Crop transformed content and retain only the stable dot-grid subtree.`
Teach Clip path geometry, shared paint/hit clipping, Layer's explicit ownership,
upright local surfaces, outer presentation reuse, and `OffscreenCanvas`
requirements. The exercise moves the clip's right edge to x=760 and predicts
both hidden pixels and untargetable content. Link `#/api/components/clip`,
`#/api/components/layer`, `#/api/components/path`, and
`#/learn/guides/style-and-draw`.

Chapter 10 summary is `Filter one selected card as a combined silhouette without enlarging its target.`
Teach typed descriptor order, combined subtree capture, inside-out nesting,
`[]` capability-free behavior, and pixels-versus-geometry. The exercise changes
the filter using these complete bindings:

```ts
const brightness: CRCBrightnessFilter = {
  type: "brightness",
  amount: 1.08,
};
const dropShadow: CRCDropShadowFilter = {
  type: "dropShadow",
  offsetX: 6,
  offsetY: 8,
  blurRadius: 10,
  color: "rgb(23 33 29 / 35%)",
};
const selectedFilters: readonly CRCFilter[] = [brightness, dropShadow];
```

The page tells the learner to add the three public filter types to the existing
`@crc/core` import, use `selectedFilters` for the selected branch, then reverse
the array and predict the visible difference. Link `#/api/types/filters` and
`#/learn/guides/style-and-draw`.

- [ ] **Step 8: Run composition, source, and documentation checks**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 typecheck
```

Expected: PASS with ten contiguous snapshots, one clean retained grid, and
filter pixels that do not acquire hit geometry.

- [ ] **Step 9: Commit Chapters 9-10**

```bash
git add packages/scenarios/src/tutorials/diagram-editor/09-viewport-and-layer.example.tsx packages/scenarios/src/tutorials/diagram-editor/10-filters.example.tsx docs/site/learn/tutorials/diagram-editor/viewport-and-layer.md docs/site/learn/tutorials/diagram-editor/filters.md packages/scenarios/src/tutorial-catalog.ts packages/core/test/tutorial-snapshots.test.tsx tooling/studio-docs/build.check.ts docs/scenario-index.md
git commit -m "docs(tutorial): clip cache and filter the editor"
```

### Task 8: Publish Chapters 11-12 and Complete the Editor

**Files:**

- Create: `packages/scenarios/src/tutorials/diagram-editor/11-keyboard-interaction.example.tsx`
- Create: `packages/scenarios/src/tutorials/diagram-editor/12-finished-editor.example.tsx`
- Create: `docs/site/learn/tutorials/diagram-editor/keyboard-interaction.md`
- Create: `docs/site/learn/tutorials/diagram-editor/finished-editor.md`
- Modify: `packages/scenarios/src/tutorial-catalog.ts`
- Modify: `packages/core/test/tutorial-snapshots.test.tsx`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `tooling/studio-docs/search-index.check.ts`
- Modify: `playground/test/markdown-page.test.ts`
- Modify: `packages/core/test/share-code.test.ts`
- Modify: `docs/scenario-index.md` (generated)

**Interfaces:**

- Consumes: Task 7 complete pointer editor, clip/layer/filter composition, and Task 1 terminal pagination.
- Produces: `NodeCard` and Reset custom focus targets, focus-visible paint, complete final snapshot, exact twelve-entry catalog, and a shareable canonical final source.

- [ ] **Step 1: Add failing keyboard and focus tests**

Add Chapter 11-12 path assertions. Render Chapter 11, call `tab()` twice to
move from the page into Reset view and then Idea, press Enter, and assert status
reports `SELECTED · IDEA`. Press
`ArrowUp` and Enter and assert `SELECTED · SKETCH`. Reverse Tab and assert the
focus moves back to Idea, reverse Tab again to Reset view, then reverse Tab once
more and assert the Canvas naturally relinquishes focus at its source-order edge
rather than wrapping.

Wrap `CanvasRenderingContext2D.prototype.clearRect` and `stroke` in the harness
to segment paint calls by frame and record `{ strokeStyle, lineWidth }` at each
stroke. Assert the final keyboard-focus frame contains the paper focus stroke
`{ strokeStyle: "#fffdf6", lineWidth: 3 }`, while the frame after pointer
activation does not. Assert one HTML Canvas remains the only native focus host
and no generated DOM nodes represent diagram cards.

- [ ] **Step 2: Run the focused test and verify focus support is missing**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL because Chapter 11-12 and logical focus targets are absent.

- [ ] **Step 3: Author the Chapter 11 source with one conceptual target per control**

Add `FocusManagement`, `KeyboardNavigation`, `useEventTarget`, and
`useRectPath`. In `NodeCard`, create the local rounded target and register all
click, pointer, and focus handlers together:

```ts
const targetPath = useRectPath(0, 0, NODE_WIDTH, NODE_HEIGHT, {
  cornerRadius: 16,
});
const focus = useEventTarget(
  {
    onClick: onSelect,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
  },
  {
    path: targetPath,
    fill: true,
    cursor: dragActive ? "grabbing" : "grab",
    keyboardNavigationBounds: {
      x: 0,
      y: 0,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    },
  },
);
```

Mark every drawing child, including the rounded body, `pointerEvents="none"` so
the custom target is the only logical card target. Paint focus-visible with a
contrasting 3-pixel paper outer ring plus ink inner stroke; selected and focused
states must remain visually distinguishable.

Use the same pattern for Reset view with a local target path matching x=820,
y=12, width=116, height=32 and the same click action as pointer input. Compose
exactly one child under each policy:

```tsx
return crc(
  canvas,
  <FocusManagement>
    <KeyboardNavigation mode="directional">
      <DiagramEditor />
    </KeyboardNavigation>
  </FocusManagement>,
);
```

Do not add DOM mirrors, roles, ARIA descendants, imperative logical focus, or a
second keyboard event system.

- [ ] **Step 4: Add failing final-editor and final-catalog checks**

Assert the real catalog has exactly twelve entries, chapters equal `1..12`, all
slugs/paths equal the Canonical Tutorial Vocabulary table, and all Canvas sizes
equal 960 by 600. Render Chapter 12 and exercise this full flow:

1. select Idea;
2. drag Idea outside its original body;
3. pan empty workspace;
4. zoom around a pointer and stay within clamp;
5. click Reset view without restoring moved node data;
6. keyboard-focus and activate Sketch;
7. dispose twice and confirm no later event changes pixels.

Assert `getWorkbenchEntryBySlug("diagram-editor-finished")` returns the tutorial
entry, while public Examples navigation and search inputs contain no tutorial
snapshot slug.

- [ ] **Step 5: Run the focused test and verify final hardening is missing**

Run: `corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx`

Expected: FAIL on missing Chapter 12 and/or the twelve-entry catalog.

- [ ] **Step 6: Author the Chapter 12 source**

Start from the complete Chapter 11 source and make only purposeful hardening
changes:

- extract this pure domain update:

  ```ts
  function updateNodePosition(
    nodes: readonly DiagramNode[],
    id: NodeId,
    point: Readonly<{ x: number; y: number }>,
  ): readonly DiagramNode[] {
    return nodes.map((node) =>
      node.id === id ? { ...node, x: point.x, y: point.y } : node,
    );
  }
  ```

- keep `rootToWorkspace()` and `zoomAroundPoint()` as pure named helpers;
- use `useMemo(() => createGridPath(), [])` inside `GridLayer` so expensive grid
  geometry is instance-owned and stable;
- keep gesture refs for synchronous browser ownership, not presentation state;
- let each `NodeCard` own its node-drag ref and cursor state so unmounting the
  target destroys its active session, while `Workspace` separately owns the pan
  ref and pan cursor state;
- terminate each target-local session only when it owns the exact pointer ID;
- retain stable keys and data-driven edges;
- set final toolbar hint to `DRAG NODES · DRAG SPACE · WHEEL TO ZOOM`;
- set final initial selection to Sketch so the landing capture visibly
  demonstrates the filter;
- do not add `useWhenChanged` because the snapshot owns no external resource
  that needs synchronization.

Keep the source readable enough to teach: helpers precede components, model
types precede data, and the mount remains the final declaration.

- [ ] **Step 7: Prove every chapter remains shareable**

In `share-code.test.ts`, iterate all twelve catalog entries. Derive each chapter
route from its canonical source basename, read the raw source, change only the
first `WORKFLOW MAP` to `MY WORKFLOW`, and call `encodeCodeRoute(route, edited,
canonical)`. Assert `tooLong` is false, decoding returns that route, and decoded
code reproduces the edit. If any source fails, simplify repeated display
constants or prose inside that source; do not raise the 16,000-character public
URL limit and do not import shared tutorial code.

- [ ] **Step 8: Author the final two chapter pages**

Chapter 11 summary is `Traverse explicit Canvas targets, render focus-visible state, and activate the same model actions from the keyboard.`
Teach the one native Canvas focus host, custom target geometry, decorative
paint opt-out, source-order Tab, directional finite bounds, Enter/Space
activation, focus-visible modality, natural exit, and the semantic-accessibility
boundary. Include the concrete recommendation of a synchronized semantic
node/relationship list with equivalent actions. Link
`#/api/components/focus-management`,
`#/api/components/keyboard-navigation`, `#/api/hooks/use-event-target`,
`#/api/hooks/use-rect-path`, `#/api/types/events`, and
`#/learn/guides/focus-and-keyboard`.

Chapter 12 summary is `Review the complete editor, harden ownership and identity, and separate tutorial completeness from production readiness.`
Teach the final helper organization, purposeful `useMemo`, gesture teardown,
component/key identity, render-failure resource cleanup, already-painted-pixel
behavior, browser authority, capability requirements, and the production
checklist. Explicitly explain why `useWhenChanged` is absent. Its exercise
changes `INITIAL_NODES` while preserving all derived interactions. Link
`#/api/hooks/use-memo`, `#/api/hooks/use-when-changed`,
`#/api/hooks/use-ref`, `#/learn/guides/state-and-lifecycle`,
`#/learn/guides/focus-and-keyboard`, and `#/learn/guides/style-and-draw`. Do not
claim that the final Canvas alone is screen-reader-accessible.

- [ ] **Step 9: Append final catalog entries, regenerate the index, and verify pagination**

Append entries 11-12 and regenerate `docs/scenario-index.md`. In
`build.check.ts`, walk the Canonical Tutorial Vocabulary table and assert each
real page's title, `tutorial`, order, and `exampleSlug` match the corresponding
catalog record. Assert every page's level-two heading text, in order, is exactly
`What you will make`, `How it works`, `Build the change`, `Predict and try`,
`Check your result`, and `What you learned`. Assert all twelve pages have
contiguous relationships and Chapter 12 has no `next`. In
`markdown-page.test.ts`, use Chapter 12's relationship to assert the terminal
`Back to the tutorial overview` action. In `search-index.check.ts`, assert a
query for `pointer capture diagram editor` returns Chapter 7. For each chapter
route, assert exactly seven Learn records: one root plus the six required
level-two sections. Also assert no tutorial snapshot slug appears as an
independent search record.

- [ ] **Step 10: Run the complete focused tutorial gate**

Run:

```sh
corepack pnpm@11.21.0 exec vitest run packages/core/test/tutorial-snapshots.test.tsx playground/test/markdown-page.test.ts packages/core/test/share-code.test.ts
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 typecheck
```

Expected: PASS with twelve complete snapshots and no new public Examples/search
records.

- [ ] **Step 11: Commit Chapters 11-12**

```bash
git add packages/scenarios/src/tutorials/diagram-editor/11-keyboard-interaction.example.tsx packages/scenarios/src/tutorials/diagram-editor/12-finished-editor.example.tsx docs/site/learn/tutorials/diagram-editor/keyboard-interaction.md docs/site/learn/tutorials/diagram-editor/finished-editor.md packages/scenarios/src/tutorial-catalog.ts packages/core/test/tutorial-snapshots.test.tsx tooling/studio-docs/build.check.ts tooling/studio-docs/search-index.check.ts playground/test/markdown-page.test.ts packages/core/test/share-code.test.ts docs/scenario-index.md
git commit -m "docs(tutorial): finish the keyboard-operable editor"
```

### Task 9: Turn the Tutorial Landing Page Into an Outcome-First Invitation

**Files:**

- Modify: `docs/site/learn/tutorials/diagram-editor/index.md`
- Create: `tooling/verify-diagram-editor-teaser.mjs`
- Create: `playground/public/tutorials/diagram-editor/finished-editor.png` (generated and reviewed)
- Modify: `playground/src/style.css`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `tooling/verify-studio-visuals.mjs`
- Modify: `package.json`
- Create: `packages/core/test/visual-baselines/studio-diagram-editor-landing.expected.png` (generated and reviewed)
- Create: `packages/core/test/visual-baselines/studio-diagram-editor-finished.expected.png` (generated and reviewed)

**Interfaces:**

- Consumes: Task 8 canonical Chapter 12 route and finished 960 by 600 snapshot.
- Produces: A checked public teaser image, Start/Finished landing links, one teaser verification script, and two explicit Studio visual routes.

- [ ] **Step 1: Add failing landing-content assertions**

In `tooling/studio-docs/build.check.ts`, assert the real tutorial root's HTML
and internal links contain:

```ts
const landing = real.pageByRoute["#/learn/tutorials/diagram-editor"];
assert.match(landing.html, /finished-editor\.png/u);
assert.deepEqual(
  landing.internalLinks
    .filter(({ href }) => href.includes("/diagram-editor/"))
    .map(({ href }) => href),
  [
    "#/learn/tutorials/diagram-editor/finished-editor",
    "#/learn/tutorials/diagram-editor/canvas-scene",
    "#/learn/tutorials/diagram-editor/finished-editor",
    "#/learn/tutorials/diagram-editor/canvas-scene",
    "#/learn/tutorials/diagram-editor/first-node",
    "#/learn/tutorials/diagram-editor/connect-nodes",
    "#/learn/tutorials/diagram-editor/reusable-node",
    "#/learn/tutorials/diagram-editor/editor-chrome",
    "#/learn/tutorials/diagram-editor/selection",
    "#/learn/tutorials/diagram-editor/dragging",
    "#/learn/tutorials/diagram-editor/pan-and-zoom",
    "#/learn/tutorials/diagram-editor/viewport-and-layer",
    "#/learn/tutorials/diagram-editor/filters",
    "#/learn/tutorials/diagram-editor/keyboard-interaction",
    "#/learn/tutorials/diagram-editor/finished-editor",
  ],
);
assert.doesNotMatch(landing.plainText, /forthcoming|not published yet/u);
assert.equal(landing.frontmatter.exampleSlug, undefined);
```

- [ ] **Step 2: Run the documentation build check and verify the old landing fails**

Run: `corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts`

Expected: FAIL because the root still says the chapters are forthcoming and has
no teaser or working chapter links.

- [ ] **Step 3: Write the teaser capture/check program**

Create `tooling/verify-diagram-editor-teaser.mjs` using the same strict port,
server lifecycle, Chromium settings, and `finally` cleanup pattern as
`verify-studio-visuals.mjs`. Default port is 4175 and environment override is
`CRC_DIAGRAM_TUTORIAL_PREVIEW_PORT`.

The script must:

1. start Vite preview for the already-built `playground/dist`;
2. open `#/learn/tutorials/diagram-editor/finished-editor`;
3. wait for `Live · changes run automatically`;
4. assert exactly one iframe with `sandbox="allow-scripts"`;
5. enter that frame, await `document.fonts.ready` and two animation frames;
6. call the inner 960 by 600 Canvas's `toDataURL("image/png")` so CSS scaling
   cannot change the public asset dimensions;
7. in default mode, compare decoded width, height, and every RGBA pixel to
   `playground/public/tutorials/diagram-editor/finished-editor.png`;
8. in `--update` mode, write that exact decoded PNG and print its path;
9. always close Chromium and terminate the preview server.

Use the existing pixel-comparison approach; do not compare PNG container bytes
or tolerate unexplained pixel differences.

- [ ] **Step 4: Add scripts and verify the missing teaser fails**

Add:

```json
"test:tutorial-teaser": "corepack pnpm@11.21.0 playground:build && node tooling/verify-diagram-editor-teaser.mjs",
"test:tutorial-teaser:update": "corepack pnpm@11.21.0 playground:build && node tooling/verify-diagram-editor-teaser.mjs --update"
```

Also insert `node tooling/verify-diagram-editor-teaser.mjs` immediately after
the shared Playground build in `test:studio-visual`, and insert the `--update`
form in the same position in `test:studio-visual:update`. The existing Studio
visual command must therefore prove that the committed teaser still matches
the canonical finished editor; `trust` already reaches that command and needs
no separate wiring.

Run: `corepack pnpm@11.21.0 test:tutorial-teaser`

Expected: FAIL with the exact missing public teaser path.

- [ ] **Step 5: Capture and inspect the canonical teaser**

Run: `corepack pnpm@11.21.0 test:tutorial-teaser:update`

Open `playground/public/tutorials/diagram-editor/finished-editor.png` and verify
the dimensions are 960 by 600, Sketch is visibly selected/filtered, all four
cards and four connectors are legible, toolbar/status are not clipped, and no
focus ring or transient gesture is present.

Run: `corepack pnpm@11.21.0 test:tutorial-teaser`

Expected: PASS with zero differing pixels.

- [ ] **Step 6: Rewrite the tutorial landing page**

Retain its stable frontmatter ID/slug/tutorial. Replace `forthcoming` in summary
and body. Use this opening structure before prerequisites and curriculum:

```markdown
## See what you will build

[![A workflow diagram editor with four connected cards, a selected Sketch card, toolbar, and status strip.](/tutorials/diagram-editor/finished-editor.png)](#/learn/tutorials/diagram-editor/finished-editor)

Build a small but real Canvas editor, one visible capability at a time. Every
chapter is complete, editable, resettable, and independently runnable.

**[Start building →](#/learn/tutorials/diagram-editor/canvas-scene)** ·
[Open the finished editor](#/learn/tutorials/diagram-editor/finished-editor)
```

Add **Before you start**, **Curriculum**, and **How the course works** headings.
Link all twelve chapter titles in order. State that local toolchain setup belongs
in Configure JSX, non-JSX is a separate supported guide, edits do not cross
chapters, and creation/deletion/persistence/undo are not tutorial features.

- [ ] **Step 7: Style public documentation images without special raw HTML**

In `playground/src/style.css`, style `.documentation-body img` with
`display:block`, `max-width:100%`, `height:auto`, the existing heavy border,
paper background, and existing shadow. Give an image nested inside an anchor a
clear focus outline through the anchor's `:focus-visible` state. Do not add raw
HTML, a Markdown directive, a live landing workbench, or text-specific link
class heuristics.

- [ ] **Step 8: Add the two visual routes**

Extend `verify-studio-visuals.mjs` route records with an optional
`captureSelector`. Add:

```js
{
  name: "diagram-editor-landing",
  hash: "#/learn/tutorials/diagram-editor",
  ready: "img[src$='/tutorials/diagram-editor/finished-editor.png']",
},
{
  name: "diagram-editor-finished",
  hash: "#/learn/tutorials/diagram-editor/finished-editor",
  ready: ".studio-preview__frame",
  waitForWorkbench: true,
  captureSelector: ".studio-preview__frame",
},
```

Generalize the existing example-only workbench readiness check to the explicit
`waitForWorkbench` flag. Capture full page when `captureSelector` is absent and
the selected element when present. Keep all previous route results and
baselines unchanged.

- [ ] **Step 9: Generate and inspect both new visual baselines**

Run: `corepack pnpm@11.21.0 test:studio-visual:update`

Inspect:

- `test-screenshots/studio/diagram-editor-landing.actual.png` against the
  complete landing layout;
- `test-screenshots/studio/diagram-editor-finished.actual.png` against the
  workbench iframe capture;
- every previously existing baseline diff, which must remain empty unless this
  task intentionally changed shared image styling on a page that contains an
  image.

Then run: `corepack pnpm@11.21.0 test:studio-visual`

Expected: PASS with eight matched visual baselines and zero teaser-pixel
differences.

- [ ] **Step 10: Run focused landing and documentation checks**

Run:

```sh
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 test:tutorial-teaser
corepack pnpm@11.21.0 test:studio-visual
```

Expected: PASS; the landing image precedes curriculum links and the finished
action resolves to Chapter 12.

- [ ] **Step 11: Commit the outcome-first landing**

```bash
git add docs/site/learn/tutorials/diagram-editor/index.md tooling/verify-diagram-editor-teaser.mjs playground/public/tutorials/diagram-editor/finished-editor.png playground/src/style.css tooling/studio-docs/build.check.ts tooling/verify-studio-visuals.mjs package.json packages/core/test/visual-baselines/studio-diagram-editor-landing.expected.png packages/core/test/visual-baselines/studio-diagram-editor-finished.expected.png
git commit -m "docs(tutorial): preview the finished diagram editor"
```

### Task 10: Close Browser Acceptance and Durable Verification

**Files:**

- Modify: `tooling/verify-studio-docs.mjs`
- Modify: `tooling/verify-docs.mjs`
- Modify: `docs/documentation-follow-up.md`
- Create: `docs/testing/field-notes/2026-09-13-diagram-editor-tutorial.md`

**Interfaces:**

- Consumes: All twelve public routes, snapshots, generated relationships, teaser check, and visual baselines.
- Produces: End-to-end Studio acceptance, updated documentation inventories, a closed deferred-work record, and fresh durable trust-gate evidence.

- [ ] **Step 1: Add real-route acceptance**

Extend `verify-studio-docs.mjs` with the twelve route suffixes from Canonical
Tutorial Vocabulary. At desktop width, visit the landing and assert the teaser
image precedes the Curriculum heading, Start opens Chapter 1, and Finished opens
Chapter 12. For every chapter route:

- assert the expected h1 and chapter number;
- wait for `Live · changes run automatically`;
- assert exactly one iframe with `sandbox="allow-scripts"`;
- assert previous/next labels and routes match numeric order;
- assert Chapter 1 previous returns to the root;
- assert Chapter 12 renders `Back to the tutorial overview` and no next link.

On Chapters 6 and 12, exercise Reset and Share. Navigate away from Chapter 12,
then assert its iframe and Monaco model are removed before the next page is
ready. At the existing narrow viewport, visit the landing and one middle chapter
and assert the image, workbench tools, and pagination fit without horizontal
page overflow.

- [ ] **Step 2: Run browser acceptance and surface any integration gap**

Run: `corepack pnpm@11.21.0 test:studio-docs`

Expected: PASS after Tasks 1-9. Any failure is a real integration gap that the
focused source/manifest tests did not cover; retain the new assertion and
continue to Step 3.

- [ ] **Step 3: Fix only evidence-backed route or lifecycle gaps**

Use the failure to correct page relationship serialization, route labels,
workbench disposal, responsive CSS, or chapter metadata. Do not weaken the
acceptance loop, skip a chapter, add time-only waits, or duplicate the final
snapshot as an Examples route.

- [ ] **Step 4: Run the complete focused documentation and tutorial suite**

Run:

```sh
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 test:studio-docs
corepack pnpm@11.21.0 test:tutorial-teaser
corepack pnpm@11.21.0 test:studio-visual
```

`docs:check` is expected to fail first because twelve new public Markdown paths
are not yet in the explicit public-site inventory. All earlier commands must
already pass.

- [ ] **Step 5: Reconcile documentation inventories without overwriting unrelated work**

Add the twelve exact chapter Markdown paths to `publicSiteMarkdownPaths` in
`tooling/verify-docs.mjs`, immediately after the tutorial root and in chapter
order. Preserve the existing uncommitted
`docs/strategy/particle-effects-research.md` entry and any other unrelated
working-tree changes; they are not part of this tutorial commit.

Run the mutation verifier through `corepack pnpm@11.21.0 docs:check`. Do not
change `tooling/docs-contract-preservation-baseline.json`, translation
allowlists, or the reviewed contract-manifest hash: the tutorial adds public
learning material and does not change implemented runtime contracts.

- [ ] **Step 6: Close the deferred-work record**

In `docs/documentation-follow-up.md`, replace the statements that the tutorial
is only a syllabus or that its twelve chapters are deferred. Record that the
complete source-backed course now lives under the canonical tutorial route and
that framework migration, versioning, analytics, prerendering, and hosted search
remain independent future decisions.

- [ ] **Step 7: Run the proportional static and browser gate**

Run:

```sh
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
corepack pnpm@11.21.0 test:studio-docs
corepack pnpm@11.21.0 test:tutorial-teaser
corepack pnpm@11.21.0 test:studio-visual
```

Expected: every command exits 0. Inspect generated build output and visual
actuals before continuing.

- [ ] **Step 8: Commit the completed implementation and acceptance**

Stage every tutorial-owned file from this task. Because
`tooling/verify-docs.mjs` already has an unrelated particle-effects hunk in the
current worktree, use an interactive hunk review for that file and stage only
the twelve tutorial paths if the unrelated hunk is still uncommitted:

```bash
git add tooling/verify-studio-docs.mjs docs/documentation-follow-up.md
git add -p tooling/verify-docs.mjs
git diff --cached --check
git commit -m "test(tutorial): verify the diagram editor course"
```

Verify the staged diff contains no
`docs/strategy/particle-effects-research.md` change.

- [ ] **Step 9: Run the aggregate trust gate on the committed implementation revision**

Record `git rev-parse HEAD`, `node --version`, and
`corepack pnpm@11.21.0 --version`, then run:

```sh
corepack pnpm@11.21.0 trust
```

Expected: exit 0 across static, package, browser, visual, built-smoke,
lifecycle, and structural-performance gates. If any failure occurs, fix the
root cause in a focused commit and rerun the complete aggregate gate; do not
report the earlier partial run as success.

- [ ] **Step 10: Write the field note from fresh output**

Create `docs/testing/field-notes/2026-09-13-diagram-editor-tutorial.md` with:

- historical status `IMPLEMENTATION FIELD NOTE`;
- the exact implementation revision tested;
- OS/architecture, Node, pnpm, Playwright, and Chromium versions;
- a table of the focused commands and their fresh results;
- aggregate gate exit status and the exact current totals printed by that run,
  without copying totals from older notes;
- the two new visual baselines and why each intentional change is correct;
- confirmation that the teaser came from Chapter 12 and matched zero pixels;
- confirmation that tutorial snapshots remain absent from Examples/search/test
  labs;
- any skipped tests or platform limitations exactly as printed.

- [ ] **Step 11: Refresh documentation evidence and commit the field note**

The existing historical-field-note discovery pattern includes the new file
without an explicit path entry. Run:

```sh
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 lint:format
git diff --check
```

Expected: PASS. Commit only the field note and its required inventory evidence:

```bash
git add docs/testing/field-notes/2026-09-13-diagram-editor-tutorial.md
git commit -m "docs(tutorial): record diagram editor verification"
```

Do not include unrelated working-tree files.

## Completion Audit

Before declaring the plan complete, verify each approved acceptance criterion
against current evidence:

1. Open the landing and confirm the teaser appears before curriculum plus exact
   Chapter 1 and Chapter 12 actions.
2. Compare the twelve frontmatter records, routes, catalog entries, source
   files, and generated relationship metadata one-for-one.
3. Run the Chapter 12 full pointer/keyboard flow and confirm every final editor
   behavior comes from public CRC APIs.
4. Search tutorial prose for inaccurate claims about retained scenes,
   root-logical/workspace coordinates, pointer participation, Layer/filter
   capability, or semantic accessibility.
5. Inspect Examples navigation, search records, Test Labs, and generated
   `docs/scenario-index.md` to prove tutorial snapshots remain a separate
   category.
6. Confirm every snapshot passes source shape, typecheck, mount, nontransparent
   paint, and idempotent disposal.
7. Inspect expected, actual, and diff output for the landing and completed
   editor rather than relying only on a zero exit code.
8. Confirm existing learning-example routes, sandbox/reset/share behavior,
   source-mode/built-mode Studio, and lifecycle tests still pass.
9. Confirm the field note names the exact tested revision/environment and only
   fresh totals.
10. Confirm `corepack pnpm@11.21.0 trust` passed after the final implementation
    fixes and before the field note was written.
