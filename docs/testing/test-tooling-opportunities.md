# Test tooling opportunities

This ranking synthesizes repeated friction recorded across DEP-01–04 and TFC-01–09. A recurring problem qualifies only when a stable helper would reduce drift without hiding the public contract.

## P0 — install in the trust gate

| Opportunity                           | Repeated evidence                                                                                                                                           | TFC-10 disposition                                                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog discovery/index validator     | Catalog/source/action drift recurred in DEP-01, TFC-02, TFC-04, TFC-05, TFC-08, and TFC-09. Manual maps cannot detect omitted example files.                | Implemented as a check-only filesystem/catalog/source/index gate.                                                                             |
| Documentation/public-surface verifier | The JSX pivot changed every authoring name, compiler entry, source extension, and guide while historical records intentionally retained the old vocabulary. | Implemented as `docs:check`: active links/vocabulary, exact exports, acceptance mappings, configuration markers, and compile-backed fixtures. |
| Visual failure/recovery safeguard     | DEP-01/04 and TFC-05/09 needed deliberate mismatches, artifact inspection, baseline immutability, and recovery.                                             | Implemented as one scripted negative/positive guard.                                                                                          |
| Packed-package consumer               | DEP-03 and TFC-08 found export-map and source-leak risks that workspace symlinks cannot expose.                                                             | Implemented with real tarballs plus strict Bundler/NodeNext/runtime checks.                                                                   |

## P1 — next internal helpers

1. **Shared raw-CDP mouse driver.** DEP-01/04 and TFC-01/04/05 repeatedly solved Canvas-to-screen scaling, distinct press/release, fixed viewport/DPR, movement waypoints, and trace capture. Consolidate the current support modules without creating a production input API.
2. **Table-driven visual specification.** DEP-01/03/04 and TFC-05/09 repeat baseline naming, expected/actual/diff paths, native sizing, masks, pixel probes, drills, and recovery. A declarative internal spec could remove boilerplate while keeping every tolerance visible.

## P2 — compose existing diagnostics when needed

- **Runtime ownership ledger:** combine the existing listener/frame/instance/ref probes and cycle assertions when another resource class appears. Do not expose it from production builds.
- **Controlled Canvas-command recorder:** standardize `Path2D`, text, transform, clipping, and `drawImage` call assertions used in TFC-08/09.
- **Deterministic image scheduler:** reuse controlled load/error/source generations for future async components rather than relying on network timing.
- **Reference benchmark reporter:** format environment, workload structure, median/p95, and trigger comparisons from TFC-01/06 without turning wall-clock observations into default CI flakes.

## Deferred

- A bundled deterministic test font is unnecessary while glyph appearance is masked and exact Canvas calls/metrics are the supported contract. Revisit only if glyph rasterization itself becomes a product promise.
- Heap/GC assertions remain supplemental. Deterministic acquisition/release ledgers are a stronger required signal.
- A general Pibbl testing framework is not justified. The current helpers should remain internal and narrow until another project phase proves stable call shapes.
