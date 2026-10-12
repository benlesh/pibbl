# Documentation information architecture and search field note

> **Historical status: IMPLEMENTATION FIELD NOTE.**

**Recorded:** 2026-09-10

**Implementation revision under test:** `b626e44b8f6e20c02d7adc3c864841fc100b17ba`
**Environment:** Darwin arm64, Node `v24.15.0`, pnpm `11.21.0`, Playwright
`1.62.1`, Chromium through the repository Playwright installation.

## Scope verified

This field note records the searchable public Studio implementation: validated
Markdown under `docs/site/`, the Learn/API/Examples navigation hierarchy,
grouped public examples, canonical and legacy routes, static MiniSearch, and
the continued separation of deterministic Automated Test Labs.

The revision under test was the accepted implementation revision named above;
this field note and its durable documentation accompany that implementation.
The verification commands below ran against the resulting working tree under
the recorded Node 24 LTS environment.

## Focused evidence

| Command                                    | Fresh result                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm@11.21.0 studio-docs:check`  | PASS. Validated public Markdown metadata and safe rendering, public API coverage (58 values and 152 types), deterministic manifest, and deterministic public MiniSearch records/ranking. |
| `corepack pnpm@11.21.0 test:studio-docs`   | PASS. Rebuilt the Studio, validated source/built declaration parity with 151 structural type checks, then completed the public documentation navigation/search browser acceptance.       |
| `corepack pnpm@11.21.0 test:studio-visual` | PASS. Matched 6 full-page Studio visual baselines.                                                                                                                                       |

The acceptance run opens search only after an explicit search action; it
observes the lazy search module before and after that action, searches for an
exact API name, exercises result-kind filtering and keyboard selection, and
checks the retry path. Its public-result assertions reject `#/testing` and
internal records. The generated search bundle is local browser data: no remote
request, service, analytics call, or crawler participates in the search flow.

## Route and responsive review

The public shell and route outcomes were reviewed at the standard desktop
profile and narrow mobile profile:

- Desktop: `#/learn`, `#/api/functions/pibbl`, `#/examples`,
  `#/examples/drawing/filters`, search opened from `#/learn`, and
  `#/testing/baseline-smoke`.
- Narrow: `#/learn`, `#/api`, `#/examples`, the filters example, and the
  search dialog with the keyboard-accessible navigation drawer.
- Legacy route behavior: old document aliases and prior learning-example group
  paths canonicalize while retaining anchors/share queries; `#/scenarios` and
  `#/scenarios/baseline-smoke` canonicalize to the separate `#/testing` route
  family.

The public sidebar begins Learn, API, then Examples. Learn keeps curated
Tutorials followed by Guides; runtime Components, Functions, and Hooks are
alphabetized; Types remain grouped by domain; and Examples are grouped as
Drawing, Composition, Layout, Events and interaction, and Focus and keyboard,
with Filters in Drawing and entries alphabetized within a group. Test labs do
not appear in this public hierarchy or in public search.

## Preserved surfaces

Learning examples still use their route-lazy Monaco workbench and exactly one
opaque `sandbox="allow-scripts"` preview frame. The acceptance and visual
checks verify that the sandbox contract remains in place. The test-lab route
continues to expose its deterministic scenario, controls, IDs, action sets,
diagnostic state, baseline contract, and headless browser consumers; it is only
removed from public navigation and search discovery, not from verification.

## Visual baseline review

The documentation-navigation change intentionally replaced the former
lesson-oriented Studio visual set with six explicit public-surface baselines.
No baseline was updated merely to clear a failing comparison.

| Baseline                               | Reason for intentional change                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `studio-learn-landing.expected.png`    | Replaces the old landing composition with the Learn landing and persistent three-area navigation.                          |
| `studio-api-pibbl.expected.png`        | Adds the focused API-reference page to visual coverage.                                                                    |
| `studio-examples-landing.expected.png` | Adds the public grouped Examples landing to visual coverage.                                                               |
| `studio-filters.expected.png`          | Replaces the generic primitive/mouse coverage with the canonical Drawing/Filters public example.                           |
| `studio-search-open.expected.png`      | Adds the open, accessible local-search dialog and result-shell state.                                                      |
| `studio-test-lab.expected.png`         | Updates the retained test-lab surface for the new shared Studio shell while preserving its deterministic fixture contract. |

The retired `studio-landing`, `studio-primitive`, `studio-mouse`, and
`studio-advanced` images covered superseded shell states; the new set keeps
test-lab coverage and adds direct coverage for Learn, API, Examples, Filters,
and search.

## Aggregate gate

`corepack pnpm@11.21.0 trust` completed with exit status 0 after the durable
documentation and field-note updates. The fresh aggregate covered static,
package, browser, and lifecycle gates. Its static phase validated 50 lessons
and 17 test labs; documentation validation reported 11 guides, 114
current/migration files, 68 historical/work records, 58 values, 151 types,
and 810 RED mutation probes. The browser phase included the public
documentation/search acceptance, visual safeguard/recovery, six Studio visual
baselines, and built smoke. A fresh full browser-suite rerun reported 126 test
files passing, 1,630 tests passing, and 2 skipped (1,632 total). The package
consumer, lifecycle ownership, and structural performance gates passed as part
of the aggregate command. No historical suite total is presented as current
evidence.

## Follow-up

The published diagram-editor page is a syllabus, not a fictitious completed
tutorial. A separate approved design and implementation plan is still required
to author its twelve independently runnable chapters and to add future guides.
Likewise, a framework migration remains a future decision; this implementation
intentionally keeps the existing Vite Studio and static local search.
