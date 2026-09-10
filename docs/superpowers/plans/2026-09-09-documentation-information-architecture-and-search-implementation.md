# Documentation Information Architecture and Search Implementation Plan

> **Historical status: APPROVED IMPLEMENTATION PLAN.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing CRC Vite Studio into one searchable Learn, API, and Examples documentation experience while preserving live examples, test labs, and legacy links.

**Architecture:** A Vite plugin reads validated Markdown under `docs/site`, combines it with the typed example catalog, and exposes a virtual documentation manifest plus a serialized MiniSearch index. The framework-free browser app gains focused router, navigation, Markdown, and search modules while retaining its existing Canvas workbench and testing adapters.

**Tech Stack:** TypeScript 7, Vite 8, pnpm 11.21.0, `markdown-it` 15.0.1, `yaml` 2.9.0, MiniSearch 7.2.0, Vitest browser mode, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-09-documentation-information-architecture-and-search-design.md`

## Global Constraints

- Use Node 24.15 or newer on the Node 24 LTS line and pnpm 11.21.0.
- Keep `playground` as the only application and deployable artifact; add no backend, SSR, prerenderer, hosted search, or second UI framework.
- Only `docs/site/**` is public Markdown input. Never implicitly publish `docs/design`, `docs/architecture`, `docs/testing`, `docs/project-plans`, `docs/superpowers`, or `_bmad-output`.
- Preserve canonical `*.example.tsx` source, Monaco editing, reset/share behavior, source/built modes, and all headless scenario consumers.
- Keep Automated Test Labs separate from Learn/API/Examples and exclude them from global search.
- Tutorial and guide order is curated. API entries and example entries are alphabetized by normalized English display title within their approved groups.
- Filters browse under Drawing. Getting Started and Author without JSX browse under Learn.
- Markdown must not execute raw HTML or scripts.
- All old `#/examples/<section>/<slug>` and `#/scenarios...` links must redirect to validated canonical routes.
- Define observable behavior in a failing test before production code. Use exact state, routes, and semantic assertions before visual evidence.
- Do not rewrite visual baselines merely to make a check pass; inspect expected, actual, and diff output for every intentional update.
- Preserve unrelated working-tree changes and untracked files.

## File and responsibility map

### Build-time documentation system

- `tooling/studio-docs/model.ts` — public frontmatter, normalized page, heading, route, and manifest types plus validation.
- `tooling/studio-docs/markdown.ts` — frontmatter parsing, safe Markdown rendering, stable heading anchors, plain-text/section extraction, and internal-link collection.
- `tooling/studio-docs/api-exports.ts` — TypeScript-compiler inventory of supported `@crc/core` entry-point exports and exact API coverage validation.
- `tooling/studio-docs/search-index.ts` — search-record construction, camel-case tokenization, MiniSearch configuration, deterministic serialization, and testable query helper.
- `tooling/studio-docs/build.ts` — discover `docs/site`, combine pages/examples, validate cross-links/routes/order, and return one `StudioDocumentationBuild`.
- `tooling/studio-docs/vite-plugin.ts` — Vite virtual-module adapter and development invalidation.
- `tooling/studio-docs/studio-docs.check.ts` — Node-side fixture and real-repository checks for the complete build-time subsystem.
- `playground/src/studio-docs.d.ts` — browser-facing declaration for `virtual:crc-studio-docs`.

### Browser application

- `playground/src/app/routes.ts` — parse, canonicalize, and serialize every Studio route without rendering.
- `playground/src/app/navigation.ts` — derive Learn/API/Examples navigation, alphabetical groups, active ancestry, and persisted expansion keys.
- `playground/src/app/shell.ts` — construct the shared desktop/mobile shell, skip link, navigation host, and route announcement host.
- `playground/src/app/page-lifecycle.ts` — own active disposable/surface replacement and stale async-render cancellation.
- `playground/src/docs/markdown-page.ts` — render trusted generated HTML, page header, anchored sections, and optional embedded learning workbench.
- `playground/src/docs/documentation-pages.ts` — Learn/API landing and detail page controllers.
- `playground/src/examples/example-pages.ts` — existing example landing/detail behavior moved from `main.ts`.
- `playground/src/testing/testing-pages.ts` — existing test-lab landing/detail behavior moved from `main.ts`.
- `playground/src/search/search-engine.ts` — lazy MiniSearch deserialization and query/filter/ranking behavior.
- `playground/src/search/search-dialog.ts` — accessible desktop/mobile search modal and keyboard interaction.
- `playground/src/main.ts` — small composition root that wires the modules above.
- `playground/src/style.css` — existing design system plus documentation, nested-navigation, Markdown, and search styles.

### Public content

- `docs/site/learn/index.md` — Learn landing.
- `docs/site/learn/tutorials/diagram-editor/index.md` — approved tutorial landing and twelve-chapter syllabus only.
- `docs/site/learn/guides/*.md` — migrated public guides.
- `docs/site/api/index.md` — package entries, element protocol, and shared API conventions.
- `docs/site/api/components/*.md` — one page per public component/primitive/policy value.
- `docs/site/api/functions/*.md` — one page per public non-hook function or closely related function family.
- `docs/site/api/hooks/*.md` — one page per public hook.
- `docs/site/api/types/*.md` — six domain pages with stable anchors for every public type.

### Tests and verification

- `playground/test/routes.test.ts` — route parsing, canonical output, and legacy redirects.
- `playground/test/navigation.test.ts` — hierarchy, ordering, active ancestry, and persistence model.
- `playground/test/markdown-page.test.ts` — semantic page rendering and anchored navigation.
- `playground/test/search-engine.test.ts` — browser-side lazy restore, queries, filters, and corrupt-index behavior.
- `playground/test/search-dialog.test.ts` — dialog keyboard/focus/status behavior.
- `tooling/verify-studio-docs.mjs` — production-build Playwright acceptance for navigation, Markdown, search, redirects, editor preservation, and test-lab preservation.
- `tooling/verify-studio-visuals.mjs` — reviewed routes and baselines for the reorganized shell.

---

### Task 1: Establish the public content model and safe Markdown compiler

**Files:**

- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `playground/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `tooling/studio-docs/model.ts`
- Create: `tooling/studio-docs/markdown.ts`
- Create: `tooling/studio-docs/content-model.check.ts`
- Create: `tooling/studio-docs/fixtures/valid-guide.md`
- Create: `tooling/studio-docs/fixtures/invalid-script.md`

**Interfaces:**

- Produces: `parsePublicMarkdown(path: string, source: string): LoadedPublicDoc`.
- Produces: `validatePublicDocFrontmatter(value: unknown, path: string): PublicDocFrontmatter`.
- Produces: `LoadedPublicDoc` with `frontmatter`, `route`, `html`, `plainText`, `headings`, and `internalLinks`.
- Consumes: no feature code; this is the base contract for all later tasks.

- [ ] **Step 1: Add exact dependency catalog entries and package ownership**

Add these root catalog entries:

```yaml
markdown-it: ^15.0.1
minisearch: ^7.2.0
yaml: ^2.9.0
```

Add `markdown-it`, `minisearch`, and `yaml` as `catalog:` root development
dependencies because `tooling/studio-docs` imports them. Add `minisearch` as a
`catalog:` runtime dependency of `playground` because the browser restores and
queries the generated index. Run:

```bash
corepack pnpm@11.21.0 install
```

Expected: lockfile records the three direct playground dependencies with no peer warnings.

- [ ] **Step 2: Write the failing content-model check**

Create fixture assertions covering a valid guide, an unknown kind, a duplicate heading slug, a bad slug, executable raw HTML, a supported table, and an internal link:

```ts
const guide = await readFile(validGuidePath, "utf8");
const loaded = parsePublicMarkdown(
  "docs/site/learn/guides/valid-guide.md",
  guide,
);
assert.equal(loaded.frontmatter.kind, "guide");
assert.equal(loaded.route, "#/learn/guides/valid-guide");
assert.deepEqual(
  loaded.headings.map(({ id }) => id),
  ["first-step", "first-step-2"],
);
assert.match(loaded.html, /<table>/u);
assert.doesNotMatch(loaded.html, /<script/u);
assert.deepEqual(loaded.internalLinks, [
  { href: "#/api/functions/crc", sourceHeading: "first-step" },
]);
assert.throws(
  () => parsePublicMarkdown("invalid.md", invalidScript),
  /Raw HTML is not supported/u,
);
```

- [ ] **Step 3: Run the check and verify it fails**

Run:

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/content-model.check.ts
```

Expected: FAIL because `model.ts` and `markdown.ts` do not exist.

- [ ] **Step 4: Implement the typed frontmatter and Markdown contract**

Define exact discriminated metadata:

```ts
export type PublicDocKind = "landing" | "tutorial" | "guide" | "api";
export type ApiCategory =
  "overview" | "component" | "function" | "hook" | "types";
export type TypeDomain =
  | "canvas-runtime"
  | "elements-components"
  | "events"
  | "filters"
  | "layout"
  | "styles";

export interface PublicDocFrontmatter {
  readonly id: string;
  readonly title: string;
  readonly navLabel?: string;
  readonly summary: string;
  readonly kind: PublicDocKind;
  readonly slug: string;
  readonly order?: number;
  readonly tutorial?: "diagram-editor";
  readonly apiCategory?: ApiCategory;
  readonly typeDomain?: TypeDomain;
  readonly symbols?: readonly string[];
  readonly aliases?: readonly string[];
  readonly keywords?: readonly string[];
  readonly exampleSlug?: string;
}
```

Use `YAML.parse` only for the bounded frontmatter block. Configure MarkdownIt with `html: false`, `linkify: true`, and `typographer: true`. Reject raw HTML tokens explicitly so they fail instead of displaying as confusing escaped pseudo-markup. Generate deterministic GitHub-style heading IDs with numeric collision suffixes. Render external links with `rel="noreferrer"`; retain generated hash routes for internal links.

- [ ] **Step 5: Run the focused check**

Run the command from Step 3.

Expected: PASS with `Validated public documentation metadata and safe Markdown rendering.`

- [ ] **Step 6: Run static checks**

```bash
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 lint
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml package.json playground/package.json pnpm-lock.yaml tooling/studio-docs
git commit -m "feat(docs): add public Markdown content model"
```

### Task 2: Inventory public API exports and validate reference coverage

**Files:**

- Create: `tooling/studio-docs/api-exports.ts`
- Create: `tooling/studio-docs/api-exports.check.ts`
- Create: `tooling/studio-docs/fixtures/api/root.ts`
- Create: `tooling/studio-docs/fixtures/api/reexport.ts`

**Interfaces:**

- Consumes: `PublicDocFrontmatter.symbols` from Task 1.
- Produces: `collectPublicExports(entryPaths, compilerOptions): Promise<PublicApiInventory>`.
- Produces: `analyzeApiCoverage(inventory, pages): ApiCoverage` with sorted missing, unknown, and duplicate diagnostics.
- Produces: `validateApiCoverage(inventory, pages): ApiCoverage`, which returns a complete mapping or throws when any diagnostic list is nonempty.

- [ ] **Step 1: Write the failing TypeScript-compiler inventory check**

Use fixture exports that cover direct values, direct types, aliased re-exports, `export type *`, and the compiler JSX namespace. Assert separate sorted value/type lists and exact failures:

```ts
assert.deepEqual(inventory.root.values, ["Circle", "crc"]);
assert.deepEqual(inventory.root.types, ["CRCConfig", "CircleProps"]);
assert.throws(
  () => validateApiCoverage(inventory, duplicatePages),
  /Circle is assigned to both api-circle and api-shapes/u,
);
assert.throws(
  () => validateApiCoverage(inventory, missingPages),
  /Undocumented public exports: CRCConfig/u,
);
assert.throws(
  () => validateApiCoverage(inventory, stalePages),
  /Unknown documented symbols: RemovedValue/u,
);
```

- [ ] **Step 2: Run the check and verify it fails**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/api-exports.check.ts
```

Expected: FAIL because `api-exports.ts` does not exist.

- [ ] **Step 3: Implement compiler-backed export discovery**

Create a TypeScript `Program` from `packages/core/src/index.ts`,
`packages/core/src/types.ts`, `packages/core/src/jsx-runtime.ts`, and
`packages/core/src/jsx-dev-runtime.ts`. Resolve aliases through the type checker;
classify symbols by value/type flags; and normalize each entry-point inventory
to sorted unique arrays. Never infer export shape from source text.

Treat compiler-only `jsx`, `jsxs`, `jsxDEV`, and the local `JSX` namespace as
overview coverage. Require every root runtime value and root type to have one
canonical content destination.

- [ ] **Step 4: Run focused and repository inventory checks**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/api-exports.check.ts
```

Expected: PASS and print the fresh root value/type counts without hard-coding the dated counts from documentation.

- [ ] **Step 5: Commit**

```bash
git add tooling/studio-docs/api-exports.ts tooling/studio-docs/api-exports.check.ts tooling/studio-docs/fixtures/api
git commit -m "test(docs): validate public API reference coverage"
```

### Task 3: Build and expose one validated documentation manifest

**Files:**

- Create: `tooling/studio-docs/build.ts`
- Create: `tooling/studio-docs/vite-plugin.ts`
- Create: `tooling/studio-docs/build.check.ts`
- Create: `playground/src/studio-docs.d.ts`
- Modify: `playground/vite.config.ts`
- Modify: `tsconfig.json`

**Interfaces:**

- Consumes: `parsePublicMarkdown`, example catalog records, and API inventory.
- Produces: `buildStudioDocumentation(options): Promise<StudioDocumentationBuild>`.
- Produces virtual module `virtual:crc-studio-docs` exporting `pages`, `pageByRoute`, and `apiCoverage`.

- [ ] **Step 1: Write the failing aggregate-build check**

Build a temporary `docs/site` fixture and assert deterministic discovery, duplicate-route rejection, invalid internal-link rejection, internal-doc exclusion, and a stable JSON snapshot:

```ts
const first = await buildStudioDocumentation(fixtureOptions);
const second = await buildStudioDocumentation(fixtureOptions);
assert.equal(JSON.stringify(first), JSON.stringify(second));
assert.deepEqual(
  first.pages.map(({ route }) => route),
  ["#/api/functions/crc", "#/learn/guides/first-scene"],
);
assert.ok(
  first.pages.every(({ sourcePath }) => sourcePath.startsWith("docs/site/")),
);
await assert.rejects(
  () => buildStudioDocumentation(brokenLinkOptions),
  /Unknown internal route/u,
);
```

- [ ] **Step 2: Run it and verify it fails**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
```

Expected: FAIL because `build.ts` does not exist.

- [ ] **Step 3: Implement discovery, cross-validation, and the Vite adapter**

Use explicit `docs/site/**/*.md` discovery, normalize paths relative to the
repository root, and sort before parsing. Validate IDs, routes, legacy aliases,
heading anchors, internal links, tutorial order, example references, and API
symbol duplication. The Vite plugin must:

```ts
export function crcStudioDocs(options: { repositoryRoot: string }): Plugin {
  return {
    name: "crc-studio-docs",
    async resolveId(id) {
      return id === "virtual:crc-studio-docs"
        ? "\0virtual:crc-studio-docs"
        : undefined;
    },
    async load(id) {
      if (id !== "\0virtual:crc-studio-docs") return undefined;
      return `export const documentation = ${JSON.stringify(await buildStudioDocumentation(options))};`;
    },
  };
}
```

Register the plugin after `crcRuntimeSource(mode)` and watch every discovered Markdown path plus the relevant catalog modules.

- [ ] **Step 4: Run the build fixture and an empty public-tree Vite build**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
corepack pnpm@11.21.0 playground:build
```

Expected: fixture PASS; Vite build PASS with an empty documentation manifest until Task 7 adds content.

- [ ] **Step 5: Commit**

```bash
git add tooling/studio-docs/build.ts tooling/studio-docs/vite-plugin.ts tooling/studio-docs/build.check.ts playground/src/studio-docs.d.ts playground/vite.config.ts tsconfig.json
git commit -m "feat(docs): generate the Studio documentation manifest"
```

### Task 4: Reclassify examples and add canonical/legacy route metadata

**Files:**

- Modify: `packages/scenarios/src/learning-types.ts`
- Modify: `packages/scenarios/src/learning-catalog.ts`
- Modify: `packages/scenarios/src/index.ts`
- Modify: `packages/core/test/learning-examples.test.ts`
- Modify: `tooling/scenario-catalog.ts`
- Modify: `docs/scenario-index.md`

**Interfaces:**

- Produces: `LearningBrowseGroup = "drawing" | "composition" | "layout" | "events-and-interaction" | "focus-and-keyboard"`.
- Produces: `browseGroup?: LearningBrowseGroup`, absent only for Getting Started and Author without JSX.
- Produces: `getLearningExampleRoute(entry)` canonical route and `getLearningExampleLegacyRoutes(entry)` aliases.
- Produces: `getLearningExamplesByBrowseGroup(group)` sorted alphabetically without changing `learningExampleCatalog` teaching order.

- [ ] **Step 1: Change catalog tests to the approved taxonomy and make them fail**

Assert these observable rules:

```ts
expect(getLearningExampleBySlug("filters")?.browseGroup).toBe("drawing");
expect(
  getLearningExampleBySlug("getting-started")?.browseGroup,
).toBeUndefined();
expect(
  getLearningExampleBySlug("create-element-authoring")?.browseGroup,
).toBeUndefined();
expect(getLearningExampleRoute(getLearningExampleBySlug("click")!)).toBe(
  "#/examples/events-and-interaction/click",
);
expect(
  getLearningExampleLegacyRoutes(getLearningExampleBySlug("click")!),
).toContain("#/examples/mouse-events/click");
expect(
  getLearningExamplesByBrowseGroup("drawing").map(
    ({ shortTitle }) => shortTitle,
  ),
).toEqual(
  [
    ...getLearningExamplesByBrowseGroup("drawing").map(
      ({ shortTitle }) => shortTitle,
    ),
  ].sort((a, b) => a.localeCompare(b, "en")),
);
```

- [ ] **Step 2: Run the focused browser test and verify it fails**

```bash
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL on missing browse metadata and old routes.

- [ ] **Step 3: Add browse metadata without changing canonical sources or teaching relationships**

Map all drawing primitives plus Filters to Drawing; Group/Clip/Layer to
Composition; the four layout lessons to Layout; all mouse/user/advanced
interaction lessons to Events and interaction; and keyboard/focus lessons to
Focus and keyboard. Keep the existing `section` and `order` fields as historical
teaching/source organization until all consumers have migrated; do not rename
source directories in this task.

- [ ] **Step 4: Regenerate and verify the scenario index**

```bash
corepack pnpm@11.21.0 scenarios:write-index
corepack pnpm@11.21.0 scenarios:check
corepack pnpm@11.21.0 exec vitest run packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
```

Expected: all PASS; the generated index reports canonical browse groups while preserving test-lab catalogs.

- [ ] **Step 5: Commit**

```bash
git add packages/scenarios/src packages/core/test/learning-examples.test.ts tooling/scenario-catalog.ts docs/scenario-index.md
git commit -m "feat(docs): organize examples by public capability"
```

### Task 5: Extract and test routing and navigation models

**Files:**

- Create: `playground/src/app/routes.ts`
- Create: `playground/src/app/navigation.ts`
- Create: `playground/test/routes.test.ts`
- Create: `playground/test/navigation.test.ts`
- Modify: `playground/src/main.ts`

**Interfaces:**

- Consumes: generated documentation pages and the Task 4 example catalog helpers.
- Produces: `parseStudioRoute(hash): ParsedStudioRoute`, `routeHref(route): string`, and `canonicalizeHash(hash): CanonicalRouteResult`.
- Produces: `buildNavigation(documentation, examples): readonly NavigationArea[]` and `activeNavigationIds(route): ReadonlySet<string>`.

- [ ] **Step 1: Write failing route tests**

Cover every canonical family, type anchors, unknown routes, query preservation,
old example sections, and old scenario routes:

```ts
expect(parseStudioRoute("#/api/types/events#crcpointerevent")).toEqual({
  kind: "document",
  route: "#/api/types/events",
  anchor: "crcpointerevent",
});
expect(canonicalizeHash("#/examples/composition/filters").canonical).toBe(
  "#/examples/drawing/filters",
);
expect(canonicalizeHash("#/scenarios/baseline-smoke").canonical).toBe(
  "#/testing/baseline-smoke",
);
```

- [ ] **Step 2: Write failing navigation tests**

Assert primary order `Learn, API, Examples`, shallow guide order, direct
alphabetical component/function/hook children, six type-domain children, five
example groups, Filters under Drawing, no test labs, and active ancestor IDs.

- [ ] **Step 3: Run both tests and verify they fail**

```bash
corepack pnpm@11.21.0 exec vitest run playground/test/routes.test.ts playground/test/navigation.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement pure route and navigation modules**

Keep browser mutation out of these files. Use `Intl.Collator("en", { sensitivity: "base", numeric: true })` for display sorting. Represent navigation with:

```ts
export interface NavigationEntry {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly children?: readonly NavigationEntry[];
}
export interface NavigationArea extends NavigationEntry {
  readonly id: "learn" | "api" | "examples";
}
```

Do not yet replace rendered pages; temporarily adapt `main.ts` to the extracted route parser so behavior remains shippable.

- [ ] **Step 5: Run focused tests and existing share-code test**

```bash
corepack pnpm@11.21.0 exec vitest run playground/test/routes.test.ts playground/test/navigation.test.ts packages/core/test/share-code.test.ts --browser.headless --browser.ui=false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add playground/src/app playground/test/routes.test.ts playground/test/navigation.test.ts playground/src/main.ts
git commit -m "refactor(studio): extract routes and navigation model"
```

### Task 6: Decompose the Studio shell and add Markdown page rendering

**Files:**

- Create: `playground/src/app/shell.ts`
- Create: `playground/src/app/page-lifecycle.ts`
- Create: `playground/src/docs/markdown-page.ts`
- Create: `playground/src/docs/documentation-pages.ts`
- Create: `playground/src/examples/example-pages.ts`
- Create: `playground/src/testing/testing-pages.ts`
- Create: `playground/test/markdown-page.test.ts`
- Modify: `playground/src/main.ts`
- Modify: `playground/src/style.css`

**Interfaces:**

- Consumes: `ParsedStudioRoute`, `NavigationArea[]`, generated `LoadedPublicDoc`, existing `mountEditorWorkbench`, and existing scenario surface functions.
- Produces: `createStudioShell(options): StudioShell`, `createPageLifecycle(): PageLifecycle`, and `renderMarkdownPage(options): Promise<Disposable | undefined>`.

- [ ] **Step 1: Write the failing Markdown page browser test**

Mount a generated fixture page and assert one `h1`, breadcrumb, summary,
heading IDs, safe code/table output, focusable route heading, anchor scrolling,
and optional learning-workbench host:

```ts
const page = await renderMarkdownPage({
  document: fixtureDocument,
  container,
  focus: false,
});
expect(container.querySelector("h1")?.textContent).toBe(
  "Manage state and lifecycle",
);
expect(container.querySelector("#component-identity")).not.toBeNull();
expect(container.querySelector("script")).toBeNull();
expect(
  container.querySelector("[data-example-slug='getting-started']"),
).not.toBeNull();
await page.dispose?.();
```

- [ ] **Step 2: Run it and verify it fails**

```bash
corepack pnpm@11.21.0 exec vitest run playground/test/markdown-page.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because the page renderer does not exist.

- [ ] **Step 3: Extract the existing shell and page owners without changing their contracts**

Move code rather than rewrite it. `page-lifecycle.ts` must retain the current
monotonic render version, dispose the active Monaco workbench before the active
scenario surface, and reject stale async results. `example-pages.ts` retains
the live hero, teaching cards, editor, accessibility note, and source loading.
`testing-pages.ts` retains fixture fallback, lazy read-only source editor, and
surface disposal.

- [ ] **Step 4: Implement semantic Markdown pages and nested navigation rendering**

Render only build-produced HTML. Use `replaceChildren` with a template-created
fragment; never evaluate scripts. When `exampleSlug` is present, mount the
existing workbench with that example's canonical source and return its
disposable. Apply the route anchor after content insertion, then focus the `h1`
only for route navigation that did not originate from an in-page anchor.

- [ ] **Step 5: Run focused, build, and lifecycle checks**

```bash
corepack pnpm@11.21.0 exec vitest run playground/test/markdown-page.test.ts packages/core/test/share-code.test.ts packages/core/test/learning-examples.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 playground:build
corepack pnpm@11.21.0 playground:build:built
```

Expected: all PASS; both Studio modes still load examples and test labs.

- [ ] **Step 6: Commit**

```bash
git add playground/src/app playground/src/docs playground/src/examples playground/src/testing playground/src/main.ts playground/src/style.css playground/test/markdown-page.test.ts
git commit -m "refactor(studio): add documentation page shell"
```

### Task 7: Migrate public guides and publish the tutorial landing

**Files:**

- Create: `docs/site/learn/index.md`
- Create: `docs/site/learn/tutorials/diagram-editor/index.md`
- Create: `docs/site/learn/guides/configure-jsx.md`
- Create: `docs/site/learn/guides/author-without-jsx.md`
- Create: `docs/site/learn/guides/components-props-and-children.md`
- Create: `docs/site/learn/guides/style-and-draw.md`
- Create: `docs/site/learn/guides/compose-and-layout.md`
- Create: `docs/site/learn/guides/state-and-lifecycle.md`
- Create: `docs/site/learn/guides/focus-and-keyboard.md`
- Create: `docs/site/learn/guides/custom-components-and-primitives.md`
- Create: `docs/site/learn/guides/react-integration.md`
- Create: `docs/site/learn/guides/jsx-troubleshooting.md`
- Modify: `tooling/studio-docs/build.check.ts`
- Modify: `README.md`

**Interfaces:**

- Consumes: Task 1 frontmatter and Task 6 optional `exampleSlug` rendering.
- Produces: the first real Learn manifest, including embedded `getting-started` and `create-element-authoring` workbenches.

- [ ] **Step 1: Add failing real-content assertions**

Extend the build check:

```ts
assert.deepEqual(
  real.pages
    .filter(({ frontmatter }) => frontmatter.kind === "guide")
    .sort((left, right) => left.frontmatter.order! - right.frontmatter.order!)
    .map(({ frontmatter }) => frontmatter.title),
  [
    "Configure JSX",
    "Author without JSX",
    "Understand components, props, and children",
    "Style and draw",
    "Compose and lay out scenes",
    "Manage state and lifecycle",
    "Add focus and keyboard navigation",
    "Create custom components and primitives",
    "Integrate with React",
    "Troubleshoot JSX",
  ],
);
assert.equal(
  real.pageByRoute["#/learn/guides/configure-jsx"].exampleSlug,
  "getting-started",
);
assert.equal(
  real.pageByRoute["#/learn/guides/author-without-jsx"].exampleSlug,
  "create-element-authoring",
);
assert.match(
  real.pageByRoute["#/learn/tutorials/diagram-editor"].plainText,
  /Finish and harden the editor/u,
);
```

- [ ] **Step 2: Run the check and verify it fails**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
```

Expected: FAIL because `docs/site` has not been created.

- [ ] **Step 3: Migrate existing guide prose without changing public contracts**

Use explicit frontmatter such as:

```yaml
---
id: guide-state-lifecycle
title: Manage state and lifecycle
summary: Understand scheduled rendering, hook slots, identity, cleanup, and CRC's differences from React.
kind: guide
slug: state-and-lifecycle
order: 60
keywords: [state, lifecycle, cleanup, identity, hooks]
---
```

Move content from the existing ten guide files into the listed destinations.
Merge the existing children/key material into Components, props, and children;
split the existing style discussion into Style and draw; preserve links to the
normative design contracts as repository-source links rather than publishing
those contracts. Do not add empty Handle events or Tips and patterns pages in
this phase.

- [ ] **Step 4: Add the Learn landing and exact approved tutorial syllabus**

The tutorial page must state that chapters are forthcoming, list all twelve
approved chapter titles and outcomes, and link only to already implemented
guides/API/examples. It must not render nonfunctional chapter links. The two
entry guides use `exampleSlug` for the existing interactive sources.

- [ ] **Step 5: Run content, route, browser, and link checks**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
corepack pnpm@11.21.0 exec vitest run playground/test/routes.test.ts playground/test/navigation.test.ts playground/test/markdown-page.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 docs:check
```

Expected: all PASS and no `docs/site` link reaches an unknown public route.

- [ ] **Step 6: Commit**

```bash
git add docs/site/learn README.md tooling/studio-docs/build.check.ts
git commit -m "docs: publish Learn guides and diagram tutorial outline"
```

### Task 8: Split the API overview, components, functions, and hooks

**Files:**

- Create: `docs/site/api/index.md`
- Create: `docs/site/api/components/absolute.md`
- Create: `docs/site/api/components/arc.md`
- Create: `docs/site/api/components/circle.md`
- Create: `docs/site/api/components/clip.md`
- Create: `docs/site/api/components/ellipse.md`
- Create: `docs/site/api/components/flex.md`
- Create: `docs/site/api/components/flow.md`
- Create: `docs/site/api/components/focus-management.md`
- Create: `docs/site/api/components/grid.md`
- Create: `docs/site/api/components/group.md`
- Create: `docs/site/api/components/horizontal-line.md`
- Create: `docs/site/api/components/image.md`
- Create: `docs/site/api/components/keyboard-navigation.md`
- Create: `docs/site/api/components/layer.md`
- Create: `docs/site/api/components/line.md`
- Create: `docs/site/api/components/overlay.md`
- Create: `docs/site/api/components/path.md`
- Create: `docs/site/api/components/polygon.md`
- Create: `docs/site/api/components/rectangle.md`
- Create: `docs/site/api/components/regular-polygon.md`
- Create: `docs/site/api/components/star.md`
- Create: `docs/site/api/components/svg-path.md`
- Create: `docs/site/api/components/text.md`
- Create: `docs/site/api/components/vertical-line.md`
- Create: `docs/site/api/components/wedge.md`
- Create: `docs/site/api/functions/crc.md`
- Create: `docs/site/api/functions/create-arc-path.md`
- Create: `docs/site/api/functions/create-circle-path.md`
- Create: `docs/site/api/functions/create-element.md`
- Create: `docs/site/api/functions/create-ellipse-path.md`
- Create: `docs/site/api/functions/create-line-path.md`
- Create: `docs/site/api/functions/create-polygon-path.md`
- Create: `docs/site/api/functions/create-rectangle-path.md`
- Create: `docs/site/api/functions/create-regular-polygon-path.md`
- Create: `docs/site/api/functions/create-star-path.md`
- Create: `docs/site/api/functions/create-svg-path.md`
- Create: `docs/site/api/functions/create-wedge-path.md`
- Create: `docs/site/api/functions/define-primitive.md`
- Create: `docs/site/api/functions/layout-diagnostic.md`
- Create: `docs/site/api/functions/measure-element.md`
- Create: `docs/site/api/functions/normalize-edges.md`
- Create: `docs/site/api/functions/resolve-box.md`
- Create: `docs/site/api/functions/resolve-length.md`
- Create: `docs/site/api/hooks/crc-canvas-context.md`
- Create: `docs/site/api/hooks/crc-cursor.md`
- Create: `docs/site/api/hooks/crc-event.md`
- Create: `docs/site/api/hooks/crc-event-listener.md`
- Create: `docs/site/api/hooks/crc-event-target.md`
- Create: `docs/site/api/hooks/crc-layout-box.md`
- Create: `docs/site/api/hooks/crc-line-path.md`
- Create: `docs/site/api/hooks/crc-memo.md`
- Create: `docs/site/api/hooks/crc-rect-path.md`
- Create: `docs/site/api/hooks/crc-ref.md`
- Create: `docs/site/api/hooks/crc-state.md`
- Create: `docs/site/api/hooks/crc-svg-path.md`
- Create: `docs/site/api/hooks/crc-when-changed.md`
- Modify: `tooling/studio-docs/build.check.ts`

**Interfaces:**

- Consumes: current `docs/api-reference.md`, current public code/contracts, and Task 2 inventory.
- Produces: one canonical API destination for every public runtime value; type coverage remains incomplete until Task 9.

- [ ] **Step 1: Add failing runtime-value coverage assertions**

Use `analyzeApiCoverage` to assert every collected root runtime value appears once, category lists are
alphabetical, `Fragment` resolves to the overview, path creators resolve to
function-family pages, and every hook resolves to its own hook page:

```ts
assert.equal(coverage.values.get("Fragment")?.route, "#/api");
assert.equal(
  coverage.values.get("createCirclePath")?.route,
  "#/api/functions/create-circle-path",
);
assert.equal(
  coverage.values.get("crcWhenChanged")?.route,
  "#/api/hooks/crc-when-changed",
);
assert.deepEqual(runtimeCoverage.duplicateValues, []);
assert.deepEqual(runtimeCoverage.missingValues, []);
```

- [ ] **Step 2: Run it and verify it fails**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
```

Expected: FAIL with the explicit list of undocumented runtime values.

- [ ] **Step 3: Create focused component pages**

Create every component page listed in this task. Every page must include: import
signature, purpose, props/style types, children contract, relevant
capability/error notes, at least one supported code example copied or adapted
from current docs, and links to applicable live examples. Use
`apiCategory: component` and list only the runtime component in `symbols`;
props/style types link forward to their canonical Task 9 type anchors.

- [ ] **Step 4: Create focused function-family pages**

Create every function page listed in this task. Give each numeric `create*Path`
function its own page. Document the runtime `LayoutDiagnostic` class beside
`layoutDiagnostic` and assign both runtime symbols to that page; its related
type-only inputs remain owned by Task 9.

- [ ] **Step 5: Create one page per hook**

Create pages for every `crc*` hook discovered from the public entry point. Each
page states render-only constraints, signature, ownership/cleanup behavior,
dependency behavior where applicable, and related examples/contracts. Avoid
React terminology where CRC behavior differs.

- [ ] **Step 6: Run runtime API coverage and link validation**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
corepack pnpm@11.21.0 docs:check
```

Expected: runtime value coverage PASS; the check reports only the intentionally pending root type coverage owned by Task 9.

- [ ] **Step 7: Commit**

```bash
git add docs/site/api/index.md docs/site/api/components docs/site/api/functions docs/site/api/hooks tooling/studio-docs/build.check.ts
git commit -m "docs: split runtime API reference by symbol"
```

### Task 9: Publish grouped type reference pages and close API coverage

**Files:**

- Create: `docs/site/api/types/canvas-runtime.md`
- Create: `docs/site/api/types/elements-components.md`
- Create: `docs/site/api/types/events.md`
- Create: `docs/site/api/types/filters.md`
- Create: `docs/site/api/types/layout.md`
- Create: `docs/site/api/types/styles.md`
- Modify: `tooling/studio-docs/build.ts`
- Modify: `tooling/studio-docs/build.check.ts`
- Remove: `docs/api-reference.md`
- Modify: `README.md`
- Modify: `docs/library-status.md`

**Interfaces:**

- Consumes: Task 2 complete type inventory and paired type symbols already documented on component/function/hook pages.
- Produces: exact one-destination coverage for every root type and supported compiler-entry type.

- [ ] **Step 1: Make complete API coverage mandatory and verify failure**

Replace Task 8's runtime-only analysis with strict `validateApiCoverage`. Assert:

```ts
assert.deepEqual(coverage.missingValues, []);
assert.deepEqual(coverage.missingTypes, []);
assert.deepEqual(coverage.unknownSymbols, []);
assert.deepEqual(coverage.duplicateSymbols, []);
```

Run:

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
```

Expected: FAIL with a sorted list of types not already paired with value pages.

- [ ] **Step 2: Create six domain pages with exact alphabetical anchors**

Assign every remaining type by meaning, not filename. Use headings of the form
`## CRCController` so the generated anchor is stable and search can index it.
Within each file, compare the heading list to `Intl.Collator("en")` output.
Preserve all behavior from the old API reference, including filter descriptor
fields, event facade relationships, layout/style distinctions, Canvas unions,
element protocol, and primitive extension types.

- [ ] **Step 3: Remove the superseded monolith and repair repository links**

Delete `docs/api-reference.md` only after every old section has a canonical new
source. Update README and library-status links to the new overview or focused
source page. Extend the existing documentation mutation baseline deliberately
if its protected links/content move; record exact source/destination mappings
instead of weakening the preservation check.

- [ ] **Step 4: Run complete API, documentation, and format checks**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 lint
```

Expected: every value/type maps exactly once; no stale API links; all PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/site/api/types docs/api-reference.md README.md docs/library-status.md tooling/studio-docs tooling/docs-contract-preservation-baseline.json
git commit -m "docs: publish complete grouped type reference"
```

### Task 10: Generate and test the deterministic MiniSearch index

**Files:**

- Create: `tooling/studio-docs/search-index.ts`
- Create: `tooling/studio-docs/search-index.check.ts`
- Modify: `tooling/studio-docs/build.ts`
- Modify: `tooling/studio-docs/vite-plugin.ts`
- Modify: `playground/src/studio-docs.d.ts`

**Interfaces:**

- Consumes: normalized heading-sized docs and public example metadata.
- Produces: `buildSearchBundle(input): SerializedSearchBundle`.
- Produces: `tokenizeSearchText(value): readonly string[]` shared by indexing and browser query.
- Produces a separate lazy virtual module `virtual:crc-studio-search` exporting `serializedSearchIndex` and `searchRecords` metadata.

- [ ] **Step 1: Write failing record, exclusion, determinism, and ranking checks**

Create competing fixture records and assert:

```ts
assert.equal(
  records.some(({ url }) => url.startsWith("#/testing")),
  false,
);
assert.equal(
  records.some(({ id }) => id.startsWith("internal:")),
  false,
);
assert.deepEqual(tokenizeSearchText("crcWhenChanged"), [
  "crcwhenchanged",
  "crc",
  "when",
  "changed",
]);
assert.equal(
  JSON.stringify(buildSearchBundle(input)),
  JSON.stringify(buildSearchBundle(input)),
);
assert.equal(
  searchFixture("crcWhenChanged")[0].url,
  "#/api/hooks/crc-when-changed",
);
assert.equal(
  searchFixture("filter", { kinds: ["example"] })[0].url,
  "#/examples/drawing/filters",
);
```

- [ ] **Step 2: Run it and verify it fails**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/search-index.check.ts
```

Expected: FAIL because `search-index.ts` does not exist.

- [ ] **Step 3: Build heading-sized search records**

Use this stored shape:

```ts
export interface SearchRecord {
  readonly id: string;
  readonly url: string;
  readonly kind: "learn" | "api" | "example";
  readonly title: string;
  readonly breadcrumb: string;
  readonly heading: string;
  readonly summary: string;
  readonly symbols: string;
  readonly aliases: string;
  readonly keywords: string;
  readonly body: string;
}
```

Build MiniSearch with exact field boosts matching the spec priority. Use a
dedicated exact-symbol post-boost so an exact API query cannot lose to repeated
body mentions. Enable prefix matching for all nonempty queries and fuzzy `0.2`
only when the normalized query has at least four characters. Store enough plain
text to create a safe highlighted excerpt in the browser; never serialize HTML
as an excerpt source.

- [ ] **Step 4: Serialize deterministically and expose through the virtual module**

Sort input records by ID before `addAll`, serialize with `toJSON`, and serialize
record metadata in the same order. Never include source timestamps or absolute
paths. Add the serialized bundle to the separate
`virtual:crc-studio-search` module so Task 11 can load it without pulling the
index into the statically imported documentation manifest.

- [ ] **Step 5: Run search and full content checks**

```bash
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/search-index.check.ts
corepack pnpm@11.21.0 exec tsx tooling/studio-docs/build.check.ts
corepack pnpm@11.21.0 playground:build
```

Expected: all PASS and production output contains no absolute repository path.

- [ ] **Step 6: Commit**

```bash
git add tooling/studio-docs playground/src/studio-docs.d.ts
git commit -m "feat(docs): generate static full-text search index"
```

### Task 11: Add lazy browser search and the accessible search dialog

**Files:**

- Create: `playground/src/search/search-engine.ts`
- Create: `playground/src/search/search-dialog.ts`
- Create: `playground/test/search-engine.test.ts`
- Create: `playground/test/search-dialog.test.ts`
- Modify: `playground/src/app/shell.ts`
- Modify: `playground/src/main.ts`
- Modify: `playground/src/style.css`

**Interfaces:**

- Consumes: Task 10 serialized index via dynamic `import("virtual:crc-studio-search")`.
- Produces: `createSearchEngine(loadBundle): SearchEngine` with `preload`, `search`, and `retry`.
- Produces: `mountSearchDialog(options): SearchDialogController` with `open`, `close`, and `dispose`.

- [ ] **Step 1: Write failing engine tests**

Assert no bundle load before `preload`/first search, only one concurrent load,
Learn/API/Examples filtering with counts, exact ranking, safe excerpt ranges,
and recovery after the first loader call rejects.

```ts
expect(loadCalls).toBe(0);
await engine.preload();
expect(loadCalls).toBe(1);
expect((await engine.search("crcState")).results[0].url).toBe(
  "#/api/hooks/crc-state",
);
await expect(brokenEngine.search("state")).rejects.toThrow("index unavailable");
await brokenEngine.retry();
expect((await brokenEngine.search("state")).results.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Write failing dialog interaction tests**

Assert click and `Meta+K`/`Control+K` opening, initial focus, arrow traversal,
Enter navigation, filter toggles and counts, Escape closing, focus restoration,
screen-reader status, full-screen narrow mode class, no-results copy,
unavailable/retry copy, and disposal of global listeners.

- [ ] **Step 3: Run both tests and verify they fail**

```bash
corepack pnpm@11.21.0 exec vitest run playground/test/search-engine.test.ts playground/test/search-dialog.test.ts --browser.headless --browser.ui=false
```

Expected: FAIL because search browser modules do not exist.

- [ ] **Step 4: Implement lazy engine restoration and safe highlighting**

Restore with `MiniSearch.loadJSON`, pass the same field configuration and
tokenizer used at build time, and retain a resettable loader promise. Construct
highlighted excerpts as text nodes plus `<mark>` nodes from matched ranges;
never inject excerpt HTML.

- [ ] **Step 5: Implement modal semantics and shell triggers**

Use native `<dialog>` when supported by the tested browser. Include a labeled
search input, kind filter controls, result listbox, live status, close button,
and retry button. Preload on trigger focus/pointer entry, not on initial page
load. Ignore `Ctrl/Cmd+K` when a different modal or Monaco text input owns the
keystroke. Restore the exact invoking element on close when it remains
connected.

- [ ] **Step 6: Run focused tests, typecheck, and production build**

```bash
corepack pnpm@11.21.0 exec vitest run playground/test/search-engine.test.ts playground/test/search-dialog.test.ts --browser.headless --browser.ui=false
corepack pnpm@11.21.0 typecheck
corepack pnpm@11.21.0 playground:build
```

Expected: all PASS; MiniSearch/index code is emitted as a lazy chunk and is not requested before search intent.

- [ ] **Step 7: Commit**

```bash
git add playground/src/search playground/test/search-engine.test.ts playground/test/search-dialog.test.ts playground/src/app/shell.ts playground/src/main.ts playground/src/style.css
git commit -m "feat(studio): add accessible documentation search"
```

### Task 12: Complete navigation persistence, redirects, and end-to-end acceptance

**Files:**

- Create: `tooling/verify-studio-docs.mjs`
- Create: `tooling/studio-docs/studio-docs.check.ts`
- Modify: `playground/src/app/navigation.ts`
- Modify: `playground/src/app/shell.ts`
- Modify: `playground/src/main.ts`
- Modify: `playground/src/style.css`
- Modify: `playground/test/navigation.test.ts`
- Modify: `playground/test/routes.test.ts`
- Modify: `tooling/verify-studio-visuals.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: all prior routing, content, navigation, example, and search modules.
- Produces: `test:studio-docs` Playwright acceptance command and final responsive public shell.

- [ ] **Step 1: Extend failing navigation tests for persistence and active-route override**

Use an injected storage adapter and assert a collapsed preference survives a
new model, but the active route always expands its area and ancestors:

```ts
storage.setItem(
  "crc-studio-navigation",
  JSON.stringify({ api: false, "api-types": false }),
);
const state = createNavigationState({
  storage,
  activeRoute: "#/api/types/events",
});
expect(state.isExpanded("api")).toBe(true);
expect(state.isExpanded("api-types")).toBe(true);
expect(state.isExpanded("examples")).toBe(false);
```

- [ ] **Step 2: Write the production Playwright verifier before completing UI integration**

Build and preview the Studio, then test:

1. Learn/API/Examples order and no Test Labs inside those trees.
2. Desktop collapse/persistence and active ancestor override after reload.
3. Mobile drawer close button, Escape, focus containment, and focus restoration.
4. Learn guide rendering and heading-anchor navigation.
5. API exact route and type anchor.
6. Filters under Drawing and alphabetical example order.
7. Old example and scenario redirects with query preservation.
8. Search chunk absent before intent, loaded after focus, exact symbol ranking,
   category filtering, keyboard activation, no results, and retry.
9. Search results contain no testing route.
10. A live example still reaches `Live · changes run automatically`, keeps one
    `sandbox="allow-scripts"` frame, and supports reset/share.
11. A test lab still mounts its Canvas and lazy source viewer.

Make each failure include the route and expected semantic state.

- [ ] **Step 3: Run the verifier and confirm the missing integration fails**

```bash
corepack pnpm@11.21.0 playground:build
node tooling/verify-studio-docs.mjs
```

Expected: FAIL on incomplete navigation persistence, route integration, or acceptance selectors.

- [ ] **Step 4: Complete desktop/mobile navigation and canonical route dispatch**

Persist only expansion booleans under versioned key
`crc-studio-navigation:v1`. Treat malformed storage as empty preferences.
Render semantic buttons for groups and anchors for destinations. Route dispatch
must replace legacy hashes with canonical hashes before page rendering and
preserve existing share query strings.

- [ ] **Step 5: Add scripts and run all focused acceptance checks**

Add:

```json
"studio-docs:check": "tsx tooling/studio-docs/studio-docs.check.ts",
"test:studio-docs": "pnpm playground:build && node tooling/verify-studio-docs.mjs"
```

Wire `studio-docs:check` into `trust:static` and `test:studio-docs` into
`trust:browser` before the visual gate.

The aggregate check imports each top-level check in a fixed order and reports
one final success line:

```ts
await import("./content-model.check");
await import("./api-exports.check");
await import("./build.check");
await import("./search-index.check");
process.stdout.write(
  "Validated CRC Studio documentation content, API coverage, routes, links, and search.\n",
);
```

Run:

```bash
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 test:studio-docs
corepack pnpm@11.21.0 scenarios:check
```

Expected: all PASS.

- [ ] **Step 6: Review intentional visual changes**

Update `verify-studio-visuals.mjs` routes to cover Learn landing, one API page,
Examples landing, Filters, search-open state, and a test lab. First run without
update and inspect every expected/actual/diff. Then, only after confirming the
new shell and navigation are intentional:

```bash
corepack pnpm@11.21.0 test:studio-visual:update
corepack pnpm@11.21.0 test:studio-visual
```

Expected: reviewed baselines update once; the second command matches every baseline exactly.

- [ ] **Step 7: Commit**

```bash
git add tooling/verify-studio-docs.mjs tooling/verify-studio-visuals.mjs playground/src playground/test package.json packages/core/test/visual-baselines
git commit -m "feat(studio): complete searchable documentation navigation"
```

### Task 13: Update durable documentation and run the aggregate trust gate

**Files:**

- Modify: `docs/documentation-follow-up.md`
- Modify: `docs/testing/scenario-gallery.md`
- Modify: `docs/testing/trust-gate.md`
- Create: `docs/testing/field-notes/documentation-information-architecture-and-search.md`
- Modify: `AGENTS.md`

**Interfaces:**

- Consumes: the shipped implementation and fresh verification output.
- Produces: current repository guidance and dated evidence; no runtime interface.

- [ ] **Step 1: Update current-state documentation before claiming completion**

Replace the old statement that search/public rendering are deferred. Document
the public content boundary, Learn/API/Examples hierarchy, example browse
groups, static MiniSearch behavior, legacy routes, test-lab exclusion, local
commands, and the still-deferred complete tutorial chapters/framework migration.
Update AGENTS.md compactly; do not paste the full design into it.

- [ ] **Step 2: Run the complete documented gate**

Run under Node 24.15 or newer:

```bash
node --version
corepack pnpm@11.21.0 --version
corepack pnpm@11.21.0 trust
```

Expected: Node reports `v24.15.0` or newer on the Node 24 line, pnpm reports
`11.21.0`, and the aggregate trust command exits 0. Record fresh counts from
the output; never reuse historical counts from documentation.

- [ ] **Step 3: Record field-note evidence**

The field note must include:

- commit under test and environment versions;
- focused content/search/browser commands and outcomes;
- aggregate trust result and fresh browser/visual counts;
- routes manually reviewed on desktop and narrow screens;
- confirmation that search made no remote request and excluded test/internal content;
- confirmation that the example sandbox and test-lab surface retained their contracts;
- every intentionally updated visual baseline and why it changed;
- remaining follow-up: author the twelve diagram-editor chapters and future guides.

- [ ] **Step 4: Re-run documentation and format checks after the evidence update**

```bash
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 lint
git diff --check
```

Expected: all PASS with no stale links, formatting drift, or whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md docs/documentation-follow-up.md docs/testing/scenario-gallery.md docs/testing/trust-gate.md docs/testing/field-notes/documentation-information-architecture-and-search.md
git commit -m "docs: record searchable Studio implementation"
```

## Completion handoff

Before declaring the feature complete, inspect `git status --short`, confirm no
unrelated files were staged, and report the exact fresh verification output and
environment. Full diagram-editor tutorial chapter production begins only under
a separate approved design and implementation plan.
