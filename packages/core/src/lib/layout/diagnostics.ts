export interface LayoutDiagnosticSnapshot {
  layoutEvaluations: number;
  measurements: number;
  placements: number;
}

const counters: LayoutDiagnosticSnapshot = {
  layoutEvaluations: 0,
  measurements: 0,
  placements: 0,
};

/** @internal Structural evidence for tests and diagnostics, not a public API. */
export function recordLayoutEvaluation(): void {
  counters.layoutEvaluations++;
}

/** @internal Structural evidence for tests and diagnostics, not a public API. */
export function recordLayoutMeasurement(): void {
  counters.measurements++;
}

/** @internal Structural evidence for tests and diagnostics, not a public API. */
export function recordLayoutPlacement(): void {
  counters.placements++;
}

/** @internal */
export function resetLayoutDiagnostics(): void {
  counters.layoutEvaluations = 0;
  counters.measurements = 0;
  counters.placements = 0;
}

/** @internal */
export function snapshotLayoutDiagnostics(): Readonly<LayoutDiagnosticSnapshot> {
  return { ...counters };
}
