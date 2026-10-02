import {
  Absolute,
  Circle,
  Group,
  Line,
  Rectangle,
  Text,
  batch,
  crc,
  useLayoutBox,
  useSignal,
  type CRCController,
  type CRCPointerEvent,
  type WritableSignal,
  type SignalValue,
  type Signal,
} from "@crc/core";
import {
  Axis,
  Scale,
  LineSeries,
  HoverData,
  AnchoredLayout,
  closestPoint,
  closestX,
  defineSeries,
  interpolateX,
  linearInterpolation,
  useScale,
  type HoverQueryContext,
  type HoverHit,
  type HoverSample,
} from "@crc/viz";
type Row = { id?: string; x: number; y: number | null };
type Mode = "closest-point" | "nearest-per-line" | "interpolated-x";
type Reading = {
  series: string;
  kind: string;
  x: number;
  y: number;
  anchor: { x: number; y: number };
  distance: { space: "plot-pixels" | "domain-x"; value: number } | null;
  provenance:
    | { kind: "recorded"; index: number; id: string | null }
    | { kind: "interpolated"; beforeIndex: number; afterIndex: number; beforeId: string | null; afterId: string | null; fraction: number };
};
type Snapshot = {
  duplicateX: "error" | "first" | "last";
  generation: number;
  viewport: { width: number; height: number };
  mode: Mode;
  inspection: number | null;
  pointer: { x: number; y: number } | null;
  results: readonly Reading[];
  plot: { x: number; y: number; width: number; height: number };
};
interface Fixture {
  first?: SignalValue<readonly Row[]>;
  generation?: Signal<number>;
  duplicateX?: Signal<"error" | "first" | "last">;
  second?: readonly Row[];
  xDomain?: readonly [number, number];
  yDomain?: readonly [number, number];
  mode?: WritableSignal<Mode>;
  inspection?: WritableSignal<number | null>;
  onSnapshot?: (snapshot: Snapshot) => void;
}
// Static NOAA/GML Mauna Loa monthly mean and deseasonalized CO2 (ppm), 2020–2021.
// Reuses the verified 2026-09-28 snapshot in the accepted CO2 example unchanged.
// Source: https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Credit: Xin Lan, NOAA/GML, and Ralph Keeling, Scripps Institution of Oceanography.
// Published [monthly mean, deseasonalized] pairs; no missing values in this window.
// The deseasonalized line is NOAA's derived series, not a second measurement site.
const observations: readonly (readonly [number, number])[] = [
  [413.59, 413.22],
  [414.32, 413.41],
  [414.72, 413.35],
  [416.42, 413.92],
  [417.28, 413.98],
  [416.58, 414.16],
  [414.58, 414.19],
  [412.75, 414.6],
  [411.5, 414.91],
  [411.49, 414.79],
  [413.1, 415.12],
  [414.23, 414.91],
  [415.49, 415.23],
  [416.72, 415.8],
  [417.61, 416.17],
  [419.01, 416.58],
  [419.09, 415.88],
  [418.93, 416.48],
  [416.9, 416.48],
  [414.42, 416.27],
  [413.26, 416.63],
  [413.9, 417.14],
  [414.97, 416.93],
  [416.67, 417.37],
];
const monthly = observations.map(([mean], i) => ({
  x: Date.UTC(2020, i, 15),
  y: mean,
}));
const adjusted = observations.map(([, value], i) => ({
  x: Date.UTC(2020, i, 15),
  y: value,
}));
const blue = "#2878b5",
  orange = "#d47722",
  ink = "#182c42",
  muted = "#62758b";
function date(x: number) {
  return new Date(x).toISOString().slice(0, 10);
}
function Plot({
  fixture,
  mode,
  inspection,
  origin,
  viewport,
}: {
  fixture: Fixture;
  mode: WritableSignal<Mode>;
  inspection: WritableSignal<number | null>;
  origin: { x: number; y: number };
  viewport: { width: number; height: number };
}) {
  const xs = useScale("time").get(),
    ys = useScale("co2").get();
  const position = useSignal<{ x: number; y: number } | null>(null),
    drag = useSignal<number | null>(null);
  const first = defineSeries({
    data: fixture.first ?? monthly,
    x: "x",
    y: "y",
  });
  const second = defineSeries({
    data: fixture.second ?? adjusted,
    x: "x",
    y: "y",
  });
  const one = closestPoint({
    series: { monthly: first, adjusted: second },
    position,
    xScale: "time",
    yScale: "co2",
    maxDistance: 40,
  });
  const nearestA = closestX({
    series: first,
    x: inspection,
    xScale: "time",
    yScale: "co2",
  });
  const nearestB = closestX({
    series: second,
    x: inspection,
    xScale: "time",
    yScale: "co2",
  });
  const sampleA = interpolateX({
    series: first,
    x: inspection,
    xScale: "time",
    yScale: "co2",
    interpolation: linearInterpolation(),
    duplicateX: fixture.duplicateX?.get() ?? "error",
  });
  const sampleB = interpolateX({
    series: second,
    x: inspection,
    xScale: "time",
    yScale: "co2",
    interpolation: linearInterpolation(),
  });
  function provenance(hit: HoverHit<Row> | HoverSample<Row>): Reading["provenance"] {
    if ("kind" in hit && hit.kind === "interpolated") return {
      kind: "interpolated", beforeIndex: hit.beforeIndex, afterIndex: hit.afterIndex,
      beforeId: hit.before.id ?? null, afterId: hit.after.id ?? null, fraction: hit.fraction,
    };
    return { kind: "recorded", index: hit.index, id: hit.datum.id ?? null };
  }
  function query(context: HoverQueryContext) {
    const selected = mode.get();
    const results: Reading[] = [];
    if (selected === "closest-point") {
      const hit = one(context);
      if (hit)
        results.push({
          series: hit.series,
          kind: "recorded",
          x: hit.x,
          y: hit.y,
          anchor: hit.anchor,
          provenance: provenance(hit),
          distance: { space: "plot-pixels", value: hit.distance },
        });
    } else {
      const a =
        selected === "nearest-per-line" ? nearestA(context) : sampleA(context);
      const b =
        selected === "nearest-per-line" ? nearestB(context) : sampleB(context);
      if (a)
        results.push({
          series: "monthly",
          kind: "kind" in a ? a.kind : "recorded",
          x: a.x,
          y: a.y,
          anchor: a.anchor,
          provenance: provenance(a),
          distance: "delta" in a ? { space: "domain-x", value: a.delta } : null,
        });
      if (b)
        results.push({
          series: "adjusted",
          kind: "kind" in b ? b.kind : "recorded",
          x: b.x,
          y: b.y,
          anchor: b.anchor,
          provenance: provenance(b),
          distance: "delta" in b ? { space: "domain-x", value: b.delta } : null,
        });
    }
    fixture.onSnapshot?.({
      duplicateX: fixture.duplicateX?.get() ?? "error",
      generation: fixture.generation?.get() ?? 0,
      viewport,
      mode: selected,
      inspection: inspection.get(),
      pointer: position.get(),
      results,
      plot: {
        x: origin.x,
        y: origin.y,
        width: xs.frame.width,
        height: ys.frame.height,
      },
    });
    return results;
  }
  function move(event: CRCPointerEvent) {
    const x = Math.max(0, Math.min(xs.frame.width, event.x - origin.x));
    batch(() => {
      position.set({ x, y: event.y - origin.y });
      inspection.set(xs.range[0] === xs.range[1] ? null : xs.invert(x));
    });
  }
  function finish(event: CRCPointerEvent) {
    if (drag.get() !== event.pointerId) return;
    drag.set(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const x = inspection.get();
  return (
    <Group>
      <Rectangle
        style={{
          width: xs.frame.width,
          height: ys.frame.height,
          fill: "#fff",
          cursor: "crosshair",
        }}
        onPointerMove={move}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.set(event.pointerId);
          move(event);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onLostPointerCapture={() => drag.set(null)}
        onPointerLeave={() => {
          if (drag.get() === null)
            batch(() => {
              position.set(null);
              inspection.set(null);
            });
        }}
      />
      <Axis
        scale="time"
        position="bottom"
        tickCount={5}
        tickFormat={(value) =>
          typeof value === "string" ? value : fixture.xDomain ? String(Math.round(value)) : date(value).slice(0, 7)
        }
        style={{ font: "10px sans-serif", fill: muted, stroke: "#bac8d5" }}
      />
      <Axis
        scale="co2"
        position="left"
        tickCount={5}
        style={{ font: "11px sans-serif", fill: muted, stroke: "#bac8d5" }}
      />
      <LineSeries
        data={first.data}
        x="x"
        y="y"
        xScale="time"
        yScale="co2"
        pointerEvents="none"
        style={{ stroke: blue, strokeWidth: 2 }}
      />
      <LineSeries
        data={second.data}
        x="x"
        y="y"
        xScale="time"
        yScale="co2"
        pointerEvents="none"
        style={{ stroke: orange, strokeWidth: 2 }}
      />
      {x !== null && (
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [xs.map(x), 0],
              [xs.map(x), ys.frame.height],
            ],
            stroke: "#7b8c9e",
            strokeWidth: 1,
          }}
        />
      )}
      <HoverData query={query}>
        {(results) => (
          <>
            {results?.map((result) => (
              <Group
                key={result.series}
                style={{
                  translateX: result.anchor.x,
                  translateY: result.anchor.y,
                }}
              >
                <Circle
                  pointerEvents="none"
                  style={{
                    radius: 5,
                    fill: result.series === "monthly" ? blue : orange,
                    stroke: "white",
                    strokeWidth: 2,
                  }}
                />
              </Group>
            ))}
            <AnchoredLayout
              items={(results ?? []).map((result) => ({
                key: result.series,
                anchor: result.anchor,
                anchorRadius: 6,
                width: Math.min(184, Math.max(120, xs.frame.width - 20)),
                height: 68,
                result,
              }))}
              gap={8}
            >
              {(item, placement) => {
                const result = item.result;
                const anchor = {
                  x: item.anchor.x - placement.x,
                  y: item.anchor.y - placement.y,
                };
                const edge = {
                  x: Math.max(0, Math.min(item.width, anchor.x)),
                  y: Math.max(0, Math.min(item.height, anchor.y)),
                };
                const dx = edge.x - anchor.x,
                  dy = edge.y - anchor.y,
                  distance = Math.hypot(dx, dy);
                return (
                  <>
                    <Line
                      pointerEvents="none"
                      style={{
                        coords: [
                          [
                            anchor.x + (dx * 6) / distance,
                            anchor.y + (dy * 6) / distance,
                          ],
                          [edge.x, edge.y],
                        ],
                        stroke: result.series === "monthly" ? blue : orange,
                        strokeWidth: 1,
                      }}
                    />
                    <Rectangle
                      pointerEvents="none"
                      style={{
                        left: 0.5,
                        top: 0.5,
                        width: item.width - 1,
                        height: item.height - 1,
                        cornerRadius: 7,
                        fill: "rgba(255,255,255,0.94)",
                        stroke: "rgba(98,117,139,0.35)",
                        strokeWidth: 1,
                      }}
                    />
                    <Group style={{ translateX: 10, translateY: 10 }}>
                      <Text
                        pointerEvents="none"
                        style={{ font: "bold 11px sans-serif", fill: ink }}
                      >
                        {result.series === "monthly"
                          ? "Monthly mean"
                          : "Deseasonalized"}
                      </Text>
                      <Text
                        pointerEvents="none"
                        style={{ top: 17, font: "12px sans-serif", fill: ink }}
                      >
                        {`${result.y.toFixed(2)} ppm · ${result.kind === "interpolated" ? "estimated" : "recorded"}`}
                      </Text>
                      <Text
                        pointerEvents="none"
                        style={{ top: 34, font: "10px sans-serif", fill: muted }}
                      >
                        {fixture.xDomain
                          ? `x = ${result.x.toFixed(2)}`
                          : date(result.x)}
                      </Text>
                    </Group>
                  </>
                );
              }}
            </AnchoredLayout>
          </>
        )}
      </HoverData>
    </Group>
  );
}
function Scene({ fixture }: { fixture: Fixture }) {
  const box = useLayoutBox();
  const ownMode = useSignal<Mode>("interpolated-x"),
    ownInspection = useSignal<number | null>(Date.UTC(2020, 6, 1));
  const mode = fixture.mode ?? ownMode,
    inspection = fixture.inspection ?? ownInspection;
  const narrow = box.width < 650,
    top = narrow ? 235 : 175,
    left = 55;
  const width = Math.max(1, box.width - left - 28),
    height = Math.max(100, box.height - top - 70);
  const modes: readonly Mode[] = [
    "closest-point",
    "nearest-per-line",
    "interpolated-x",
  ];
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#f4f7fb" }}
      />
      <Text style={{ left: 24, top: 20, font: "bold 24px sans-serif", fill: ink }}>
        Two lines. Three questions.
      </Text>
      <Text style={{ left: 24, top: 55, font: "12px sans-serif", fill: muted }}>
        Mauna Loa CO₂ · 2020–2021 · ppm
      </Text>
      {modes.map((value, i) => (
        <Group
          key={value}
          style={{
            translateX: 24 + (narrow ? 0 : i * 190),
            translateY: 85 + (narrow ? i * 40 : 0),
          }}
        >
          <Rectangle
            style={{
              width: 180,
              height: 32,
              fill: mode.get() === value ? "#d5e6f6" : "#e6edf5",
              cornerRadius: 5,
              cursor: "pointer",
            }}
            onClick={() => mode.set(value)}
          />
          <Text
            pointerEvents="none"
            style={{ left: 10, top: 10, font: "12px sans-serif", fill: ink }}
          >
            {
              [
                "One closest point",
                "Nearest on each line",
                "Same time · interpolated",
              ][i]
            }
          </Text>
        </Group>
      ))}
      <Text
        style={{ left: 24, top: top - 30, font: "11px sans-serif", fill: muted }}
      >
        Move to inspect · Press and drag the guide
      </Text>
      <Absolute>
        <Scale
          id="time"
          type="linear"
          domain={
            fixture.xDomain ?? [monthly[0].x, monthly[monthly.length - 1].x]
          }
          range="width"
          style={{ left, top, width, height }}
        >
          <Scale
            id="co2"
            type="linear"
            domain={fixture.yDomain ?? [410, 420]}
            range="height"
            reverse
          >
            <Plot
              fixture={fixture}
              mode={mode}
              inspection={inspection}
              origin={{ x: left, y: top }}
              viewport={{ width: box.width, height: box.height }}
            />
          </Scale>
        </Scale>
      </Absolute>
      <Text
        style={{
          left: 24,
          top: box.height - 27,
          font: "10px sans-serif",
          fill: muted,
        }}
      >
        NOAA/GML & Scripps · Derived seasonal adjustment
      </Text>
    </Group>
  );
}
// VIZ_HOVER_SOURCE_ID = 'viz-hover-example'
export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): CRCController {
  const minHeight = canvas.style.minHeight,
    touchAction = canvas.style.touchAction;
  canvas.style.minHeight = "620px";
  canvas.style.touchAction = "none";
  const host = canvas.parentElement,
    overflow = host?.style.overflow;
  if (host) host.style.overflow = "auto";
  function restore() {
    canvas.style.minHeight = minHeight;
    canvas.style.touchAction = touchAction;
    if (host) host.style.overflow = overflow ?? "";
  }
  try {
    const controller = crc(canvas, <Scene fixture={fixture} />, {
      viewport: "responsive",
    });
    return {
      dispose() {
        controller.dispose();
        restore();
      },
    };
  } catch (error) {
    restore();
    throw error;
  }
}
