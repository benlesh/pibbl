# Repository evidence and capability boundaries

This appendix records source-level observations from the working tree inspected on October 2, 2026. No application build, browser review, or runtime test suite was run for this documentation-only task. Existing uncommitted changes were preserved. Source presence is not a statement that a change has been released publicly.

Links below work within the repository. They are optional context when the planning folder is shared alone; the important constraints are summarized in this pack.

## Current website foundations

| Observation                                                                                           | Repository source                                               | Planning implication                                                                 |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Example pages embed a workbench alongside lesson material                                             | [Example pages](../../playground/src/examples/example-pages.ts) | Separate live demo browsing from dedicated full-page editing                         |
| Example routes use group and slug; API routes use authoring categories                                | [Routes](../../playground/src/app/routes.ts)                    | A new taxonomy needs a migration map, not gratuitous URL breakage                    |
| URL sharing compresses one source string, uses a `v1.` payload, and flags URLs over 16,000 characters | [Share code](../../playground/src/share-code.ts)                | Reuse knowledge and preserve compatibility; redesign for complete projects if needed |
| Invalid shared payloads currently fall back to canonical source with an issue                         | [Share code](../../playground/src/share-code.ts)                | Make recovery conspicuous and avoid implying edited source loaded                    |
| A sandbox runner has mounted/log/error messages and a startup timeout                                 | [Sandbox runner](../../playground/src/sandbox-runner.ts)        | Audit existing execution and recovery before choosing a replacement                  |
| API overview organizes components, functions, hooks, and types, with additional feature explanations  | [API overview](../site/api/index.md)                            | Capability navigation can be added while retaining symbol-level reference            |
| Public search boundaries are defined in repository instructions                                       | [Working agreements](../../AGENTS.md)                           | Planning docs and test labs remain outside public search                             |

The current API overview includes language about optional packages while its imports and the current package manifest use feature subpaths. Treat that as rewrite input to verify against exports, not terminology to copy unquestioningly.

## Example source sizes

A line count is a triage signal, not a quality rating. These are raw file lines in the inspected working tree, including imports, spacing, and setup. They are not the meaningful-code budgets proposed in the editorial directives.

| Example                                                                                                          | Lines | Possible editorial treatment                                                      |
| ---------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------- |
| [Responsive line](../../packages/scenarios/src/learning/composition/viz-responsive-line.example.tsx)             | 1,175 | Extract minimal chart and responsiveness lessons; assess full scene as a showcase |
| [Points and inspection](../../packages/scenarios/src/learning/composition/viz-points-and-inspection.example.tsx) | 922   | Separate point rendering from inspection/comparison machinery                     |
| [Plasma globe](../../packages/scenarios/src/learning/composition/plasma-globe.example.tsx)                       | 646   | Keep a compelling full version and isolate one electrical interaction             |
| [Hover comparison](../../packages/scenarios/src/learning/composition/viz-hover-comparison.example.tsx)           | 572   | Extract one hover rule before offering comparison modes                           |
| [Physics 2D](../../packages/scenarios/src/learning/composition/physics-2d.example.tsx)                           | 363   | Identify one body interaction and its necessary setup                             |
| [Living ink](../../packages/scenarios/src/learning/composition/living-ink.example.tsx)                           | 290   | Extract one surface, gesture, and parameter                                       |
| [Stirred ink](../../packages/scenarios/src/learning/composition/stirred-ink.example.tsx)                         | 226   | Separate texture stirring from the larger material/physics composition            |
| [HtmlBox](../../packages/scenarios/src/learning/composition/html-box.example.tsx)                                | 71    | Useful compact starting point for a native-control lesson                         |
| [Underwater](../../packages/scenarios/src/learning/composition/underwater.example.tsx)                           | 69    | Inspect as an existing candidate for concise visual appeal                        |

These candidates have not been visually ranked. A later audit should run them before deciding keep, simplify, split, or remake.

## Capabilities and limits relevant to the brief

### Core and imports

The current [core manifest](../../packages/core/package.json) exposes particles, textures, visualization, and physics feature subpaths. Use actual public entries in rewritten examples. `@pibbl/core/internal` is not an application API. Current [runtime exports](../../packages/core/src/index.ts) and tests outrank historical plans.

### HTML

The [HtmlBox contract](../design/html-box-contract.md) describes a native HTML boundary in a Pibbl allocation. Hosts sit above Canvas, retain native behavior, and require explicit overlay setup. DOM content does not feed intrinsic sizing back into Pibbl. Canvas filters and non-default composition around HTML are rejected. A Canvas screenshot omits HTML; gallery captures must include the browser composition.

This newly implemented boundary is important design input and is present in the inspected working tree. The pack does not claim fresh verification of its implementation or a published release. Avoid applying the older broad “no HTML” assumption to the new site, while preserving the narrower limit that arbitrary Canvas content does not gain automatic semantic DOM.

### Three and external layers

The [render layer and Three contract](../design/render-layer-and-three-contract.md) defines one external bitmap and interaction boundary with explicit resource ownership. The application uses normal Three resources. It does not gain a Pibbl Three JSX reconciler, interleaved Canvas/Three subprimitives, a Three physics binding, or WebXR support. Rendering capabilities include OffscreenCanvas and transferToImageBitmap requirements.

### Signals and animation

The [signals and scheduling contract](../design/signals-and-scheduling-contract.md) and [animation contract](../design/animation-contract.md) establish explicit synchronous signals and shared scheduling. Examples should use those lifecycles rather than introduce another animation clock. Ordinary immediate-mode Canvas content repaints; explicit Layers and external layers are retained boundaries.

### Textures and physics

The [procedural textures guide](../site/learn/guides/procedural-textures.md) describes living surfaces, shared texture resources, parameter updates, and stirring. It explicitly distinguishes movement-driven texture response from fluid simulation. The [2D physics contract](../design/physics-2d-contract.md) defines the runtime; pure 3D geometry does not imply a 3D physics runtime.

### Accessibility and presentation

The [Canvas accessibility guidance](../design/canvas-accessibility-guidance.md), [focus contract](../design/focus-and-keyboard-navigation-contract.md), and [style contract](../design/style-system-contract.md) are references for later implementation. Native HTML retains its semantics; Canvas needs deliberate alternatives. Pixel effects should not be described as changing hit geometry.

## What remains unverified

The planning proposals have not been user-tested, browser-tested, or visually designed. Idea scores are editorial judgments. The complete current example catalog has not been audited, and current playground isolation has not received a security assessment in this task. URL length policy, multifile project format, version retention, download packaging, and exact route migration remain future design work.
