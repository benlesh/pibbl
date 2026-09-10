# Searchable Studio documentation

CRC's documentation experience is the Interactive Examples Studio in the
existing Vite playground. It is one application and one deployment surface,
not a second framework, publication pipeline, backend, or hosted-search
integration.

## Public documentation model

Public Markdown lives only in `docs/site/`. The build validates its
frontmatter, routes, links, anchors, API coverage, and rendering before it
creates the Studio's generated documentation module. Repository design
contracts, plans, testing notes, field notes, and other prose outside that
tree are not public Studio pages and never enter public search.

The persistent public navigation has three areas, in this order:

- **Learn** has cumulative Tutorials followed by a shallow, curated list of
  Guides. The diagram-editor tutorial is a published syllabus and landing page;
  its twelve independently runnable chapters are intentionally deferred.
- **API** has an overview, then alphabetized Components, Functions, and Hooks.
  Types remain grouped by domain so the declaration surface stays navigable.
- **Examples** has live public lessons grouped as Drawing, Composition, Layout,
  Events and interaction, and Focus and keyboard. Entries within each group are
  alphabetized by their display title. Filters belong to Drawing.

Canonical interactive examples remain in `packages/scenarios` and are loaded
through the typed learning catalog. Deterministic browser fixtures remain in
the independent test-scenario catalog. This separation protects both the
editable public lesson experience and the diagnostic contracts required by
headless tests.

## Search and routes

The Vite documentation build produces a deterministic MiniSearch index from
validated public Learn and API pages plus public learning-example metadata. The
browser loads that index only after a visitor opens search. Search stays fully
local: it makes no remote request, sends no analytics, and contains no testing,
internal, source-path, or scenario-only record. Results support Learn, API, and
Examples filters; exact API names rank ahead of broader prose matches.

The canonical public routes are `#/learn`, `#/api`, and `#/examples` with their
validated child destinations. Catalog-owned legacy learning URLs and Markdown
route aliases redirect to their canonical location while preserving anchors or
share queries. `#/scenarios` and `#/scenarios/<slug>` redirect to the separate
`#/testing` test-lab surface. Test labs remain available for their documented
verification workflows but are not a public navigation branch or search
result.

## Working on Studio documentation

Run the source-mode Studio with:

```sh
corepack pnpm@11.21.0 playground
```

Open <http://localhost:5173/#/learn>, <http://localhost:5173/#/api>, or
<http://localhost:5173/#/examples>. Use the visible search control or
<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> to open local search. Check content
and browser behavior with:

```sh
corepack pnpm@11.21.0 docs:check
corepack pnpm@11.21.0 studio-docs:check
corepack pnpm@11.21.0 test:studio-docs
corepack pnpm@11.21.0 test:studio-visual
```

Learning pages keep the existing route-lazy Monaco/editor workbench and one
opaque `sandbox="allow-scripts"` preview frame. Automated test labs retain their
scenario IDs, action sets, source markers, test controls, visual baselines, and
headless consumers.

## Deferred work

The first implementation deliberately does not author the twelve complete
diagram-editor tutorial chapters or a broader new guide collection. It also
does not migrate the existing Vite Studio to a documentation framework. Those
are separate design and implementation decisions; future work can build on the
validated content model and static search without merging public learning
content into test fixtures.
