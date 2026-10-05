import {
  Absolute,
  Group,
  Line,
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
  type WritableSignal,
} from "@pibbl/core";
import { Axis, BarSeries, Scale, useScale } from "@pibbl/core/viz";

// Census Bureau, Vintage 2023, Table 1. Historical snapshot, not current estimates.
// https://www.census.gov/newsroom/press-releases/2023/population-trends-return-to-pre-pandemic-norms.html
const populations = [
  { state: "California", short: "CA", counts: [39538212, 39040616, 38965193] },
  { state: "Texas", short: "TX", counts: [29145459, 30029848, 30503301] },
  { state: "Florida", short: "FL", counts: [21538216, 22245521, 22610726] },
  { state: "New York", short: "NY", counts: [20202320, 19673200, 19571216] },
  {
    state: "Pennsylvania",
    short: "PA",
    counts: [13002788, 12972091, 12961683],
  },
  { state: "Illinois", short: "IL", counts: [12813469, 12582515, 12549689] },
];
const years = ["2020", "2022", "2023"];
const rows = populations.flatMap(({ state, counts }) =>
  counts.map((population, index) => ({
    state,
    year: years[index],
    population,
  })),
);
const colors: Record<string, string> = {
  "2020": "#c47b36",
  "2022": "#4e78ad",
  "2023": "#197d70",
};
const ink = "#172b3a";
function Button({
  x,
  y,
  label,
  action,
}: {
  x: number;
  y: number;
  label: string;
  action: () => void;
}) {
  return (
    <Group style={{ translateX: x, translateY: y }}>
      <Rectangle
        onClick={action}
        style={{
          width: 138,
          height: 32,
          cornerRadius: 6,
          fill: "#e4eae9",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 69,
          top: 16,
          textAlign: "center",
          textBaseline: "middle",
          font: "12px sans-serif",
          fill: ink,
        }}
      >
        {label}
      </Text>
    </Group>
  );
}
function Plot({
  origin,
  selected,
}: {
  origin: { x: number; y: number };
  selected: WritableSignal<string | null>;
}) {
  const states = useScale("states", "band").get();
  const groups = useScale("years", "band").get();
  const values = useScale("population").get();
  function inspect(event: PibblPointerEvent) {
    const x = event.x - origin.x,
      y = event.y - origin.y;
    const hit = rows.find((row) => {
      const outer = states.map(row.state),
        inner = groups.map(row.year);
      return (
        outer !== undefined &&
        inner !== undefined &&
        x >= outer + inner &&
        x <= outer + inner + groups.bandwidth &&
        y >= values.map(row.population) &&
        y <= values.map(0)
      );
    });
    selected.set(
      hit
        ? `${hit.state} · ${hit.year} · ${hit.population.toLocaleString("en-US")}`
        : null,
    );
  }
  return (
    <Group
      onPointerMove={inspect}
      onPointerDown={inspect}
      onPointerLeave={() => selected.set(null)}
    >
      <Axis
        scale="population"
        position="left"
        tickCount={5}
        tickFormat={(v) =>
          typeof v === "number" ? `${v / 1000000}m` : v}
        style={{ stroke: "#a4b3b7", fill: "#637785", font: "11px sans-serif" }}
      />
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [0, values.map(0)],
            [states.frame.width, values.map(0)],
          ],
          stroke: "#a4b3b7",
          strokeWidth: 1,
        }}
      />
      <BarSeries
        data={rows}
        category="state"
        value="population"
        group="year"
        categoryScale="states"
        valueScale="population"
        groupScale="years"
        style={(row) => ({ fill: colors[row.year] })}
      />
      {populations.map((state) => {
        const x = states.map(state.state);
        if (x === undefined) return null;
        return (
          <Text
            key={state.state}
            pointerEvents="none"
            style={{
              left: x + states.bandwidth / 2,
              top: states.frame.height + 23,
              textAlign: "center",
              font: "12px sans-serif",
              fill: ink,
            }}
          >
            {states.step < 115 ? state.short : state.state}
          </Text>
        );
      })}
      <Text
        pointerEvents="none"
        style={{
          left: -35,
          top: states.frame.height + 56,
          font: "13px sans-serif",
          fill: ink,
        }}
      >
        {selected.get() ?? "Hover or tap a bar for its population"}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          left: -35,
          top: states.frame.height + 81,
          font: "11px sans-serif",
          fill: "#637785",
        }}
      >
        Census Bureau · Vintage 2023 estimates
      </Text>
    </Group>
  );
}
function Scene() {
  const box = useLayoutBox();
  const groups = useSignal<readonly string[]>(["2022", "2023"]);
  const compact = useSignal(false);
  const selected = useSignal<string | null>(null);
  const narrow = box.width < 500;
  const origin = { x: 64, y: narrow ? 221 : 177 };
  const width = Math.max(230, (box.width - 96) * (compact.get() ? 0.75 : 1));
  const height = Math.max(60, box.height - origin.y - 100);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#fffdf8" }}
      />
      <Text style={{ left: 28, top: 25, font: "bold 26px sans-serif", fill: ink }}>
        Population, side by side
      </Text>
      <Text style={{ left: 28, top: 59, font: "12px sans-serif", fill: "#637785" }}>
        Six largest U.S. states · population in millions
      </Text>
      <Button
        x={28}
        y={83}
        label="Reverse years"
        action={() => {
          groups.set([...groups.get()].reverse());
          selected.set(null);
        }}
      />
      <Button
        x={178}
        y={83}
        label={groups.get().includes("2020") ? "Remove 2020" : "Add 2020"}
        action={() => {
          groups.set(
            groups.get().includes("2020")
              ? groups.get().filter((y) => y !== "2020")
              : ["2020", ...groups.get()],
          );
          selected.set(null);
        }}
      />
      <Button
        x={narrow ? 28 : 328}
        y={narrow ? 125 : 83}
        label="Resize plot"
        action={() => compact.set(!compact.get())}
      />
      {groups.get().map((year, index) => (
        <Group
          key={year}
          style={{ translateX: 28 + index * 110, translateY: origin.y - 35 }}
        >
          <Rectangle style={{ width: 12, height: 12, fill: colors[year] }} />
          <Text style={{ left: 19, top: 10, font: "12px sans-serif", fill: ink }}>
            {year}
          </Text>
        </Group>
      ))}
      <Group style={{ translateX: origin.x, translateY: origin.y }}>
        <Absolute style={{ width, height }}>
          <Scale
            id="states"
            type="band"
            domain={populations.map((row) => row.state)}
            range="width"
            paddingInner={0.25}
            paddingOuter={0.15}
            style={{ width, height }}
          >
            <Scale
              id="years"
              type="band"
              domain={groups}
              range={{ bandwidthOf: "states" }}
              paddingInner={0.12}
              paddingOuter={0.03}
            >
              <Scale
                id="population"
                type="linear"
                domain={[0, 42000000]}
                range="height"
                reverse
              >
                <Plot origin={origin} selected={selected} />
              </Scale>
            </Scale>
          </Scale>
        </Absolute>
      </Group>
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Scene />, { viewport: "responsive" });
}
