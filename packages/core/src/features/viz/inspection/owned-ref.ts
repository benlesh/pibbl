import {
  captureSeriesInspectionFrame,
  useInternalHookSlot,
} from "@pibbl/core/internal";
type Point = Readonly<{ x: number; y: number }>;
interface Geometry {
  assertLive(): void;
  localAtRoot(point: Point): Point | undefined;
  rootAtLocal(point: Point): Point;
  anchorInsideClips(point: Point): boolean;
}

/** Shared private mount/generation ownership; no signal reads or query algorithms. */
export function useRenderedRef<C, R>(
  kind: string,
  build: (candidate: C, geometry: Geometry) => R,
) {
  return useInternalHookSlot(kind, (teardowns) => {
    let closed = false,
      revision = 0,
      generation = -1;
    let receiver: object | undefined,
      candidate: C | undefined,
      current: R | undefined;
    let frame: ReturnType<typeof captureSeriesInspectionFrame> | undefined;
    teardowns.add(() => {
      closed = true;
      candidate = undefined;
      current = undefined;
      frame = undefined;
      receiver = undefined;
    });
    return Object.freeze({
      capture(input: C) {
        if (closed) throw new Error("Inspection ref has been disposed.");
        const next = captureSeriesInspectionFrame();
        next.onFinish((success) => {
          if (!success || closed || !next.alive()) return;
          // Receiver removal is settled before successful render completion.
          // Check here so a keyed replacement can adopt the surviving hook.
          if (receiver && receiver !== next.receiver)
            throw new Error(
              "One inspection ref can bind only one mounted series.",
            );
          if (!receiver) {
            receiver = next.receiver;
            next.onDispose(() => {
              if (receiver !== next.receiver) return;
              candidate = undefined;
              current = undefined;
              frame = undefined;
              receiver = undefined;
              revision++;
            });
          }
          candidate = input;
          frame = next;
          revision++;
          current = undefined;
        });
      },
      rendered(): R | undefined {
        if (closed || candidate === undefined || !frame?.alive())
          return undefined;
        if (current && generation === frame.generation()) return current;
        const captured = frame.resolve();
        if (!captured) return undefined;
        if (current && generation === captured.generation) return current;
        generation = captured.generation;
        const stamp = revision,
          committedGeneration = generation;
        const transform = captured.transform,
          inverse = transform.inverse();
        const ctx = captured.canvas.getContext("2d")!;
        const assertLive = () => {
          if (
            closed ||
            revision !== stamp ||
            !frame?.alive() ||
            frame.generation() !== committedGeneration
          )
            throw new Error(
              "Rendered series is stale or disposed; obtain the current generation with rendered().",
            );
        };
        const rootAtLocal = (point: Point): Point => {
          const root = transform.transformPoint(new DOMPoint(point.x, point.y));
          return Object.freeze({ x: root.x, y: root.y });
        };
        current = build(candidate, {
          assertLive,
          rootAtLocal,
          localAtRoot(point) {
            assertLive();
            const local = inverse.transformPoint(
              new DOMPoint(point.x, point.y),
            );
            return Number.isFinite(local.x) && Number.isFinite(local.y)
              ? Object.freeze({ x: local.x, y: local.y })
              : undefined;
          },
          anchorInsideClips(point) {
            assertLive();
            const root = rootAtLocal(point);
            ctx.save();
            try {
              for (const clip of captured.clips) {
                ctx.setTransform(clip.transform);
                if (
                  !ctx.isPointInPath(clip.path, root.x, root.y, clip.fillRule)
                )
                  return false;
              }
              return true;
            } finally {
              ctx.restore();
            }
          },
        });
        return current;
      },
    });
  }).value;
}
