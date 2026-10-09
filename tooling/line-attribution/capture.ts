/** Development-build instrumentation. Never imported by published runtime source. */
import { GLOBAL_STATE } from "../../packages/core/src/lib/global-state";
import { getCurrentWorldTransform } from "../../packages/core/src/lib/render-target";
import type {
  PibblInstance,
  PibblRenderTransaction,
  RenderingContext2D,
} from "../../packages/core/src/lib/types";
import type {
  ResolvedScale,
  ScaleId,
} from "../../packages/core/src/features/viz/lib/types";

type Point = { x: number; y: number };
type Matrix = readonly [number, number, number, number, number, number];
type SourcePoint = {
  index: number;
  datum: unknown;
  x: number;
  y: number;
  px: number;
  py: number;
};
type Segment = { from: SourcePoint; to: SourcePoint; path: Path2D };
type ClipFact = { path: Path2D; fillRule: CanvasFillRule; transform: Matrix };
type SurfaceFact = {
  logicalToBacking: Matrix;
  backingWidth: number;
  backingHeight: number;
};
type ScaleFact = {
  id: string | { symbolId: number };
  type: string;
  domain: readonly unknown[];
  range: readonly number[];
};
interface LineCapture {
  run: SourcePoint[];
  segments: Segment[];
  xScale: ScaleFact;
  yScale: ScaleFact;
  reason: string | null;
}
interface PaintedLine extends LineCapture {
  path: Path2D;
  transform: Matrix;
  clips: ClipFact[];
  strokeWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  miterLimit: number;
  dash: number[];
  dashOffset: number;
}
interface Session {
  status: "waiting" | "ready" | "render-failed" | "unsupported" | "disposed";
  generation: number | null;
  lines: PaintedLine[];
  reasons: string[];
  instance?: PibblInstance;
  pending?: {
    transaction: PibblRenderTransaction;
    lines: PaintedLine[];
    reasons: string[];
  };
  context: CanvasRenderingContext2D | null;
  scaleIds: Map<symbol, number>;
  surface?: SurfaceFact;
}
const sessions = new WeakMap<HTMLCanvasElement, Session>();
const paths = new WeakMap<Path2D, LineCapture>();
const MAX_SEGMENTS = 1024,
  MAX_LINES = 32,
  MAX_CLIPS = 16;
const matrix = (m: DOMMatrixReadOnly): Matrix =>
  Object.freeze([m.a, m.b, m.c, m.d, m.e, m.f]);
const addReason = (pending: { reasons: string[] }, reason: string) => {
  if (!pending.reasons.includes(reason) && pending.reasons.length < 8)
    pending.reasons.push(reason);
};
const currentSession = () => {
  const instance = GLOBAL_STATE.currentPibblInstance;
  return instance?.eventRoot.canvas
    ? sessions.get(instance.eventRoot.canvas)
    : undefined;
};
const dispose = (s: Session) => {
  s.status = "disposed";
  s.lines = [];
  s.pending = undefined;
  s.reasons = [];
  s.context = null;
  s.instance = undefined;
  s.scaleIds.clear();
  s.surface = undefined;
};

export function beginAttributionRender(
  instance: PibblInstance,
  transaction: PibblRenderTransaction,
) {
  const root = instance.eventRoot.rootInstance;
  if (!root || !instance.eventRoot.canvas) return;
  const s = sessions.get(instance.eventRoot.canvas);
  if (!s || s.status === "disposed") return;
  if (!s.instance) {
    s.instance = root;
    root.mainTeardowns.add(() => dispose(s));
  }
  if (s.instance !== root) return;
  if (s.pending?.transaction === transaction) {
    if (instance !== root)
      addReason(s.pending, "Managed Layers are outside this slice.");
    return;
  }
  const pending = {
    transaction,
    lines: [] as PaintedLine[],
    reasons: [] as string[],
  };
  s.pending = pending;
  if (instance !== root)
    addReason(pending, "Managed Layers are outside this slice.");
  transaction.onFinish((success) => {
    if (s.status === "disposed" || s.pending !== pending) return;
    s.pending = undefined;
    if (!success) {
      s.status = "render-failed";
      return;
    }
    const surface = root.surface.snapshot;
    s.surface = surface
      ? {
          logicalToBacking: matrix(surface.renderTransform),
          backingWidth: surface.backingWidth,
          backingHeight: surface.backingHeight,
        }
      : undefined;
    if (!s.surface) addReason(pending, "Committed surface unavailable.");
    s.lines = pending.lines;
    s.reasons = pending.reasons;
    s.generation = root.renderGeneration;
    s.status = pending.reasons.length ? "unsupported" : "ready";
  });
}
export function beginLineCapture(input: {
  xId: ScaleId;
  yId: ScaleId;
  xScale: ResolvedScale;
  yScale: ResolvedScale;
  curveDefinition: unknown;
}): LineCapture | undefined {
  const s = currentSession();
  if (!s?.pending) return undefined;
  const scale = (id: ScaleId, source: ResolvedScale): ScaleFact => ({
    id:
      typeof id === "symbol"
        ? {
            symbolId:
              s.scaleIds.get(id) ??
              (() => {
                const key = s.scaleIds.size + 1;
                if (key > 64) {
                  addReason(s.pending!, "Scale identity limit exceeded.");
                  return 0;
                }
                s.scaleIds.set(id, key);
                return key;
              })(),
          }
        : id,
    type: source.type,
    domain: [...source.domain],
    range: [...source.range],
  });
  return {
    run: [],
    segments: [],
    xScale: scale(input.xId, input.xScale),
    yScale: scale(input.yId, input.yScale),
    reason:
      input.curveDefinition !== undefined ||
      input.xScale.type !== "linear" ||
      input.yScale.type !== "linear"
        ? "Only straight lines with linear scales are supported in this slice."
        : null,
  };
}
export function captureLinePoint(line: LineCapture, point: SourcePoint) {
  if (line.reason) return;
  if (line.run.length + line.segments.length >= MAX_SEGMENTS) {
    line.reason = "Segment capture limit exceeded.";
    line.run = [];
    line.segments = [];
    return;
  }
  line.run.push(Object.freeze({ ...point }));
}
export function captureLineRun(line: LineCapture, _geometry: unknown) {
  if (line.reason) return;
  for (let i = 1; i < line.run.length; i++) {
    const from = line.run[i - 1],
      to = line.run[i];
    const path = new Path2D();
    path.moveTo(from.px, from.py);
    path.lineTo(to.px, to.py);
    line.segments.push({ from, to, path });
  }
}
export function bindLinePath(path: Path2D, line: LineCapture) {
  paths.set(path, line);
}
export function captureLinePaint(path: Path2D, ctx: RenderingContext2D) {
  const line = paths.get(path),
    s = currentSession();
  if (!line || !s?.pending) return;
  paths.delete(path);
  const instance = GLOBAL_STATE.currentPibblInstance!;
  const root = instance.eventRoot.rootInstance;
  if (instance !== root || ctx !== root?.canvas.getContext("2d")) {
    addReason(
      s.pending,
      "Offscreen Layers and filters are outside this slice.",
    );
    return;
  }
  if (line.reason) {
    addReason(s.pending, line.reason);
    return;
  }
  if (
    s.pending.lines.length >= MAX_LINES ||
    GLOBAL_STATE.clippingStack.length > MAX_CLIPS
  ) {
    addReason(s.pending, "Line or clip capture limit exceeded.");
    return;
  }
  s.pending.lines.push({
    ...line,
    run: [],
    path: new Path2D(path),
    transform: matrix(getCurrentWorldTransform()),
    clips: GLOBAL_STATE.clippingStack.map((clip) => ({
      path: new Path2D(clip.path),
      fillRule: clip.fillRule,
      transform: matrix(clip.transform),
    })),
    strokeWidth: ctx.lineWidth,
    lineCap: ctx.lineCap,
    lineJoin: ctx.lineJoin,
    miterLimit: ctx.miterLimit,
    dash: ctx.getLineDash(),
    dashOffset: ctx.lineDashOffset,
  });
}
const local = (point: Point, transform: Matrix): Point | null => {
  const [a, b, c, d, e, f] = transform,
    det = a * d - b * c;
  if (!Number.isFinite(det) || det === 0) return null;
  return {
    x: (d * (point.x - e) - c * (point.y - f)) / det,
    y: (-b * (point.x - e) + a * (point.y - f)) / det,
  };
};
const source = (p: SourcePoint) => ({ index: p.index, x: p.x, y: p.y });
export function createLineAttributionInspector(canvas: HTMLCanvasElement) {
  if (sessions.has(canvas))
    throw new Error("Dispose the existing line attribution inspector first.");
  // Query-only context: probing must not disturb the application's native context.
  const scratch = document.createElement("canvas").getContext("2d");
  if (!scratch)
    throw new Error("Canvas2D attribution queries require a context.");
  const s: Session = {
    status: "waiting",
    generation: null,
    lines: [],
    reasons: [],
    context: scratch,
    scaleIds: new Map(),
  };
  sessions.set(canvas, s);
  return {
    snapshot() {
      return {
        status: s.status,
        generation: s.generation,
        reasons: [...s.reasons],
        scope: "root-straight-linear-lines-geometric-coverage",
        evidence: {
          queryCoordinates: "root-logical",
          eventCoordinates: "root-logical",
          renderTiming: "last-successful-render-may-lag-application",
          capturedPositions: "line-local",
          transforms: "local-to-root-logical",
          sourceReferences: "live-not-snapshot",
          coverage: "geometry-not-pixels-or-event-target",
          clipGeometry: "opaque-path-use-inside-outside-probes",
        },
        surface: s.surface ? structuredClone(s.surface) : null,
        lines: s.lines.map((line, order) => ({
          order,
          xScale: structuredClone(line.xScale),
          yScale: structuredClone(line.yScale),
          transform: [...line.transform],
          strokeWidth: line.strokeWidth,
          clips: line.clips.map((clip) => ({
            transform: [...clip.transform],
            fillRule: clip.fillRule,
            geometry: "captured-path",
          })),
          segments: line.segments.map((seg) => ({
            from: source(seg.from),
            to: source(seg.to),
          })),
        })),
      };
    },
    segmentAt(point: Point) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        throw new RangeError("Root point must be finite.");
      if (s.status !== "ready" || s.pending)
        return {
          status: "unavailable" as const,
          reason: s.pending ? "Rendering is pending." : s.status,
          generation: s.generation,
        };
      const surface = s.surface!;
      const [a, b, c, d, e, f] = surface.logicalToBacking;
      const bx = a * point.x + c * point.y + e,
        by = b * point.x + d * point.y + f;
      if (
        bx < 0 ||
        by < 0 ||
        bx >= surface.backingWidth ||
        by >= surface.backingHeight
      )
        return {
          status: "surface-excluded" as const,
          generation: s.generation,
        };
      const ctx = s.context!;
      let excluded = false;
      for (let i = s.lines.length - 1; i >= 0; i--) {
        const line = s.lines[i],
          p = local(point, line.transform);
        if (!p)
          return {
            status: "unavailable" as const,
            reason: "Singular transform.",
            generation: s.generation,
          };
        ctx.lineWidth = line.strokeWidth;
        ctx.lineCap = line.lineCap;
        ctx.lineJoin = line.lineJoin;
        ctx.miterLimit = line.miterLimit;
        ctx.setLineDash(line.dash);
        ctx.lineDashOffset = line.dashOffset;
        if (!ctx.isPointInStroke(line.path, p.x, p.y)) continue;
        if (
          line.clips.some((clip) => {
            const cp = local(point, clip.transform);
            return (
              !cp || !ctx.isPointInPath(clip.path, cp.x, cp.y, clip.fillRule)
            );
          })
        ) {
          excluded = true;
          continue;
        }
        const matches: number[] = [];
        for (let j = 0; j < line.segments.length; j++) {
          const seg = line.segments[j];
          // Per-segment dash phase differs; do not invent attribution for dashed paths.
          if (line.dash.length)
            return {
              status: "unavailable" as const,
              reason: "Dashed segment attribution is outside this slice.",
              generation: s.generation,
            };
          if (ctx.isPointInStroke(seg.path, p.x, p.y)) matches.push(j);
        }
        if (matches.length > 1)
          return {
            status: "ambiguous" as const,
            generation: s.generation,
            lineOrder: i,
            candidateSourceIndices: matches.map((j) => [
              line.segments[j].from.index,
              line.segments[j].to.index,
            ]),
          };
        if (matches.length === 1) {
          const j = matches[0],
            seg = line.segments[j];
          return {
            status: "segment" as const,
            generation: s.generation,
            lineOrder: i,
            segmentIndex: j,
            sourceIndices: [seg.from.index, seg.to.index],
            from: source(seg.from),
            to: source(seg.to),
            sourceReferenceSemantics:
              "live-application-references-not-captured-values" as const,
            fromSourceReference: seg.from.datum,
            toSourceReference: seg.to.datum,
          };
        }
        return {
          status: "unavailable" as const,
          reason: "Join coverage has no unique segment in this slice.",
          generation: s.generation,
        };
      }
      return {
        status: excluded ? ("clip-excluded" as const) : ("miss" as const),
        generation: s.generation,
      };
    },
    dispose() {
      dispose(s);
      if (sessions.get(canvas) === s) sessions.delete(canvas);
    },
  };
}
