/**
 * Model-inference pipeline health — a Moose Riot Glass instrument on CRC Canvas 2D.
 *
 * The scene answers three questions in one 880x620 view:
 *   1. which stages of the serving path are inside their budget, and which are not
 *   2. what the shape of the change looks like, and when each stage turned
 *   3. what the causal readings say, and what to do about the stage at fault
 *
 * Design notes, role mapping and caveats live in notes.md beside this file.
 *
 * Telemetry is synthetic but model-generated (baseline + jitter + an explicit
 * regime change per stage), never a template scaled to a current total. One stage
 * genuinely stops reporting, so unknown is rendered as a gap and every dependent
 * total is published as a lower bound.
 */

import {
  Absolute,
  Circle,
  Clip,
  FocusManagement,
  Group,
  Layer,
  Path,
  Rectangle,
  Text,
  crc,
  defineTexture,
  useConst,
  useEventTarget,
  useRectPath,
  useSignal,
  useTexture,
  useTransition,
  type CRCController,
  type CRCKeyboardEvent,
  type CRCNode,
  type CRCPointerEvent,
  type WritableSignal,
} from "@crc/core";
import { blur, dropShadow, saturate } from "@crc/core/filters";
import { Axis, LineSeries, Scale, useScale } from "@crc/viz";

/* ------------------------------------------------------------------ tokens */

interface RoleTone {
  /** Readable ink for labels. */
  readonly text: string;
  /** Mode-appropriate chart step for traces, dots and chips. */
  readonly trace: string;
  readonly bg: string;
  readonly edge: string;
}

interface Elevation {
  readonly offsetY: number;
  readonly blurRadius: number;
  readonly color: string;
}

type Stops = readonly (readonly [number, string])[];

interface Theme {
  readonly mode: "light" | "dark";
  readonly canvas: string;
  readonly canvasMuted: string;
  readonly surface: string;
  readonly sunken: string;
  readonly fg: string;
  readonly fgMuted: string;
  readonly fgSubtle: string;
  readonly fgFaint: string;
  readonly border: string;
  readonly borderSubtle: string;
  readonly accent: string;
  readonly accentFg: string;
  readonly focusRing: string;
  readonly selection: string;
  readonly wash: string;
  readonly observation: RoleTone;
  readonly healthy: RoleTone;
  readonly uncertain: RoleTone;
  readonly anomaly: RoleTone;
  readonly inert: RoleTone;
  readonly paneTint: string;
  readonly paneSolid: string;
  readonly controlFill: string;
  readonly controlHover: string;
  readonly specular: Stops;
  readonly rim: Stops;
  readonly raised: Elevation;
  readonly floating: Elevation;
}

const LIGHT: Theme = {
  mode: "light",
  canvas: "#F8F7F5",
  canvasMuted: "#F2F0ED",
  surface: "#FFFFFF",
  sunken: "#0B0B0B0F",
  fg: "#141311",
  fgMuted: "#5C5A56",
  fgSubtle: "#7C7B77",
  fgFaint: "#A7A5A1",
  border: "#0B0B0B1A",
  borderSubtle: "#0B0B0B0F",
  accent: "#060504",
  accentFg: "#FFFFFF",
  focusRing: "#DE1D3F",
  selection: "#F44F5D26",
  wash: "#0B0B0B0A",
  observation: { text: "#C9002E", trace: "#DE1D3F", bg: "#FFF0EF", edge: "#FF5B6A59" },
  healthy: { text: "#293300", trace: "#8CA600", bg: "#DAF774", edge: "#AFCE008C" },
  uncertain: { text: "#754C00", trace: "#D89700", bg: "#FFF3DF", edge: "#B87C0059" },
  anomaly: { text: "#C1332C", trace: "#C1332C", bg: "#FFEFEC", edge: "#E54D4259" },
  inert: { text: "#7C7B77", trace: "#A7A5A1", bg: "#F4F2EF", edge: "#0B0B0B24" },
  paneTint: "#FBFCFD8F",
  paneSolid: "#FBFAF8",
  controlFill: "#F4F2EF",
  controlHover: "#E7E5E1",
  specular: [[0, "#FFFFFF52"], [0.28, "#FFFFFF14"], [0.55, "#FFFFFF00"]],
  rim: [[0, "#FFFFFFD9"], [0.45, "#FFFFFF59"], [1, "#16161624"]],
  raised: { offsetY: 2, blurRadius: 5, color: "#13161B0D" },
  floating: { offsetY: 8, blurRadius: 16, color: "#13161B24" },
};

const DARK: Theme = {
  mode: "dark",
  canvas: "#060504",
  canvasMuted: "#141311",
  surface: "#272623",
  sunken: "#00000047",
  fg: "#FBFAF8",
  fgMuted: "#A7A5A1",
  fgSubtle: "#7C7B77",
  fgFaint: "#5C5A56",
  border: "#FFFFFF1A",
  borderSubtle: "#FFFFFF0F",
  accent: "#FBFAF8",
  accentFg: "#060504",
  focusRing: "#F44F5D",
  selection: "#F44F5D2E",
  wash: "#FFFFFF0A",
  observation: { text: "#FF9092", trace: "#F44F5D", bg: "#CA1C392E", edge: "#FF818766" },
  healthy: { text: "#C8E928", trace: "#C8E928", bg: "#AFCE0029", edge: "#C8E92866" },
  uncertain: { text: "#ECAE30", trace: "#ECAE30", bg: "#9564002E", edge: "#ECAE3066" },
  anomaly: { text: "#FF9587", trace: "#FD7466", bg: "#C1332C33", edge: "#FF958766" },
  inert: { text: "#7C7B77", trace: "#7C7B77", bg: "#FFFFFF0F", edge: "#FFFFFF24" },
  paneTint: "#2D2E3080",
  paneSolid: "#141311",
  controlFill: "#403F3C",
  controlHover: "#37383A",
  specular: [[0, "#FFFFFF24"], [0.28, "#FFFFFF0A"], [0.55, "#FFFFFF00"]],
  rim: [[0, "#FFFFFF6B"], [0.45, "#FFFFFF1F"], [1, "#00000059"]],
  raised: { offsetY: 2, blurRadius: 6, color: "#0000004D" },
  floating: { offsetY: 10, blurRadius: 20, color: "#00000099" },
};

const FONT = {
  title: "700 22px Archivo, sans-serif",
  h4: "700 20px Archivo, sans-serif",
  rowName: "600 13px Archivo, sans-serif",
  body: "14px Archivo, sans-serif",
  action: "13px Archivo, sans-serif",
  label: "600 12px Archivo, sans-serif",
  caption: "500 12px Archivo, sans-serif",
  legend: "500 11px Archivo, sans-serif",
  value: '500 20px "IBM Plex Mono", monospace',
  rowValue: '500 13px "IBM Plex Mono", monospace',
  mono: '400 12px "IBM Plex Mono", monospace',
  monoSm: '400 11px "IBM Plex Mono", monospace',
  eyebrow: '400 10px "IBM Plex Mono", monospace',
} as const;

/* ------------------------------------------------------------------ geometry */

const W = 880;
const H = 620;

const PANE = { left: 452, top: 14, width: 404, height: 74 } as const;
const PANE_R = 18;
const BAND = { left: 466, top: 58, width: 376, height: 26 };
const BAND_MAX = 1600;
const PATH_SLO = 1000;

const TRELLIS = { left: 24, top: 96, width: 544, height: 448 } as const;
const DETAIL = { left: 584, top: 96, width: 272, height: 448 } as const;
const PANEL_R = 18;

const ROWS_TOP = 136;
const ROW_H = 60;
const ROW_INSET = 2;
const ROW_BAND_H = 56;
const LENS_LEFT = 36;
const LENS_W = 520;

const PLOT_X = 196;
const PLOT_W = 328;
const PLOT_H = 40;
const PLOT_DY = 9;
const SLO_LABEL_X = 552;

const AXIS_Y = 497;
const ROWS_BOTTOM = ROWS_TOP + 6 * ROW_H;

/* ------------------------------------------------------------------ the data */

const T0 = 780; // 13:00, minutes since midnight
const T1 = 870; // 14:30 — "now"
const STEP = 2; // 2-minute buckets
const BREAK = 856; // 14:16 — the cache pool rolled
const COVERAGE_END = 844; // 14:04 — last bucket where every stage reported

const TIMES: readonly number[] = Array.from(
  { length: (T1 - T0) / STEP + 1 },
  (_, index) => T0 + index * STEP,
);

interface Reading {
  readonly label: string;
  readonly value: string;
  readonly role?: "healthy" | "uncertain" | "anomaly" | "inert";
}

interface StageSpec {
  readonly key: string;
  readonly name: string;
  readonly id: string;
  /** p95 budget for this stage, in ms. */
  readonly slo: number;
  readonly base: number;
  readonly jitter: number;
  readonly seed: number;
  /** Minute at which this stage's regime changes, or null if it never does. */
  readonly onset: number | null;
  readonly peak: number;
  /** Per-bucket decline once recovery starts. */
  readonly easeFrom: number | null;
  readonly ease: number;
  /** Last minute this stage reported, or null if it reports throughout. */
  readonly lastReport: number | null;
  readonly shape: string;
  readonly readings: readonly Reading[];
  readonly action: string;
  readonly cta: string | null;
  readonly runbook: string | null;
}

const SPECS: readonly StageSpec[] = [
  {
    key: "ingest",
    name: "Request gateway",
    id: "ingest.http",
    slo: 25,
    base: 13,
    jitter: 1.8,
    seed: 11,
    onset: null,
    peak: 0,
    easeFrom: null,
    ease: 0,
    lastReport: null,
    shape:
      "Flat across the whole window. Nothing upstream of the break has moved, so this is the control line.",
    readings: [
      { label: "accepted", value: "1 186 /s" },
      { label: "rejected 429", value: "0.00%" },
      { label: "connection reuse", value: "98.1%" },
    ],
    action: "No action. Keep it as the control line for the comparison.",
    cta: null,
    runbook: null,
  },
  {
    key: "tokenize",
    name: "Tokenize & batch",
    id: "tok.batch",
    slo: 40,
    base: 24,
    jitter: 2.4,
    seed: 23,
    onset: 858,
    peak: 31,
    easeFrom: null,
    ease: 0,
    lastReport: null,
    shape:
      "Up about 7 ms after the break but still inside its 40 ms budget. A consequence of retries, not a cause.",
    readings: [
      { label: "retry share", value: "0.4% → 2.1%", role: "uncertain" },
      { label: "tokens / request", value: "412 → 409", role: "inert" },
      { label: "batch fill", value: "96% → 94%", role: "inert" },
    ],
    action: "No action yet. Re-check if retry share passes 5%.",
    cta: null,
    runbook: null,
  },
  {
    key: "embed",
    name: "Embedding lookup",
    id: "embed.cache",
    slo: 60,
    base: 21,
    jitter: 2.2,
    seed: 37,
    onset: BREAK,
    peak: 262,
    easeFrom: 864,
    ease: 5,
    lastReport: null,
    shape:
      "Crossed its 60 ms budget at 14:16 and has held about four times above it since. Easing slowly after 14:24.",
    readings: [
      { label: "cache hit", value: "94.2% → 61.3%", role: "anomaly" },
      { label: "warm replicas", value: "8 → 6", role: "anomaly" },
      { label: "evictions / min", value: "40 → 2 180", role: "anomaly" },
      { label: "origin fetch p95", value: "18 → 268 ms", role: "anomaly" },
    ],
    action:
      "Restore the two evicted replicas, then confirm hit rate passes 90% before judging inference.",
    cta: "Scale cache pool to 8",
    runbook: "RB-114",
  },
  {
    key: "infer",
    name: "Model inference",
    id: "infer.gpu",
    slo: 900,
    base: 672,
    jitter: 18,
    seed: 53,
    onset: 858,
    peak: 1140,
    easeFrom: null,
    ease: 0,
    lastReport: null,
    shape:
      "Turned four minutes later, at 14:20. Batches are starved rather than slow: per-request cost rose while GPU use fell.",
    readings: [
      { label: "batch size", value: "24 → 7", role: "anomaly" },
      { label: "queue depth", value: "3 → 41", role: "anomaly" },
      { label: "GPU utilisation", value: "71% → 38%", role: "anomaly" },
      { label: "OOM retries", value: "0 → 0", role: "inert" },
    ],
    action: "Hold GPU scaling. This sits downstream of the cache and should recover with it.",
    cta: null,
    runbook: null,
  },
  {
    key: "rerank",
    name: "Rerank & format",
    id: "post.rerank",
    slo: 120,
    base: 78,
    jitter: 4.5,
    seed: 71,
    onset: null,
    peak: 0,
    easeFrom: null,
    ease: 0,
    lastReport: COVERAGE_END,
    shape:
      "Unmeasured since 14:04, twelve minutes before the break. This stage can be neither ruled in nor ruled out.",
    readings: [
      { label: "last report", value: "14:04", role: "uncertain" },
      { label: "p95 now", value: "unknown", role: "uncertain" },
      { label: "exporter restarts", value: "3", role: "uncertain" },
      { label: "tail samples", value: "0 of 13" },
    ],
    action:
      "Restart the metrics sidecar. Until it reports, the path total stays a lower bound.",
    cta: "Restart exporter sidecar",
    runbook: "RB-032",
  },
  {
    key: "egress",
    name: "Response egress",
    id: "egress.tls",
    slo: 30,
    base: 11,
    jitter: 1.4,
    seed: 89,
    onset: null,
    peak: 0,
    easeFrom: null,
    ease: 0,
    lastReport: null,
    shape: "Flat. Adds about 11 ms and has not moved all window.",
    readings: [
      { label: "bytes out", value: "41.2 MB/s" },
      { label: "TLS resumption", value: "96.4%" },
      { label: "5xx", value: "0.00%" },
    ],
    action: "No action.",
    cta: null,
    runbook: null,
  },
];

interface Sample {
  readonly t: number;
  readonly v: number | null;
}

type Role = "healthy" | "uncertain" | "anomaly";

interface Row {
  readonly spec: StageSpec;
  readonly series: readonly Sample[];
  readonly role: Role;
  readonly yMax: number;
  /** Mean p95 across the fully covered window, in ms. */
  readonly baseline: number;
  /** First minute from which the trace stays above its budget, or null. */
  readonly turned: number | null;
  at(minute: number): Sample | null;
}

/** mulberry32 — a small deterministic generator so the window is reproducible. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeries(spec: StageSpec): readonly Sample[] {
  const next = rng(spec.seed);
  return TIMES.map((t) => {
    if (spec.lastReport !== null && t > spec.lastReport) return { t, v: null };
    let level = spec.base;
    if (spec.onset !== null && t >= spec.onset) {
      const ramp = Math.min(1, (t - spec.onset) / 4 + 0.45);
      level = spec.base + (spec.peak - spec.base) * ramp;
      if (spec.easeFrom !== null && t >= spec.easeFrom) {
        level -= spec.ease * ((t - spec.easeFrom) / STEP);
      }
    }
    const noise = (next() - 0.5) * 2 * spec.jitter;
    const wave = Math.sin((t - T0) / 11) * spec.jitter * 0.5;
    return { t, v: Math.max(0.5, Math.round((level + noise + wave) * 10) / 10) };
  });
}

function buildRow(spec: StageSpec): Row {
  const series = buildSeries(spec);
  const measured = series.filter((sample): sample is { t: number; v: number } => sample.v !== null);
  const covered = measured.filter((sample) => sample.t <= COVERAGE_END);
  const baseline = covered.reduce((sum, sample) => sum + sample.v, 0) / Math.max(1, covered.length);
  const peak = measured.reduce((max, sample) => Math.max(max, sample.v), 0);
  const unmeasured = spec.lastReport !== null && spec.lastReport < T1;
  const last = measured[measured.length - 1];

  let turned: number | null = null;
  for (let index = measured.length - 1; index >= 0; index -= 1) {
    if (measured[index].v > spec.slo) turned = measured[index].t;
    else break;
  }

  const role: Role = unmeasured ? "uncertain" : last.v > spec.slo ? "anomaly" : "healthy";
  const byMinute = new Map(series.map((sample) => [sample.t, sample]));

  return {
    spec,
    series,
    role,
    yMax: Math.max(spec.slo * 1.35, peak * 1.18),
    baseline,
    turned: unmeasured ? null : turned,
    at(minute) {
      const sample = byMinute.get(minute);
      return sample && sample.v !== null ? sample : null;
    },
  };
}

const ROWS: readonly Row[] = SPECS.map(buildRow);

/** Stages that report for the whole window; their sum is comparable end to end. */
const MEASURED_ROWS = ROWS.filter((row) => row.spec.lastReport === null);
const GAP_ROW = ROWS.find((row) => row.spec.lastReport !== null);

function measuredTotal(minute: number): number {
  return MEASURED_ROWS.reduce((sum, row) => sum + (row.at(minute)?.v ?? 0), 0);
}

const TOTAL_SERIES = TIMES.map((t) => ({ t, v: measuredTotal(t) }));
const TOTAL_NOW = measuredTotal(T1);
const TOTAL_BASELINE =
  TOTAL_SERIES.filter((point) => point.t <= COVERAGE_END).reduce((sum, point) => sum + point.v, 0) /
  TOTAL_SERIES.filter((point) => point.t <= COVERAGE_END).length;

/* ------------------------------------------------------------------ format */

function clock(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = Math.round(minute % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Groups thousands with a narrow no-break space so digit columns stay aligned. */
function group(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function msLabel(value: number): string {
  return `${group(Math.round(value))} ms`;
}

function signedMs(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded === 0) return "±0";
  return `${rounded > 0 ? "+" : "−"}${group(Math.abs(rounded))}`;
}

/* ------------------------------------------------------------------ paths */

function dashedPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash = 5,
  gap = 4,
): Path2D {
  const path = new Path2D();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return path;
  const ux = dx / length;
  const uy = dy / length;
  for (let offset = 0; offset < length; offset += dash + gap) {
    const end = Math.min(offset + dash, length);
    path.moveTo(x1 + ux * offset, y1 + uy * offset);
    path.lineTo(x1 + ux * end, y1 + uy * end);
  }
  return path;
}

/** Diagonal hatch, used only inside a Clip that bounds it. */
function hatchPath(x: number, y: number, width: number, height: number, step = 7): Path2D {
  const path = new Path2D();
  for (let offset = -height; offset < width + height; offset += step) {
    path.moveTo(x + offset, y + height);
    path.lineTo(x + offset + height, y);
  }
  return path;
}

function rectanglePath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}


function polylinePath(points: readonly (readonly [number, number])[]): Path2D {
  const path = new Path2D();
  points.forEach(([x, y], index) => {
    if (index === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  });
  return path;
}

/* ------------------------------------------------------------------ texture */

interface GradientConfig {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly stops: Stops;
}

const linearGradient = defineTexture<GradientConfig, { config: GradientConfig }>({
  defaultPlacement: { mode: "stretch" },
  create: (_context, config) => ({ config }),
  update: (state, config, context) => {
    state.config = config;
    context.invalidate();
  },
  rasterize: ({ config }, { canvas }) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(
      config.from[0] * width,
      config.from[1] * height,
      config.to[0] * width,
      config.to[1] * height,
    );
    for (const [offset, color] of config.stops) gradient.addColorStop(offset, color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  },
});

/* ------------------------------------------------------------------ pieces */

interface SceneState {
  readonly theme: Theme;
  readonly glass: boolean;
  readonly still: boolean;
}

function elevation(level: Elevation, glass: boolean) {
  return glass
    ? [dropShadow({ offsetX: 0, offsetY: level.offsetY, blurRadius: level.blurRadius, color: level.color })]
    : [];
}

/** Absolute x for a minute inside the trellis plot column. */
function plotX(minute: number): number {
  return PLOT_X + ((minute - T0) / (T1 - T0)) * PLOT_W;
}

function rowTop(index: number): number {
  return ROWS_TOP + index * ROW_H;
}

function rowPlotTop(index: number): number {
  return rowTop(index) + PLOT_DY;
}

/** The header pane: the only glass surface, and it reveals the path total. */
function PathTotalPane({ state }: { readonly state: SceneState }) {
  const { theme, glass } = state;
  const panePath = useRectPath(PANE.left, PANE.top, PANE.width, PANE.height, {
    cornerRadius: PANE_R,
  });
  const specular = useTexture(
    linearGradient({ from: [0, 0], to: [1, 1], stops: theme.specular }),
    { resolution: { width: 64, height: 64 } },
  );
  const rim = useTexture(linearGradient({ from: [0, 0], to: [1, 1], stops: theme.rim }), {
    resolution: { width: 64, height: 64 },
  });

  const bandX = (minute: number) =>
    BAND.left + ((minute - T0) / (T1 - T0)) * BAND.width;
  const bandY = (value: number) =>
    BAND.top + BAND.height - (Math.min(value, BAND_MAX) / BAND_MAX) * BAND.height;

  const topEdge = TOTAL_SERIES.map(
    (point) => [bandX(point.t), bandY(point.v)] as const,
  );
  const bottom = BAND.top + BAND.height;

  const areaPath = new Path2D();
  areaPath.moveTo(bandX(T0), bottom);
  for (const [x, y] of topEdge) areaPath.lineTo(x, y);
  areaPath.lineTo(bandX(T1), bottom);
  areaPath.closePath();

  // The measured contribution of the stage that later stops reporting.
  const sliverPath = new Path2D();
  const covered = TOTAL_SERIES.filter((point) => point.t <= COVERAGE_END);
  sliverPath.moveTo(bandX(covered[0].t), bandY(covered[0].v));
  for (const point of covered) {
    sliverPath.lineTo(bandX(point.t), bandY(point.v + (GAP_ROW?.at(point.t)?.v ?? 0)));
  }
  for (let index = covered.length - 1; index >= 0; index -= 1) {
    sliverPath.lineTo(bandX(covered[index].t), bandY(covered[index].v));
  }
  sliverPath.closePath();

  // Unknown has no upper bound, so the zone opens to the top of the band.
  const openPoints = TOTAL_SERIES.filter((point) => point.t >= COVERAGE_END);
  const openPath = new Path2D();
  openPath.moveTo(bandX(openPoints[0].t), bandY(openPoints[0].v));
  for (const point of openPoints) openPath.lineTo(bandX(point.t), bandY(point.v));
  openPath.lineTo(bandX(T1), BAND.top);
  openPath.lineTo(bandX(COVERAGE_END), BAND.top);
  openPath.closePath();

  const backdrop: CRCNode = (
    <Group>
      <Path pointerEvents="none" style={{ d: areaPath, fill: `${theme.observation.trace}3D` }} />
      <Path pointerEvents="none" style={{ d: sliverPath, fill: `${theme.uncertain.trace}59` }} />
    </Group>
  );

  return (
    <Group style={{ filter: elevation(theme.raised, glass) }}>
      <Clip style={{ d: panePath }}>
        {/* Opaque reset plate: CRC paints in source order, so the pane must not
            composite a blurred copy over a sharp original. */}
        <Rectangle pointerEvents="none" style={{ left: PANE.left, top: PANE.top, width: PANE.width, height: PANE.height, fill: theme.canvasMuted }} />
        {glass ? (
          <Group style={{ filter: [blur({ radius: 5 }), saturate({ amount: theme.mode === "light" ? 1.35 : 1.25 })] }}>
            <Layer style={{ width: W, height: 140 }}>{backdrop}</Layer>
          </Group>
        ) : (
          backdrop
        )}
        <Rectangle
          pointerEvents="none"
          style={{ left: PANE.left, top: PANE.top, width: PANE.width, height: PANE.height, fill: glass ? theme.paneTint : theme.paneSolid }}
        />
        {glass && (
          <Rectangle
            pointerEvents="none"
            style={{ left: PANE.left, top: PANE.top, width: PANE.width, height: PANE.height, fill: specular.paint({ mode: "stretch" }) }}
          />
        )}

        {/* The instrument's own marks stay crisp on the glass. */}
        <Path
          pointerEvents="none"
          style={{
            d: dashedPath(bandX(T0), bandY(PATH_SLO), bandX(T1), bandY(PATH_SLO), 4, 4),
            stroke: theme.inert.trace,
            strokeWidth: 1,
          }}
        />
        <Path pointerEvents="none" style={{ d: openPath, fill: theme.uncertain.bg }} />
        <Clip style={{ d: openPath }}>
          <Path
            pointerEvents="none"
            style={{
              d: hatchPath(bandX(COVERAGE_END), BAND.top, BAND.width, BAND.height),
              stroke: theme.uncertain.trace,
              strokeWidth: 1,
              opacity: 0.4,
            }}
          />
        </Clip>
        <Path
          pointerEvents="none"
          style={{
            d: dashedPath(bandX(COVERAGE_END), BAND.top + 0.5, bandX(T1), BAND.top + 0.5, 4, 3),
            stroke: theme.uncertain.trace,
            strokeWidth: 1,
          }}
        />
        <Path
          pointerEvents="none"
          style={{
            d: dashedPath(bandX(BREAK), BAND.top, bandX(BREAK), bottom, 3, 3),
            stroke: theme.observation.trace,
            strokeWidth: 1,
          }}
        />
        <Path
          pointerEvents="none"
          style={{ d: polylinePath(topEdge), stroke: theme.observation.trace, strokeWidth: 1.4 }}
        />

        <Text
          pointerEvents="none"
          style={{ left: BAND.left, top: 24, font: FONT.eyebrow, fill: theme.fgFaint }}
        >
          {`PATH TOTAL p95 · SLO ${group(PATH_SLO)} ms`}
        </Text>
        <Text
          pointerEvents="none"
          style={{ left: BAND.left, top: 34, font: FONT.value, fill: theme.anomaly.text }}
        >
          {`≥ ${msLabel(TOTAL_NOW)}`}
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: BAND.left + BAND.width,
            top: 26,
            textAlign: "right",
            font: FONT.eyebrow,
            fill: theme.uncertain.text,
          }}
        >
          {"1 stage unmeasured"}
        </Text>
        <Text
          pointerEvents="none"
          style={{
            left: BAND.left + BAND.width,
            top: 42,
            textAlign: "right",
            font: FONT.eyebrow,
            fill: theme.fgMuted,
          }}
        >
          {`baseline ${msLabel(TOTAL_BASELINE)}`}
        </Text>
      </Clip>
      <Rectangle
        pointerEvents="none"
        style={{
          left: PANE.left, top: PANE.top, width: PANE.width, height: PANE.height,
          cornerRadius: PANE_R,
          stroke: glass ? rim.paint({ mode: "stretch" }) : theme.border,
          strokeWidth: 1,
        }}
      />
    </Group>
  );
}

/** One stage's trace, inside its own shared-time / own-budget frame. */
function RowPlot({
  row,
  state,
  minute,
}: {
  readonly row: Row;
  readonly state: SceneState;
  readonly minute: number;
}) {
  const { theme } = state;
  const xs = useScale("t").get();
  const ys = useScale("v").get();
  const tone = theme[row.role];
  const sloY = ys.map(row.spec.slo);
  const sample = row.at(minute);
  const gapFrom = row.spec.lastReport;

  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: PLOT_W, height: PLOT_H, cornerRadius: 4, fill: theme.sunken }}
      />
      {gapFrom !== null && (
        <Group>
          <Clip style={{ d: rectanglePath(xs.map(gapFrom), 0, PLOT_W - xs.map(gapFrom), PLOT_H) }}>
            <Rectangle
              pointerEvents="none"
              style={{ width: PLOT_W, height: PLOT_H, fill: theme.uncertain.bg }}
            />
            <Path
              pointerEvents="none"
              style={{
                d: hatchPath(0, 0, PLOT_W, PLOT_H),
                stroke: theme.uncertain.trace,
                strokeWidth: 1,
                opacity: 0.28,
              }}
            />
          </Clip>
          <Path
            pointerEvents="none"
            style={{
              d: dashedPath(xs.map(gapFrom), 0, xs.map(gapFrom), PLOT_H, 3, 3),
              stroke: theme.uncertain.trace,
              strokeWidth: 1,
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: (xs.map(gapFrom) + PLOT_W) / 2,
              top: PLOT_H / 2 - 5,
              textAlign: "center",
              font: FONT.eyebrow,
              fill: theme.uncertain.text,
            }}
          >
            {"no samples"}
          </Text>
        </Group>
      )}
      <Path
        pointerEvents="none"
        style={{
          d: dashedPath(0, sloY, PLOT_W, sloY, 5, 4),
          stroke: theme.inert.trace,
          strokeWidth: 1,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: SLO_LABEL_X - PLOT_X,
          top: sloY - 5,
          textAlign: "right",
          font: FONT.eyebrow,
          fill: theme.inert.text,
        }}
      >
        {group(row.spec.slo)}
      </Text>
      <LineSeries
        data={row.series}
        x="t"
        y="v"
        xScale="t"
        yScale="v"
        pointerEvents="none"
        defined={(sampled: Sample) => sampled.v !== null}
        style={{ stroke: tone.trace, strokeWidth: 1.6 }}
      />
      {sample !== null && sample.v !== null && (
        <Circle
          pointerEvents="none"
          style={{
            cx: xs.map(sample.t),
            cy: ys.map(sample.v),
            radius: 3,
            fill: tone.trace,
            stroke: theme.surface,
            strokeWidth: 1.5,
          }}
        />
      )}
    </Group>
  );
}

/** The stage identity block plus the row's single interaction target. */
function RowLabel({
  row,
  index,
  state,
  minute,
  selected,
  hovered,
  cursor,
}: {
  readonly row: Row;
  readonly index: number;
  readonly state: SceneState;
  readonly minute: number;
  readonly selected: WritableSignal<number>;
  readonly hovered: WritableSignal<number | null>;
  readonly cursor: WritableSignal<number | null>;
}) {
  const { theme } = state;
  const top = rowTop(index);
  const path = useRectPath(LENS_LEFT, top + ROW_INSET, LENS_W, ROW_BAND_H, { cornerRadius: 8 });
  const tone = theme[row.role];
  const sample = row.at(minute);

  const scrub = (event: CRCPointerEvent) => {
    if (event.x < PLOT_X || event.x > PLOT_X + PLOT_W) return;
    const raw = T0 + ((event.x - PLOT_X) / PLOT_W) * (T1 - T0);
    const snapped = Math.min(T1, Math.max(T0, T0 + Math.round((raw - T0) / STEP) * STEP));
    if (snapped !== cursor.get()) cursor.set(snapped);
  };

  const snapshot = useEventTarget(
    {
      onClick: () => selected.set(index),
      onKeyDown: (event: CRCKeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selected.set(index);
      },
      onPointerEnter: () => hovered.set(index),
      onPointerMove: scrub,
      onPointerLeave: (event: CRCPointerEvent) => {
        if (hovered.get() === index) hovered.set(null);
        const outside =
          event.x < TRELLIS.left ||
          event.x > TRELLIS.left + TRELLIS.width ||
          event.y < ROWS_TOP ||
          event.y > ROWS_BOTTOM;
        if (outside) cursor.set(null);
      },
    },
    { path, fill: true, cursor: "pointer" },
  );

  const delta = sample !== null && sample.v !== null ? sample.v - row.baseline : null;
  // The role bar keeps the stage's current state; the reading is judged at the
  // inspected moment, so scrubbing back shows a breach that had not happened yet.
  const valueTone =
    sample === null || sample.v === null
      ? theme.uncertain
      : sample.v > row.spec.slo
        ? theme.anomaly
        : theme.healthy;

  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ left: LENS_LEFT + 4, top: top + 12, width: 3, height: 36, cornerRadius: 2, fill: tone.trace }}
      />
      <Text
        pointerEvents="none"
        style={{ left: LENS_LEFT + 14, top: top + 8, font: FONT.rowName, fill: theme.fg }}
      >
        {row.spec.name}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: LENS_LEFT + 14, top: top + 24, font: FONT.eyebrow, fill: theme.fgFaint }}
      >
        {row.spec.id}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: LENS_LEFT + 14, top: top + 38, font: FONT.rowValue, fill: valueTone.text }}
      >
        {sample !== null && sample.v !== null ? msLabel(sample.v) : "unknown"}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: LENS_LEFT + 150,
          top: top + 40,
          textAlign: "right",
          font: FONT.eyebrow,
          fill: delta === null ? theme.uncertain.text : theme.fgMuted,
        }}
      >
        {delta === null ? "no data" : signedMs(delta)}
      </Text>
      {snapshot.isFocusVisible && (
        <Rectangle
          pointerEvents="none"
          style={{
            left: LENS_LEFT - 2,
            top,
            width: LENS_W + 4,
            height: ROW_BAND_H + 4,
            cornerRadius: 10,
            stroke: theme.focusRing,
            strokeWidth: 2,
          }}
        />
      )}
    </Group>
  );
}

function Trellis({
  state,
  selected,
  hovered,
  cursor,
}: {
  readonly state: SceneState;
  readonly selected: WritableSignal<number>;
  readonly hovered: WritableSignal<number | null>;
  readonly cursor: WritableSignal<number | null>;
}) {
  const { theme, glass, still } = state;
  const panelPath = useRectPath(TRELLIS.left, TRELLIS.top, TRELLIS.width, TRELLIS.height, {
    cornerRadius: PANEL_R,
  });
  const specular = useTexture(
    linearGradient({ from: [0, 0], to: [1, 1], stops: theme.specular }),
    { resolution: { width: 64, height: 64 } },
  );
  const rim = useTexture(linearGradient({ from: [0, 0], to: [1, 1], stops: theme.rim }), {
    resolution: { width: 64, height: 64 },
  });

  const selectedIndex = selected.get();
  const hoveredIndex = hovered.get();
  const inspected = cursor.get();
  const minute = inspected ?? T1;
  // Selection can be interrupted mid-slide, so the lens resolves from its
  // current velocity instead of restarting a fixed curve.
  const lensTop = useTransition(rowTop(selectedIndex) + ROW_INSET, {
    type: "spring",
    stiffness: still ? 2000 : 210,
    damping: still ? 90 : 26,
    mass: 1,
  });
  const breakX = plotX(BREAK);
  const cursorX = plotX(minute);

  return (
    <Group>
      <Group style={{ filter: elevation(theme.floating, glass) }}>
        <Rectangle
          pointerEvents="none"
          style={{ left: TRELLIS.left, top: TRELLIS.top, width: TRELLIS.width, height: TRELLIS.height, cornerRadius: PANEL_R, fill: theme.surface }}
        />
      </Group>
      <Clip style={{ d: panelPath }}>
        {glass && (
          <Rectangle
            pointerEvents="none"
            style={{
              left: TRELLIS.left,
              top: TRELLIS.top,
              width: TRELLIS.width * 0.7,
              height: TRELLIS.height * 0.5,
              fill: specular.paint({ mode: "stretch" }),
            }}
          />
        )}
      </Clip>
      <Rectangle
        pointerEvents="none"
        style={{
          left: TRELLIS.left, top: TRELLIS.top, width: TRELLIS.width, height: TRELLIS.height,
          cornerRadius: PANEL_R,
          stroke: glass ? rim.paint({ mode: "stretch" }) : theme.border,
          strokeWidth: 1,
        }}
      />

      <Text
        pointerEvents="none"
        style={{ left: 40, top: 112, font: FONT.eyebrow, fill: theme.fgFaint }}
      >
        {`STAGE · p95 AT ${clock(minute)}${inspected === null ? " (NOW)" : ""}`}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: SLO_LABEL_X, top: 112, textAlign: "right", font: FONT.eyebrow, fill: theme.fgFaint }}
      >
        {"SLO"}
      </Text>
      <Path
        pointerEvents="none"
        style={{
          d: polylinePath([
            [40, 128.5],
            [SLO_LABEL_X, 128.5],
          ]),
          stroke: theme.border,
          strokeWidth: 1,
        }}
      />

      {/* One sliding lens marks the inspected row. Selection is observation. */}
      <Rectangle
        pointerEvents="none"
        style={{
          left: LENS_LEFT,
          top: lensTop,
          width: LENS_W,
          height: ROW_BAND_H,
          cornerRadius: 8,
          fill: theme.selection,
          stroke: theme.observation.edge,
          strokeWidth: 1,
        }}
      />
      {hoveredIndex !== null && hoveredIndex !== selectedIndex && (
        <Rectangle
          pointerEvents="none"
          style={{
            left: LENS_LEFT,
            top: rowTop(hoveredIndex) + ROW_INSET,
            width: LENS_W,
            height: ROW_BAND_H,
            cornerRadius: 8,
            fill: theme.wash,
          }}
        />
      )}

      <Absolute>
        {ROWS.map((row, index) => (
          <Scale
            key={row.spec.key}
            id="t"
            type="linear"
            domain={[T0, T1]}
            range="width"
            style={{ left: PLOT_X, top: rowPlotTop(index), width: PLOT_W, height: PLOT_H }}
          >
            <Scale id="v" type="linear" domain={[0, row.yMax]} range="height" reverse>
              <RowPlot row={row} state={state} minute={minute} />
            </Scale>
          </Scale>
        ))}
        <Scale
          key="axis"
          id="t"
          type="linear"
          domain={[T0, T1]}
          range="width"
          style={{ left: PLOT_X, top: AXIS_Y - 1, width: PLOT_W, height: 1 }}
        >
          <Axis
            scale="t"
            position="bottom"
            tickValues={[780, 800, 820, 840, 860]}
            tickFormat={(value) => clock(Number(value))}
            style={{ font: FONT.eyebrow, fill: theme.fgFaint, stroke: theme.border }}
          />
        </Scale>
      </Absolute>

      {/* The break crosses every row, so the order of onset is readable. */}
      <Path
        pointerEvents="none"
        style={{
          d: dashedPath(breakX, ROWS_TOP - 8, breakX, ROWS_BOTTOM - 4, 4, 4),
          stroke: theme.observation.trace,
          strokeWidth: 1.25,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: breakX - 6,
          top: 120,
          textAlign: "right",
          font: FONT.eyebrow,
          fill: theme.observation.text,
        }}
      >
        {"14:16 cache pool rolled"}
      </Text>
      {inspected !== null && (
        <Path
          pointerEvents="none"
          style={{
            d: polylinePath([
              [cursorX, ROWS_TOP],
              [cursorX, ROWS_BOTTOM - 4],
            ]),
            stroke: theme.observation.trace,
            strokeWidth: 1,
          }}
        />
      )}

      {ROWS.map((row, index) => (
        <RowLabel
          key={row.spec.key}
          row={row}
          index={index}
          state={state}
          minute={minute}
          selected={selected}
          hovered={hovered}
          cursor={cursor}
        />
      ))}

      <Text
        pointerEvents="none"
        style={{ left: 40, top: 526, font: FONT.eyebrow, fill: theme.fgSubtle }}
      >
        {`onset · embed.cache ${clock(ROWS[2].turned ?? BREAK)} → infer.gpu ${clock(
          ROWS[3].turned ?? BREAK,
        )} · post.rerank unmeasured ${clock(COVERAGE_END)}→`}
      </Text>
    </Group>
  );
}

const BADGE: Record<Role, { readonly label: string; readonly width: number }> = {
  healthy: { label: "IN BUDGET", width: 78 },
  anomaly: { label: "OVER SLO", width: 72 },
  uncertain: { label: "NO DATA", width: 66 },
};

function Detail({
  state,
  selected,
  requested,
}: {
  readonly state: SceneState;
  readonly selected: WritableSignal<number>;
  readonly requested: WritableSignal<readonly string[]>;
}) {
  const { theme, glass } = state;
  const row = ROWS[selected.get()];
  const spec = row.spec;
  const tone = theme[row.role];
  const badge = BADGE[row.role];
  const ctaPath = useRectPath(608, 486, 224, 34, { cornerRadius: 6 });
  // Path2D is a browser constructor, so it is built at mount rather than module scope.
  const emptyPath = useConst(() => new Path2D());
  const done = requested.get().includes(spec.key);
  const hover = useSignal(false);

  const actionable = spec.cta !== null && !done;
  const request = () => requested.update((current) => [...current, spec.key]);
  const ctaSnapshot = useEventTarget(
    actionable
      ? {
          onClick: request,
          onPointerEnter: () => hover.set(true),
          onPointerLeave: () => hover.set(false),
          onKeyDown: (event: CRCKeyboardEvent) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            request();
          },
        }
      : {},
    actionable
      ? { path: ctaPath, fill: true, cursor: "pointer" }
      : { path: emptyPath, fill: true },
  );

  return (
    <Group>
      <Group style={{ filter: elevation(theme.raised, glass) }}>
        <Rectangle
          pointerEvents="none"
          style={{
            left: DETAIL.left, top: DETAIL.top, width: DETAIL.width, height: DETAIL.height,
            cornerRadius: PANEL_R,
            fill: theme.surface,
            stroke: theme.border,
            strokeWidth: 1,
          }}
        />
      </Group>

      <Text pointerEvents="none" style={{ left: 600, top: 112, font: FONT.eyebrow, fill: theme.fgFaint }}>
        {"SELECTED STAGE"}
      </Text>
      <Rectangle
        pointerEvents="none"
        style={{
          left: 840 - badge.width,
          top: 108,
          width: badge.width,
          height: 20,
          cornerRadius: 6,
          fill: tone.bg,
          stroke: tone.edge,
          strokeWidth: 1,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 840 - badge.width / 2,
          top: 113,
          textAlign: "center",
          font: FONT.eyebrow,
          fill: tone.text,
        }}
      >
        {badge.label}
      </Text>
      <Text pointerEvents="none" style={{ left: 600, top: 128, font: FONT.h4, fill: theme.fg }}>
        {spec.name}
      </Text>
      <Text pointerEvents="none" style={{ left: 600, top: 156, font: FONT.monoSm, fill: theme.fgSubtle }}>
        {spec.id}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: 600,
          top: 178,
          width: 240,
          height: 84,
          wrap: true,
          fit: "ellipsis",
          lineHeight: 21,
          font: FONT.body,
          fill: theme.fgMuted,
        }}
      >
        {spec.shape}
      </Text>

      <Path
        pointerEvents="none"
        style={{
          d: polylinePath([
            [600, 272.5],
            [840, 272.5],
          ]),
          stroke: theme.borderSubtle,
          strokeWidth: 1,
        }}
      />
      <Text pointerEvents="none" style={{ left: 600, top: 284, font: FONT.eyebrow, fill: theme.fgFaint }}>
        {"CAUSAL READINGS"}
      </Text>
      {spec.readings.slice(0, 4).map((reading, index) => (
        <Group key={reading.label}>
          <Text
            pointerEvents="none"
            style={{ left: 600, top: 302 + index * 22, font: FONT.caption, fill: theme.fgMuted }}
          >
            {reading.label}
          </Text>
          <Text
            pointerEvents="none"
            style={{
              left: 840,
              top: 302 + index * 22,
              textAlign: "right",
              font: FONT.mono,
              fill: reading.role ? theme[reading.role].text : theme.fg,
            }}
          >
            {reading.value}
          </Text>
        </Group>
      ))}

      {/* A quiet inset well, not a second card. */}
      <Rectangle
        pointerEvents="none"
        style={{ left: 592, top: 392, width: 256, height: 136, cornerRadius: 12, fill: theme.sunken }}
      />
      <Path
        pointerEvents="none"
        style={{
          d: polylinePath([
            [604, 392.5],
            [836, 392.5],
          ]),
          stroke: theme.border,
          strokeWidth: 1,
        }}
      />
      <Text pointerEvents="none" style={{ left: 608, top: 406, font: FONT.eyebrow, fill: theme.fgFaint }}>
        {"NEXT STEP"}
      </Text>
      {spec.runbook && (
        <Text
          pointerEvents="none"
          style={{ left: 832, top: 406, textAlign: "right", font: FONT.eyebrow, fill: theme.fgFaint }}
        >
          {spec.runbook}
        </Text>
      )}
      <Text
        pointerEvents="none"
        style={{
          left: 608,
          top: 424,
          width: 224,
          height: 58,
          wrap: true,
          fit: "ellipsis",
          lineHeight: 19,
          font: FONT.action,
          fill: theme.fg,
        }}
      >
        {spec.action}
      </Text>
      {spec.cta ? (
        <Group>
          <Rectangle
            pointerEvents="none"
            style={{
              left: 608,
              top: 486,
              width: 224,
              height: 34,
              cornerRadius: 6,
              fill: done ? theme.inert.bg : theme.accent,
              stroke: done ? theme.border : undefined,
              strokeWidth: done ? 1 : 0,
              opacity: !done && hover.get() ? 0.88 : 1,
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 720,
              top: 496,
              textAlign: "center",
              font: FONT.label,
              fill: done ? theme.fgMuted : theme.accentFg,
            }}
          >
            {done ? `Requested · ${clock(T1)}` : spec.cta}
          </Text>
          {ctaSnapshot.isFocusVisible && !done && (
            <Rectangle
              pointerEvents="none"
              style={{
                left: 605,
                top: 483,
                width: 230,
                height: 40,
                cornerRadius: 8,
                stroke: theme.focusRing,
                strokeWidth: 2,
              }}
            />
          )}
        </Group>
      ) : (
        <Text pointerEvents="none" style={{ left: 608, top: 494, font: FONT.monoSm, fill: theme.fgSubtle }}>
          {"no action · watching"}
        </Text>
      )}
    </Group>
  );
}

function Toggle({
  state,
  left,
  label,
  onToggle,
}: {
  readonly state: SceneState;
  readonly left: number;
  readonly label: string;
  readonly onToggle: () => void;
}) {
  const { theme } = state;
  const path = useRectPath(left, 554, 84, 30, { cornerRadius: 6 });
  const hover = useSignal(false);
  const snapshot = useEventTarget(
    {
      onClick: onToggle,
      onPointerEnter: () => hover.set(true),
      onPointerLeave: () => hover.set(false),
      onKeyDown: (event: CRCKeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onToggle();
      },
    },
    { path, fill: true, cursor: "pointer" },
  );
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{
          left,
          top: 554,
          width: 84,
          height: 30,
          cornerRadius: 6,
          fill: hover.get() ? theme.controlHover : theme.controlFill,
          stroke: snapshot.isFocusVisible ? theme.focusRing : theme.border,
          strokeWidth: snapshot.isFocusVisible ? 2 : 1,
        }}
      />
      <Text
        pointerEvents="none"
        style={{ left: left + 42, top: 564, textAlign: "center", font: FONT.eyebrow, fill: theme.fg }}
      >
        {label}
      </Text>
    </Group>
  );
}

function Legend({ state }: { readonly state: SceneState }) {
  const { theme } = state;
  // Trace swatches are solid like the traces; the annotation swatch is a dashed
  // rule like the annotation, so hue alone never has to carry the distinction.
  const items: readonly (readonly [string, string, number, "trace" | "rule"])[] = [
    ["Inside budget", theme.healthy.trace, 24, "trace"],
    ["Over SLO", theme.anomaly.trace, 142, "trace"],
    ["Unmeasured", theme.uncertain.trace, 238, "trace"],
    ["Break 14:16", theme.observation.trace, 348, "rule"],
  ];
  return (
    <Group>
      {items.map(([label, color, left, kind]) => (
        <Group key={label}>
          {kind === "trace" ? (
            <Rectangle
              pointerEvents="none"
              style={{ left, top: 558, width: 8, height: 8, cornerRadius: 2, fill: color }}
            />
          ) : (
            <Path
              pointerEvents="none"
              style={{
                d: dashedPath(left + 4, 554, left + 4, 568, 4, 4),
                stroke: color,
                strokeWidth: 1.5,
              }}
            />
          )}
          <Text
            pointerEvents="none"
            style={{ left: left + 14, top: 555, font: FONT.legend, fill: theme.fgMuted }}
          >
            {label}
          </Text>
        </Group>
      ))}
    </Group>
  );
}

/* ------------------------------------------------------------------ scene */

function PipelineHealth() {
  const dark = useSignal(false);
  const optics = useSignal(true);
  const reduced = useConst(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const still = useSignal(reduced);
  const selected = useSignal(2); // embed.cache — the stage at fault
  const hovered = useSignal<number | null>(null);
  const cursor = useSignal<number | null>(null);
  const requested = useSignal<readonly string[]>([]);

  const state: SceneState = {
    theme: dark.get() ? DARK : LIGHT,
    glass: optics.get(),
    still: still.get(),
  };
  const { theme } = state;

  return (
    <Group>
      <Rectangle pointerEvents="none" style={{ width: W, height: H, fill: theme.canvas }} />

      <Text pointerEvents="none" style={{ left: 24, top: 22, font: FONT.eyebrow, fill: theme.fgFaint }}>
        {`SERVING PATH · rt-infer-v4 · us-east-1 · ${clock(T0)}–${clock(T1)}`}
      </Text>
      <Text pointerEvents="none" style={{ left: 24, top: 38, font: FONT.title, fill: theme.fg }}>
        {"Two stages over SLO since 14:16"}
      </Text>
      <Text pointerEvents="none" style={{ left: 24, top: 66, font: FONT.caption, fill: theme.fgMuted }}>
        {"Six stages, each against its own p95 budget, on one clock."}
      </Text>

      <PathTotalPane state={state} />
      <Trellis state={state} selected={selected} hovered={hovered} cursor={cursor} />
      <Detail state={state} selected={selected} requested={requested} />

      <Legend state={state} />
      <Text pointerEvents="none" style={{ left: 24, top: 578, font: FONT.eyebrow, fill: theme.fgFaint }}>
        {`synthetic telemetry · p95 per 2-min bucket · post.rerank unmeasured since ${clock(
          COVERAGE_END,
        )}`}
      </Text>

      <Toggle
        state={state}
        left={588}
        label={still.get() ? "MOTION OFF" : "MOTION ON"}
        onToggle={() => still.update((value) => !value)}
      />
      <Toggle
        state={state}
        left={680}
        label={optics.get() ? "GLASS ON" : "GLASS OFF"}
        onToggle={() => optics.update((value) => !value)}
      />
      <Toggle
        state={state}
        left={772}
        label={dark.get() ? "DARK MODE" : "LIGHT MODE"}
        onToggle={() => dark.update((value) => !value)}
      />
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, (
    <FocusManagement>
      <PipelineHealth />
    </FocusManagement>
  ), { viewport: { width: W, height: H }, fit: "contain" });
}
