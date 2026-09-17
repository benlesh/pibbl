# Documentation information architecture and search design

> **Historical status: APPROVED DESIGN.**

**Status:** Approved on 2026-09-09. This document defines the intended first
implementation. Later implementation records may describe how the design was
realized, but shipped public code and executable tests remain authoritative.

## Summary

CRC will keep its existing framework-free TypeScript application and Vite build.
The Interactive Examples Studio will become a unified documentation experience
with three primary public areas: Learn, API, and Examples. A build-time content
pipeline will render public Markdown, validate navigation and API coverage, and
produce a static MiniSearch index for robust browser-side search. The existing
Automated Test Labs remain separate and are excluded from public search.

This work fixes documentation organization and discoverability without adding a
backend, hosted search provider, second application framework, or parallel
publication pipeline. It also defines the future project-based tutorial shape,
but the first implementation authors only its landing page and syllabus.

## Context

The current documentation experience grew out of an interactive examples
application rather than a documentation system:

- `playground` is a hand-built TypeScript single-page application bundled by
  Vite. It has a custom hash router and DOM-rendered shell.
- `learningExampleCatalog` drives the public interactive lesson pages.
- `scenarioCatalog` drives deterministic browser fixtures under the testing
  route family.
- Public guides and the API reference are Markdown files in the repository but
  are not rendered in the Studio.
- The sidebar follows one manually ordered lesson catalog. It does not express a
  stable distinction between tutorials, guides, API reference, and examples.
- The site has no search.

The existing architecture remains valuable. It owns the live Canvas previews,
type-aware Monaco workbench, share/reset behavior, source-mode and built-package
verification, and automated test-lab adapters. The design extends this
application instead of replacing it.

## Goals

1. Give the public site an intelligible Learn, API, and Examples hierarchy.
2. Make all public instructional and reference content searchable without a
   server or hosted service.
3. Render the existing public Markdown guides inside the Studio.
4. Split the monolithic API reference into focused, durable destinations.
5. Keep API and example browsing alphabetical where lookup is the goal while
   retaining curated order for tutorials and guides.
6. Preserve existing interactive examples, editor behavior, testing fixtures,
   and public deep links through redirects.
7. Validate content, routes, links, API coverage, navigation order, and search
   behavior at build time.
8. Establish a scalable home for one cumulative tutorial now and additional
   tutorials later.

## Non-goals

The first implementation does not:

- migrate to Starlight, VitePress, Docusaurus, or another site framework;
- add a backend, SSR, static prerendering, hosted search, or crawler;
- add documentation versioning or analytics;
- solve a broader SEO or non-hash-routing migration;
- author the complete diagram-editor tutorial;
- produce a large new collection of guides, tips, or recipes;
- merge public learning content with test-only scenario metadata;
- change CRC runtime behavior or public APIs.

## Chosen architecture

The existing Vite Studio remains the only application and deployable artifact.
A focused documentation content subsystem is added to it.

Public prose lives beneath a dedicated tree:

```text
docs/site/
  learn/
    tutorials/
      diagram-editor/
    guides/
  api/
    components/
    functions/
    hooks/
    types/
```

Only this tree is eligible for public Markdown ingestion. Design contracts,
architecture records, plans, testing notes, and other repository documentation
outside `docs/site/` are never discovered implicitly and never enter the public
search index.

Canonical interactive example source remains in `packages/scenarios`. Existing
catalog metadata is extended for public browse grouping and search rather than
duplicated in Markdown. Test fixtures remain in `scenarioCatalog` and retain
their independent metadata and routes.

One focused Vite plugin reads the public Markdown and example catalogs and
exposes generated modules for:

- normalized page and route metadata;
- navigation groups and entries;
- rendered Markdown page bodies;
- previous and next relationships;
- API symbol-to-page mappings;
- search records and a serialized MiniSearch index.

The generated data is deterministic. It is not checked in unless implementation
constraints demonstrate that a checked-in artifact materially improves the
repository's existing trust gates. Development mode watches eligible Markdown
and catalog sources and refreshes the generated data without requiring a
production build.

The current `playground/src/main.ts` is separated along responsibility
boundaries as part of this work:

- application shell and route dispatch;
- navigation model and renderer;
- Markdown page renderer;
- search controller and modal;
- existing example landing/detail rendering;
- existing testing landing/detail rendering.

This is a targeted decomposition required by the new content model, not a UI
framework rewrite.

## Public content metadata

Every public Markdown page has validated frontmatter. Common metadata includes:

- a stable unique identifier;
- title and optional shorter navigation label;
- concise summary;
- explicit content kind;
- stable slug;
- curated keywords and aliases when useful;
- navigation placement;
- optional related API symbols.

Content-kind-specific metadata adds only what that content needs:

- tutorial pages identify the tutorial and chapter order;
- guide pages declare curated guide order;
- API pages declare their API category and covered public symbols;
- type pages declare their domain and anchored type entries.

Routes are derived from validated kind, group, and slug fields rather than from
display titles. Renaming a title therefore does not silently break a URL.

Interactive examples continue to use their typed catalog. The public browse
group is separate from teaching order, test category, source path, and
relationship metadata. Alphabetical sidebar order is derived from normalized
display titles and is not stored as another hand-maintained sequence.

## Information architecture

The persistent sidebar begins with CRC identity and the global search control,
then presents three primary public areas in this order: Learn, API, Examples.

### Learn

Learn contains Tutorials followed by Guides.

Tutorials are cumulative project-based courses. The initial tutorial is:

- **Learn the basics: Build a diagram editor**

The hierarchy allows later tutorials to sit beside it without changing existing
routes. Tutorial chapters use intentional pedagogical order.

Guides use one shallow, curated list at first:

1. Configure JSX
2. Author without JSX
3. Understand components, props, and children
4. Style and draw
5. Compose and lay out scenes
6. Manage state and lifecycle
7. Handle events and interaction
8. Add focus and keyboard navigation
9. Create custom components and primitives
10. Integrate with React
11. Troubleshoot JSX
12. Tips and patterns

The first implementation migrates and retitles existing guide content where it
fits. It does not require every listed future guide to contain comprehensive new
material. Missing future content must not masquerade as finished documentation;
the navigation may omit an unimplemented guide or clearly label a deliberately
published outline.

If guide volume later becomes difficult to scan, metadata can introduce groups
without changing guide routes. The initial navigation does not add speculative
nested categories.

### API

API contains:

1. Overview
2. Components
3. Functions
4. Hooks
5. Types

Components, functions, and hooks receive focused individual pages and appear
alphabetically within their category. The overview explains package entry
points, the element protocol, shared conventions, and exceptional values that
are best understood with that protocol. Every public runtime export must map to
exactly one canonical API destination, even when multiple related symbols are
documented on the same page.

Types use grouped domain pages so the large declaration surface does not
overwhelm the main sidebar:

- Canvas and runtime
- Elements and components
- Events
- Filters
- Layout
- Styles

Individual types are alphabetized within the appropriate page. Every type has a
stable heading anchor, direct URL, and independent search record. Closely paired
runtime and type symbols may share one page, but both remain covered by the API
manifest and individually discoverable.

The existing monolithic API reference is source material for this split. The
migration preserves its current public contracts and does not intentionally
invent new API behavior.

### Examples

Examples contain five browse groups:

- Drawing
- Composition
- Layout
- Events and interaction
- Focus and keyboard

Entries are alphabetical within each group. Filters belong to Drawing because
that is the learner-facing conceptual home, regardless of their internal
composition-boundary implementation.

Current getting-started and non-JSX lessons move conceptually into Learn. Current
advanced-interaction examples move into Events and interaction instead of
retaining a vague Advanced group. Example source, editor functionality,
objectives, prompts, API notes, related links, and headless consumers remain
intact.

### Automated Test Labs

Automated Test Labs remain a visually subordinate utility destination below the
public navigation. They are not a fourth public documentation area. Their pages,
metadata, fixture source, and diagnostic controls remain separate from learner
content and are excluded from global public search.

## Sidebar behavior

The active primary area and its ancestor groups remain expanded. Other large
groups are collapsible. Expansion state persists locally and is advisory: the
active route always expands the groups required to reveal itself.

The existing accessible narrow-screen drawer presents the same hierarchy and
content labels as desktop. Search moves to the mobile header and opens a
full-screen modal. Drawer behavior continues to provide an explicit close
control, Escape handling, focus containment, and focus restoration.

Navigation semantics use real links and headings. Collapsible controls expose
their expanded state. The design does not rely on color alone to communicate the
active page or selected search filter.

## Routes and compatibility

Canonical route families are:

```text
#/learn
#/learn/tutorials/diagram-editor/<chapter>
#/learn/guides/<guide>
#/api
#/api/components/<name>
#/api/functions/<name>
#/api/hooks/<name>
#/api/types/<domain>#<type>
#/examples/<group>/<example>
#/testing
#/testing/<fixture>
```

The initial diagram-editor landing page may use the tutorial root route before
chapter content exists. It must not create broken chapter links.

Existing `#/examples/<old-section>/<slug>`, `#/scenarios`, and
`#/scenarios/<slug>` URLs redirect to canonical destinations. Redirect lookup is
data-driven and validated so legacy routes cannot collide with current routes.
In-site links are updated to canonical routes. Repository README links continue
to target readable Markdown source files at their migrated paths so they work on
the package and repository pages without requiring the Studio deployment.

Sidebar order and display-title changes never determine tutorial progression or
route identity. Tutorial previous/next relationships come from chapter order;
examples do not acquire an artificial previous/next sequence merely because
their sidebar is alphabetical.

## Diagram-editor tutorial design

The first tutorial is a cumulative, real-world mini diagram editor. Every future
chapter starts from the prior result but owns a complete, independently runnable
snapshot. A reader can deep-link to any chapter, reset it, edit it, and recover
without replaying earlier chapters. User modifications do not persist across
chapters.

The approved chapter sequence is:

1. **Create the Canvas scene** — mount CRC, draw the workspace, understand the
   controller, scheduled rendering, and disposal.
2. **Draw the first node** — combine Rectangle and Text and introduce local
   style and coordinate geometry.
3. **Connect two nodes** — add Line or Path, explain source paint order, and
   build a recognizable diagram.
4. **Extract a reusable node component** — introduce props, children, lists,
   fragments, and stable keys.
5. **Build the editor chrome** — add toolbar and status regions with CRC layout
   components and distinguish allocation from drawing geometry.
6. **Select nodes with state** — use `useState`, click targets, visible
   selection, and frame-coalesced updates.
7. **Drag nodes safely** — use pointer events, pointer capture, event
   coordinates, and immutable diagram state.
8. **Pan and zoom the workspace** — apply Group transforms and wheel/pointer
   input while keeping paint and targeting aligned.
9. **Constrain the viewport** — introduce Clip and Layer, explain their
   different roles, and preserve interaction order.
10. **Polish selection with filters** — add typed shadows or glow, explain
    filter boundaries and nesting, and handle browser capability requirements.
11. **Add keyboard interaction** — introduce focus management, directional
    navigation, activation, and CRC's accessibility boundary.
12. **Finish and harden the editor** — cover relevant memoization, refs and
    change effects, cleanup ownership, component identity, failure behavior,
    and practical production patterns.

Every authored chapter will contain a concise goal, conceptual explanation,
complete TSX snapshot, live Canvas, editable workbench, focused change from the
prior chapter, guided exercise, recap, related API links, previous/next tutorial
links, and chapter-scoped reset/share behavior.

The first implementation publishes a tutorial landing page with the project
description, intended outcome, and this syllabus. Authoring and verifying all
twelve chapter snapshots is a separate follow-up project.

## Markdown rendering

The renderer supports the public documentation features already needed by the
repository: headings with stable anchors, paragraphs, ordered and unordered
lists, tables, block quotes, inline code, fenced code blocks, links, and images.
It supplies accessible heading structure and visible focus for anchored
navigation.

Public Markdown is trusted repository-authored content, but arbitrary embedded
scripts are not a documentation feature. Raw HTML is disabled or sanitized so
adding a Markdown page cannot silently add executable browser behavior. Rich
interactive documentation continues to use explicit Studio components and
canonical example sources.

Internal links resolve through the generated route manifest. Invalid internal
destinations and duplicate heading anchors fail validation. External links are
rendered safely but network availability is not required for a local build.

## Search architecture

Search is fully static and browser-side. A production build creates normalized
search records and a serialized MiniSearch index. Search code and index data are
loaded only when the search control receives focus or the user invokes
`Ctrl/Cmd+K`.

Documents are indexed in heading-sized records. Results can therefore target a
page root, guide section, tutorial section, individual API type anchor, or
example. Each record carries:

- stable identifier and canonical URL;
- content kind and filter group;
- title and navigation breadcrumb;
- heading hierarchy;
- plain-text excerpt source;
- exact API symbols and aliases;
- curated keywords;
- normalized prose body;
- relevant example API tags, objectives, and notes;
- selected public identifiers used by an example.

Full example source is not indexed indiscriminately. Generated code search data
is restricted to public CRC identifiers or intentionally curated terms so common
syntax, string literals, and implementation noise do not dominate prose and API
matches.

### Tokenization and ranking

Tokenization preserves exact API spellings and also splits camel-case names so
`useWhenChanged` can match both its complete symbol and meaningful word parts.
It supports ordinary word matching and prefixes. Conservative fuzzy matching is
enabled only when the query length is sufficient to avoid noisy short-query
results.

Ranking priority is:

1. exact API symbol or alias;
2. exact or prefix title match;
3. heading match;
4. curated keyword or example API tag;
5. summary;
6. body text.

Ranking behavior is expressed as executable tests with representative competing
documents. Dependency defaults are not treated as the product contract.

### Search interaction

An omnipresent **Search docs...** control appears in the desktop sidebar and
mobile header. It opens a modal with:

- `Ctrl/Cmd+K` activation and Escape dismissal;
- arrow-key traversal and Enter activation;
- focus containment while open and restoration on close;
- result title, breadcrumb, content-kind label, and highlighted excerpt;
- Learn, API, and Examples filters with result counts;
- screen-reader announcements for loading, result counts, and no results;
- a useful empty state with spelling and category suggestions;
- a full-screen narrow-screen presentation.

The initial design does not add a dedicated search-results page. Search state is
ephemeral and does not alter the current route until a result is activated.

No query, page content, or telemetry leaves the browser. Automated Test Labs and
all repository-internal documents are excluded from both records and facets.

If the index cannot load or deserialize, the modal displays a nonfatal **Search
unavailable** state with a retry action. Navigation and page rendering continue
to work. Development mode must expose the same search behavior; a production-only
search feature is not considered complete.

## Validation and failure handling

The content pipeline fails the relevant check or build for:

- invalid or incomplete frontmatter;
- duplicate content IDs, slugs, canonical routes, or legacy aliases;
- unknown navigation kinds or groups;
- broken internal links or anchors;
- tutorial chapters with duplicate/noncontiguous order or missing canonical
  snapshots once chapters are published;
- examples assigned to unknown browse groups;
- nonalphabetical generated API or example output;
- public runtime exports without exactly one canonical API destination;
- API manifests that name symbols absent from the public entry point;
- duplicate API anchors;
- internal or test-only content entering the public search index;
- search records with invalid routes;
- nondeterministic generated search data.

Public export coverage is derived through the TypeScript compiler from the
supported `@crc/core` entry points, not by a fragile regular expression.
Compiler-only JSX runtime entries and type-only compatibility entries are
documented on the API overview or mapped to their canonical public declaration
destinations.

A malformed individual document is a build-time error, not a production page
that fails at runtime. Runtime error states are reserved for recoverable asset
loading failures such as an unavailable search bundle or a failed lazy example
module.

## Migration strategy

Implementation proceeds without maintaining two permanent public content
systems:

1. Introduce and test the normalized content, route, navigation, and search
   models.
2. Add Markdown ingestion and rendering for `docs/site/`.
3. Migrate existing public guides into the new tree with validated metadata.
4. Split the existing API reference into overview, component, function, hook,
   and grouped type pages while preserving its documented contracts.
5. Extend example metadata with the five approved browse groups and generate
   alphabetical example navigation.
6. Introduce new canonical routes and validated legacy redirects.
7. Add the global MiniSearch index and accessible modal.
8. Publish the diagram-editor tutorial landing page and approved syllabus.
9. Update public README links, documentation checks, and Studio evidence.
10. Remove the superseded monolithic public navigation and reference source once
    every canonical destination and legacy redirect is proven.

The migration must preserve unrelated repository documentation and working-tree
changes. Existing documents under `docs/design`, `docs/architecture`,
`docs/testing`, `docs/project-plans`, and `docs/superpowers` remain in place and
retain their source-of-truth roles.

## Verification strategy

### Focused unit and build-time checks

- frontmatter parsing and schema validation;
- route generation, collisions, anchors, and legacy redirects;
- navigation grouping, active ancestry, and alphabetical derivation;
- API export classification and complete public coverage;
- Markdown feature rendering and unsafe HTML handling;
- internal link resolution;
- search record extraction and deterministic serialization;
- camel-case tokenization, exact-name ranking, prefix behavior, conservative
  fuzzy behavior, and filters;
- exclusion of test labs and internal repository documents.

### Browser evidence

- desktop navigation expansion, active state, and persisted preferences;
- mobile drawer semantics and search presentation;
- guide, API, type-anchor, tutorial-landing, and example routes;
- old example and scenario redirects;
- Markdown heading links and browser back/forward behavior;
- search opening by click and shortcut;
- keyboard traversal, filtering, result activation, Escape, focus containment,
  and focus restoration;
- loading, no-results, corrupt-index, and retry states;
- exact API-name results outranking prose mentions;
- existing editor load, edit, reset, share, and disposal behavior after route
  reorganization;
- unchanged test-lab mounting and source presentation.

### Repository gates

The source-mode and built-package Studio builds remain mandatory. Typecheck,
lint/format, catalog checks, public package consumers, relevant browser tests,
and documentation mutation/link checks are updated proportionally. The complete
trust gate runs before the implementation is declared complete.

Navigation changes will affect existing Studio visual baselines. Expected,
actual, and diff output must be reviewed. Baselines may be updated only for
understood intentional changes and never solely to make a check pass.

## Acceptance criteria

The first implementation is complete when:

1. Learn, API, and Examples are the clear primary public navigation areas.
2. Existing public guides render inside the Studio under a shallow curated Learn
   list.
3. The API reference has focused component, function, and hook pages plus the
   approved grouped type pages, with complete validated export coverage.
4. Examples appear in the five approved groups and are alphabetical within each;
   Filters appears under Drawing.
5. The diagram-editor tutorial landing page accurately presents the approved
   twelve-chapter future course without broken chapter links.
6. Global search finds heading-level results across Learn, API, and Examples;
   exact API names rank predictably first; test labs and internal docs never
   appear.
7. Search is accessible by pointer and keyboard on desktop and mobile and needs
   no external service.
8. Existing public links redirect to their canonical replacements.
9. Existing live examples and Automated Test Labs preserve their runtime,
   ownership, and headless contracts.
10. Content, API coverage, navigation, links, routes, and search all have fresh
    executable evidence, and the repository's proportional trust gates pass.

## Follow-up work

After this information architecture and search implementation is complete, a
separate design/plan cycle will author the twelve cumulative diagram-editor
chapters and expand the guide collection. Documentation framework migration,
versioning, analytics, prerendering, and hosted search remain independent future
decisions justified by later needs rather than prerequisites for this work.
