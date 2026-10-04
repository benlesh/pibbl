# Composable path transformations

This implemented contract supersedes the public function signatures in the
Four-corner path warp and Along Arc/Along Path sections of
[drawing components](drawing-components-contract.md). Their single-operation
geometry, placement, ownership, and precision rules continue through the new
constructors and application function. Historical plans retain their original names.

## Public model

`affineTransform`, `quadTransform`, `arcBendTransform`, `pathBendTransform`,
`envelopeTransform`, and `meshTransform` return opaque reusable `PathTransform`
values. Definitions snapshot their input geometry and options. `mapPoint` maps
ordinary coordinates; it takes an optional positive destination-unit tolerance,
defaulting to 0.0001. Constructors own no scheduler or external resources.

`composeTransforms` applies definitions left to right. Empty composition is
identity. Source rectangles belong to individual mappings; downstream rectangles
refer to upstream output coordinates. `transformPath` produces an independent
`PathGeometry`, never mutating the source. It handles continuous source curves,
arcs, closing edges, and isolated moves. All-affine compositions preserve segment
kinds; nonlinear compositions return Move/Line/Close geometry.

Required positive `tolerance` bounds approximation in final destination units,
including guide measurement and downstream amplification. `maxSegments` defaults
to one million and counts Move and Close. Geometry is published only on success;
nonfinite results, invalid domains, exhausted output/work budgets, or unattainable
precision throw. Conservative interval derivatives handle smooth pieces; speed
bounds cover guide and cell seams. No finite sampling heuristic claims a bound
for an arbitrary callback; custom callback transforms are not exposed.

Single quad and bend applications reuse the established specialized algorithms.
Composition evaluates the combined mapping against the original outline before
final approximation. Sequential applications are supported, but their independent
errors may be magnified by later mappings. Source topology and stroke outlines
are not repaired; intentional foldovers may overlap.

## Envelopes and meshes

An envelope accepts top/bottom guides or ordered guides with normalized `at`
positions increasing from zero to one. It interpolates linearly between adjacent
guides. Guides are single nonzero-length open contours matched by arc length;
reverse and strictly increasing normalized correspondence stations are explicit.
Interior guide joins may crease. Unlike bend guides, these guides need not have
smooth tangents. Outside-source geometry is rejected, subject to finite-precision
boundary allowances. A positive-sized source rectangle is required.

Meshes define normalized row/column axes and shared horizontal/vertical edge
arrays. Each cell uses a Coons mapping. Edges must meet at identical endpoints;
no automatic snapping, intersection discovery, or smooth-join solving occurs.
Shared boundaries guarantee positional continuity, not slope continuity. Up to
4,096 cells are accepted. Mesh domains have the same source restriction as envelopes.

## Evidence and interactive surface

`path-transforms.test.ts` covers composition, independent materialization, snapshots,
correspondence, shared edges, nonlinear final-space error, and invalid inputs.
The migrated `path-warp` and `path-bending` suites retain their analytic and
integration assertions through the supported public constructors.

The `text-envelope` Studio lesson uses `@crc/text` outlines, editable text,
freely draggable guide points, presets, intermediate guides, and composed affine
placement. It owns its font, controls, resize observer, and pointer captures and
releases them on disposal. Native controls are demo UI, not a public semantic-DOM API.

## Final verification (2026-10-04)

Node 24.15.0, pnpm 11.21.0, and Playwright Chromium were used. The 56 focused
transform/public-export tests and 232 catalog tests passed. The wider browser
run passed 3,622 tests before two catalog assertions were updated and the complete
catalog suite rerun. Type checking, lint, source/built Studio builds, Bundler and
NodeNext consumers, `trust:package`, `trust:lifecycle`, built smoke, documentation
navigation/search, visual safeguard, agent-verification checks, and source/production
text browser tests passed. The envelope demo also passed text editing, all presets,
five guides, freeform dragging, rotation/skew composition, guide visibility, and
empty-text recovery in source and production builds without browser errors.

The aggregate `trust` gate is not green: unchanged main at `96732539` reproduces
the stale textures-contract semantic-unit record. Studio visual checks also
reproduce unchanged-main differences for filters (23,256 pixels), the homepage
after visiting API documentation (5,612 pixels), and the finished diagram after
its landing page (7,754 pixels). Isolated homepage and finished-diagram checks
pass. Those baselines were preserved. Only the API-page baseline changed: inspection
of expected, actual, and diff images confirmed that its 21,772 changed pixels are
confined to the sidebar where the new Composable path transforms link shifts the
following entries. The updated API baseline and all other unaffected routes pass.
