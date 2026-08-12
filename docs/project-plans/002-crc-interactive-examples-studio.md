# Project plan 002: CRC interactive examples studio

## Purpose

Replace the test-oriented gallery with a learner-first Canvas studio: one focused page per drawing primitive, one per mouse event, several advanced interaction lessons, attractive live examples, and genuinely type-aware editable TypeScript. Keep the exhaustive deterministic scenarios intact in a clearly separated automated-testing area.

No `@crc/core` public API changes are part of this phase.

## Recommended continuation prompt

> Read `docs/project-plans/WORKFLOW.md` and the active plan named by `docs/project-plans/README.md`. Execute the step carrying the active next-step marker, meet its completion bar, run its verification, update the markers and decision/session logs, and stop.

## Locked experience

- `#/examples` is the default destination.
- The studio uses a playful Bauhaus-inspired system: warm cream, ink, cobalt, coral, yellow, and mint; Space Grotesk for UI text and JetBrains Mono for code.
- Desktop uses a persistent categorized sidebar. Narrow layouts use an accessible navigation drawer.
- Learning navigation contains Start, Drawing, Composition, Mouse events, and Advanced interactions. Internal scenario metadata never appears on learning pages.
- Every learning page includes a concise explanation, two objectives, a large live Canvas, a dark type-aware TypeScript editor, debounced execution, try-it prompts, focused API notes, and previous/next links.
- The landing page is an interactive visual hub rather than a scenario metadata index.
- Existing scenarios live at `#/testing` and `#/testing/<slug>`. Legacy `#/scenarios` routes redirect there.

## Technical contract

- Private content is split into `learningExampleCatalog` and `scenarioCatalog`.
- Every learning source exports `default function mount(canvas: HTMLCanvasElement): CRCController`, imports only from `@crc/core`, and contains no test markers or diagnostic scaffolding.
- Monaco Editor 0.56 is route-lazy and receives CRC's public declarations for diagnostics, completion, hover, and emitted JavaScript.
- Successful source is executed in a replaceable opaque iframe with `sandbox="allow-scripts"`; the parent and frame communicate through versioned, source-checked, run-ID-checked message unions.
- Invalid edits preserve the last successful preview. Frame replacement disposes the previous controller.
- Edited code is stored as a versioned compressed hash-query payload. Canonical source removes the payload; URLs longer than 16,000 characters are not shared.
- Automated test source is collapsed, syntax-highlighted, and read-only. Existing IDs, actions, fixtures, baselines, and headless consumers remain stable.

## Learning inventory

- Start: Getting started.
- Drawing: Rectangle, Path, SVG path, Line, Horizontal line, Vertical line, Text, Image.
- Composition: Group, Clip, Layer.
- Mouse events: Click, Double click, Context menu, Mouse move, Mouse over, Mouse out, Mouse down, Mouse up.
- Advanced interactions: Event sequences, Hit areas and cursors, Overlap and paint order, Transformed/clipped/layered targets.

The inventory totals 24 unique learning routes: one start lesson, eleven drawing/composition lessons, eight mouse-event lessons, and four advanced lessons.

## Status board

| Step   | Queue state | Outcome                                                                                                                |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| IES-01 | Done        | Established the two catalogs, route model, responsive shell, visual system, landing page, and testing-area separation. |
| IES-02 | Done        | Built the lazy type-aware editor, compiler bridge, sandbox protocol, and editing controls.                             |
| IES-03 | Done        | Replaced bundled drawing material with eleven focused drawing/composition lessons.                                     |
| IES-04 | Done        | Added eight mouse-event lessons and four advanced interaction lessons.                                                 |
| IES-05 | Done        | Finished redirects, test presentation, docs, accessibility/performance hardening, visuals, and trust verification.     |

## IES-01 [DONE] — Catalogs, routes, and studio shell

### Goal

Create the learner-first information architecture and visually distinct studio while preserving test scenarios behind a separate route family.

### Deliverables

- Typed learning metadata/catalog separate from the existing test catalog.
- `#/examples` landing and learning route model.
- Responsive sidebar/drawer shell and Bauhaus visual tokens.
- Interactive CRC hero and visual category cards.
- `#/testing` index/detail routes with legacy scenario redirects.

### Done when

- The two catalog concerns are type-separated.
- Public navigation matches the locked inventory and reflows at 320px.
- Learning pages expose no internal scenario identifiers, maturity, or manual test procedure.
- Existing scenario routes and consumers still resolve through the testing area.

### Verification

- Catalog validation and route tests.
- Source-mode playground build.
- Desktop and 320px manual navigation review.

## IES-02 [DONE] — Type-aware editor and isolated runner

### Goal

Make canonical lesson source genuinely editable, type-aware, safe to execute, and shareable.

### Deliverables

- Lazy Monaco integration and CRC declaration adapter.
- TypeScript diagnostics, completions, hover, bracket matching, and emitted JavaScript bridge.
- Opaque sandbox runner with versioned messages, logging, runtime errors, disposal, and stale-run cancellation.
- Debounced run, last-good preview, copy, reset, share, format, and accessible status/output UI.
- Versioned Unicode-safe compressed route payloads and 16,000-character guard.

### Done when

- Syntax/type errors block replacement and appear inline while the previous preview remains live.
- The frame has `sandbox="allow-scripts"` only and rejects untrusted source/run messages.
- Repeated replacement retains no old controller or message listener.
- Landing and testing index routes load no Monaco/editor workers.

### Verification

- Editor worker diagnostics/completion tests.
- Sandbox and lifecycle browser tests.
- URL round-trip, malformed/oversized payload, and history tests.

## IES-03 [DONE] — Drawing and composition lessons

### Goal

Teach each supported drawing/composition primitive through one focused and visually purposeful page.

### Deliverables

- Rectangle, Path, SVG path, Line, Horizontal line, Vertical line, Text, Image, Group, Clip, and Layer sources.
- Concise explanations, exactly two objectives, gesture/code prompts, API notes, and relationships.

### Done when

- All eleven exports have exactly one canonical, type-clean, mountable, disposable lesson.
- Each lesson imports only `@crc/core`, teaches one concept, and is used by the browser checks.

### Verification

- Exact export/route coverage assertion.
- Canonical-source type/emission/mount checks.
- Representative visual and pixel evidence.

## IES-04 [DONE] — Mouse and advanced interaction lessons

### Goal

Teach every existing mouse event and the composition rules needed to reason about realistic interaction scenes.

### Deliverables

- Eight focused mouse-event lessons with visible feedback.
- Event sequences, hit areas/cursors, overlap/paint order, and transformed/clipped/layered target lessons.

### Done when

- Every supported mouse prop appears in exactly one focused lesson.
- All four advanced routes expose purposeful interactive scenes and observable behavior.
- Lessons state CRC's mouse-only and Canvas-accessibility limitations clearly.

### Verification

- Exact event-prop/route coverage assertion.
- Browser-driven canonical lesson interaction checks.
- Representative visual baselines.

## IES-05 [DONE] — Hardening, documentation, and trust gate

### Goal

Finish presentation and compatibility details, document the new architecture, and prove the complete studio through the repository's trust gate.

### Deliverables

- Syntax-highlighted collapsed test-source viewer and explanatory testing-area copy.
- Legacy redirects, generated learning/test catalog documentation, and README updates.
- Keyboard, focus, live-region, reduced-motion, zoom/reflow, and performance hardening.
- Desktop/narrow visual baselines for landing, primitive, mouse, advanced, and test-lab layouts.

### Done when

- All 24 learning routes are unique, source-backed, type-clean, compilable, mountable, disposable, resettable, and navigable.
- Existing test definitions, IDs, actions, fixtures, visual baselines, and headless consumers remain intact.
- Source and built playgrounds, catalog generation/checks, browser/visual suites, package consumers, lint, typecheck, and `pnpm trust` pass.

### Verification

- `pnpm trust` and the documented source/built/manual checks.
- Keyboard-only, 320px, 200–400% zoom, and reduced-motion review.
- Confirm Monaco/editor chunks are absent from landing and testing-index loads.

## Decision log

| Date       | Decision                                                                                                             | Evidence / rationale                                                                                                                                                                                                                                                 | Revisit trigger                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 2026-08-12 | Separate educational examples from deterministic browser fixtures instead of repurposing one content model for both. | Learning content needs conceptual sequencing, clean copyable source, and visual teaching scenes; test fixtures need IDs, deterministic actions, diagnostics, and exhaustive edge cases. Sharing the private runtime is useful, sharing presentation metadata is not. | A future catalog consumer needs a deliberately unified view across both concerns.                  |
| 2026-08-12 | Use a Bauhaus studio system over a restrained grid foundation.                                                       | Geometric forms and primary accents make a drawing library feel playful and directly demonstrate its subject, while the consistent grid, restrained body typography, and dark editor preserve clarity.                                                               | Visual review shows decoration competing with preview/editor hierarchy or harming contrast/reflow. |
| 2026-08-12 | Treat the sandbox boundary and type-clean emission as prerequisites for automatic execution.                         | Shared edits auto-run; opaque origin isolation, validated messages, and last-good replacement prevent broken or untrusted edits from affecting the parent application.                                                                                               | Browser platform changes or runtime needs require a stronger execution boundary.                   |

## Session log

- **2026-08-12 — Plan activated.** Archived project plan 001 after GitHub Actions run 31607284354 passed for commit `958e531470e5903a6340de562d817098551a2170`. Recorded that GitHub branch protection is unavailable for this private repository on its current tier. Established the 24-route learner inventory, isolated test-lab route family, editor/sandbox contract, five ordered delivery steps, and acceptance bars. Active slice: **IES-01 catalogs, routes, and studio shell**.
- **2026-08-12 — IES-01 through IES-04 complete.** Split learning examples from deterministic fixtures, launched the responsive studio and test-lab routes, added all 24 canonical lesson sources, and implemented the lazy Monaco/TypeScript workbench plus opaque replaceable runner. Catalog and source checks covered every lesson; focused browser checks passed 29 assertions across catalog mounting and compressed sharing. Manual Chromium review covered desktop and 320px navigation, editor diagnostics/completion, invalid-edit retention, sandbox isolation, reruns, sharing, and the representative learning layouts. Evidence: [IES-01](../testing/field-notes/ies-01.md), [IES-02](../testing/field-notes/ies-02.md), [IES-03](../testing/field-notes/ies-03.md), and [IES-04](../testing/field-notes/ies-04.md).
- **2026-08-12 — IES-05 complete; plan complete.** Preserved all 13 deterministic fixtures under `#/testing`, finished legacy redirects and read-only test-source presentation, updated the generated catalog and documentation, hardened drawer/focus/reduced-motion behavior, and adopted five reviewed full-page baselines. The complete `pnpm trust` gate passed 36 browser files with 294 passing tests and two intentional timing skips, source/built playground builds, packed consumers, visual safeguards, built smoke, lifecycle 9/9, performance 3/3, and the 5/5 studio visual comparison. Node 24.12 emitted the expected warning against the documented Node 24.15 minimum without failing a command. Evidence: [IES-05](../testing/field-notes/ies-05.md). No next phase is activated.
