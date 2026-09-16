export type PhysicsWorld3DTraceRecord =
  | Readonly<{
      kind: "physics-3d-clamp";
      frameId: number;
      logicalTime: number;
      acceptedElapsedMilliseconds: number;
      discardedElapsedMilliseconds: number;
    }>
  | Readonly<{
      kind: "physics-3d-tick";
      frameId: number;
      logicalTime: number;
      tick: number;
    }>
  | Readonly<{
      kind: "physics-3d-ccd-cap";
      frameId: number;
      tick: number;
      cappedBodies: number;
    }>
  | Readonly<{
      kind: "physics-3d-collision-failure";
      frameId: number;
      tick: number;
      firstCollider: number;
      secondCollider: number;
      reason: "gjk" | "epa" | "nonfinite";
    }>
  | Readonly<{
      kind: "physics-3d-candidate";
      frameId: number;
      logicalTime: number;
      tick: number;
      stepCount: number;
    }>
  | Readonly<{
      kind: "physics-3d-adopt" | "physics-3d-discard";
      frameId: number;
      tick: number;
    }>
  | Readonly<{
      kind: "physics-3d-error";
      frameId: number;
      logicalTime: number;
      stage: string;
      error: unknown;
    }>;

export type PhysicsWorld3DTraceCollector = (
  record: PhysicsWorld3DTraceRecord,
) => void;

let traceCollector: PhysicsWorld3DTraceCollector | undefined;

/** @internal Emits bounded facts without retaining simulation history. */
export function recordPhysicsWorld3DTrace(
  record: PhysicsWorld3DTraceRecord,
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
export function installPhysicsWorld3DTraceCollectorForTest(
  collector: PhysicsWorld3DTraceCollector,
): () => void {
  const previous = traceCollector;
  traceCollector = collector;
  return () => {
    if (traceCollector === collector) traceCollector = previous;
  };
}
