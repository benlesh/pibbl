export type PhysicsWorld2DTraceRecord =
  | Readonly<{
      kind: "physics-2d-clamp";
      frameId: number;
      logicalTime: number;
      acceptedElapsedMilliseconds: number;
      discardedElapsedMilliseconds: number;
    }>
  | Readonly<{
      kind: "physics-2d-tick";
      frameId: number;
      logicalTime: number;
      tick: number;
    }>
  | Readonly<{
      kind: "physics-2d-candidate";
      frameId: number;
      logicalTime: number;
      tick: number;
      stepCount: number;
    }>
  | Readonly<{
      kind: "physics-2d-adopt" | "physics-2d-discard";
      frameId: number;
      tick: number;
    }>
  | Readonly<{
      kind: "physics-2d-error";
      frameId: number;
      logicalTime: number;
      error: unknown;
    }>;

export type PhysicsWorld2DTraceCollector = (
  record: PhysicsWorld2DTraceRecord,
) => void;

let traceCollector: PhysicsWorld2DTraceCollector | undefined;

/** @internal Emits no retained history and cannot affect simulation results. */
export function recordPhysicsWorld2DTrace(
  record: PhysicsWorld2DTraceRecord,
): void {
  const collector = traceCollector;
  if (collector === undefined) return;
  try {
    collector(Object.freeze(record));
  } catch {
    if (traceCollector === collector) traceCollector = undefined;
  }
}

/** @internal Test/diagnostic seam; deliberately absent from package entries. */
export function installPhysicsWorld2DTraceCollectorForTest(
  collector: PhysicsWorld2DTraceCollector,
): () => void {
  const previous = traceCollector;
  traceCollector = collector;
  return () => {
    if (traceCollector === collector) traceCollector = previous;
  };
}
