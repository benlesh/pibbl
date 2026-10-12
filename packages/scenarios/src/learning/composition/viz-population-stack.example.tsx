import {
  FocusManagement,
  Group,
  Overlay,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
} from "@pibbl/core";
import {
  Axis,
  BarScale,
  BarSeries,
  LinearScale,
  useBarScale,
} from "@pibbl/core/viz";
// Census Bureau Vintage 2023, Table 1; historical snapshot reused from viz-grouped-bars.
// https://www.census.gov/newsroom/press-releases/2023/population-trends-return-to-pre-pandemic-norms.html
// 2020 = April 1 estimates base; 2022/2023 = July 1 estimates. Unit: people.
const states = [
  {
    state: "California",
    color: "#087f8c",
    counts: [39538212, 39040616, 38965193],
  },
  { state: "Texas", color: "#c17a24", counts: [29145459, 30029848, 30503301] },
  {
    state: "Florida",
    color: "#7952a3",
    counts: [21538216, 22245521, 22610726],
  },
];
interface PopulationRow {
  year: string;
  state: string;
  value: number;
  color: string;
}
const populationRows: readonly PopulationRow[] = [
  "2020",
  "2022",
  "2023",
].flatMap((year, i) =>
  states.map((s) => ({
    year,
    state: s.state,
    value: s.counts[i],
    color: s.color,
  })),
);
// This example owns its transform. Renderer receives explicit endpoints; no aggregation API.
// Invalid values reject, order stays authored, denominator is these three states per year.
function stackPopulation(rows: readonly PopulationRow[], normalized: boolean) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!Number.isFinite(row.value) || row.value < 0)
      throw new RangeError(
        "Population recipe requires complete nonnegative counts.",
      );
    totals.set(row.year, (totals.get(row.year) ?? 0) + row.value);
  }
  const offsets = new Map<string, number>();
  return rows.map((row) => {
    const total = totals.get(row.year)!;
    if (!Number.isFinite(total))
      throw new RangeError("Population total must be finite.");
    const startCount = offsets.get(row.year) ?? 0,
      endCount = startCount + row.value;
    offsets.set(row.year, endCount);
    const share = total === 0 ? 0 : (100 * row.value) / total;
    return {
      ...row,
      total,
      share,
      start: normalized
        ? total === 0
          ? 0
          : (100 * startCount) / total
        : startCount,
      end: normalized ? (total === 0 ? 0 : (100 * endCount) / total) : endCount,
    };
  });
}
const ink = "#172f3d",
  muted = "#526975";
function Label({
  x,
  y,
  text,
  size = 10,
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${size}px sans-serif`,
        fill: ink,
        textBaseline: "alphabetic",
      }}
    >
      {text}
    </Text>
  );
}
function Plot({
  normalized,
  left,
  rows,
}: {
  normalized: boolean;
  left: number;
  rows: ReturnType<typeof stackPopulation>;
}) {
  const { width, height } = useLayoutBox(),
    category = useBarScale("year").get(),
    selected = useSignal(0),
    focus = useSignal(false);
  const row = rows[selected.get()] ?? rows[0];
  const inspect = (e: PibblPointerEvent) => {
    const local = e.x - left;
    let year = 0,
      best = Infinity;
    for (let i = 0; i < 3; i++) {
      const center =
        category.map(["2020", "2022", "2023"][i])! + category.bandwidth / 2;
      const distance = Math.abs(local - center);
      if (distance < best) {
        best = distance;
        year = i;
      }
    }
    selected.set(year * 3 + (selected.get() % 3));
  };
  return (
    <>
      <BarSeries
        data={rows}
        category="year"
        valueStart="start"
        valueEnd="end"
        categoryScale="year"
        valueScale="population"
        pointerEvents="none"
        style={(d) => ({ fill: d.color })}
      />
      <Axis
        scale="year"
        position="bottom"
        tickValues={["2020", "2022", "2023"]}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Axis
        scale="population"
        position="left"
        tickValues={normalized ? [0, 50, 100] : [0, 50000000, 100000000]}
        tickFormat={(v) => (normalized ? `${v}%` : `${Number(v) / 1e6}m`)}
        style={{ font: "10px sans-serif", fill: muted }}
      />
      <Label
        x={-28}
        y={-10}
        text={`${row.year} · ${row.state} · ${row.value.toLocaleString("en-US")} · ${row.share.toFixed(1)}%`}
      />
      <Rectangle
        keyboardFocusable
        onFocus={() => focus.set(true)}
        onBlur={() => focus.set(false)}
        onPointerMove={inspect}
        onPointerDown={inspect}
        onKeyDown={(e) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Home",
              "End",
            ].includes(e.key)
          ) {
            e.preventDefault();
            selected.set(
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? 8
                  : Math.max(
                      0,
                      Math.min(
                        8,
                        selected.get() +
                          (["ArrowLeft", "ArrowUp"].includes(e.key) ? -1 : 1),
                      ),
                    ),
            );
          }
        }}
        style={{
          width,
          height,
          fill: "transparent",
          stroke: focus.get() ? ink : undefined,
          strokeWidth: 1,
          cursor: "crosshair",
        }}
      />
    </>
  );
}
interface RecipeOptions {
  rows?: readonly PopulationRow[];
  normalized?: boolean;
  onRows?: (rows: ReturnType<typeof stackPopulation>) => void;
}
function Scene({ options }: { options: RecipeOptions }) {
  const { width, height } = useLayoutBox(),
    normalized = useSignal(options.normalized ?? false);
  const rows = stackPopulation(
    options.rows ?? populationRows,
    normalized.get(),
  );
  options.onRows?.(rows);
  const left = 42,
    top = 99,
    plotHeight = Math.max(1, height - 178),
    plotWidth = width - left - 22;
  return (
    <>
      <Rectangle style={{ width, height, fill: "#f7faf9" }} />
      <Text
        style={{
          left: 14,
          top: 24,
          textBaseline: "alphabetic",
          font: "600 22px sans-serif",
          fill: ink,
          when: [
            {
              query: { maxWidth: 400 },
              style: { font: "600 18px sans-serif" },
            },
            {
              query: { maxHeight: 350 },
              style: { font: "600 18px sans-serif" },
            },
          ],
        }}
      >
        Three states, explicit totals
      </Text>
      <Group style={{ translateX: 14, translateY: 35 }}>
        <Rectangle
          keyboardFocusable
          onClick={() => normalized.update((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              normalized.update((v) => !v);
            }
          }}
          style={{
            width: 150,
            height: 44,
            fill: "white",
            stroke: "#b7cdd0",
            strokeWidth: 1,
            cornerRadius: 5,
            cursor: "pointer",
          }}
        />
        <Label
          x={9}
          y={27}
          text={normalized.get() ? "View counts" : "View percentage shares"}
        />
      </Group>
      <Group style={{ translateX: left, translateY: top }}>
        <Overlay style={{ width: plotWidth, height: plotHeight }}>
          <BarScale
            id="year"
            domain={["2020", "2022", "2023"]}
            range="width"
            paddingInner={0.3}
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale
              id="population"
              domain={normalized.get() ? [0, 100] : [0, 100000000]}
              range="height"
              reverse
            >
              <Plot normalized={normalized.get()} left={left} rows={rows} />
            </LinearScale>
          </BarScale>
        </Overlay>
      </Group>
      {states.map((s, i) => (
        <Group
          key={s.state}
          style={{ translateX: 14 + i * 96, translateY: height - 51 }}
        >
          <Rectangle
            pointerEvents="none"
            style={{ width: 8, height: 8, fill: s.color }}
          />
          <Label x={12} y={8} text={s.state} />
        </Group>
      ))}
      <Label
        x={14}
        y={height - 29}
        text="Share denominator = CA + TX + FL, not the US."
      />
      <Label
        x={14}
        y={height - 17}
        text="Census V2023 · 2020 Apr base; 2022/23 Jul estimates"
        size={9}
      />
      <Label
        x={14}
        y={height - 5}
        text="People · tap year · Tab, arrows, Home/End inspect"
        size={9}
      />
    </>
  );
}
export default function mount(
  canvas: HTMLCanvasElement,
  options: RecipeOptions = {},
): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene options={options} />
    </FocusManagement>,
    { viewport: "responsive" },
  );
}
