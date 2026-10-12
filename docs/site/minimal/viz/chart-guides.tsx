import { Group, Overlay, Text, pibbl } from "@pibbl/core";
import {
  Axis,
  AxisTitle,
  type AxisTitleProps,
  LinearScale,
  LineSeries,
  PointSeries,
  GridLines,
  ReferenceLine,
  ReferenceBand,
  type ChartLineProps,
  type GridLinesProps,
  type ReferenceLineProps,
  type ReferenceBandProps,
} from "@pibbl/core/viz";

// Illustrative tank readings, not operational thresholds or measured data.
const readings = [
  { day: 1, fill: 35 },
  { day: 2, fill: 52 },
  { day: 3, fill: 68 },
];
const guide: ChartLineProps = {
  scale: "fill",
  direction: "horizontal",
  span: [0, 400],
};
const grid: GridLinesProps = { ...guide, tickValues: [0, 25, 50, 75, 100] };
const target: ReferenceLineProps = {
  ...guide,
  value: 50,
  style: { stroke: "#087f8c", strokeWidth: 2 },
};
const zone: ReferenceBandProps = {
  ...guide,
  values: [40, 60],
  style: { fill: "#bde8d5", opacity: 1 },
};
const fillTitle: AxisTitleProps = {
  scale: "fill",
  position: "left",
  label: "Tank fill",
  unit: "%",
  offset: 50,
};
const canvas = document.createElement("canvas");
canvas.width = 540;
canvas.height = 350;
canvas.style.cssText = "max-width:100%;height:auto";
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <Text
      style={{
        left: 24,
        top: 28,
        font: "600 18px sans-serif",
        fill: "#183153",
      }}
    >
      Tank fill over three days
    </Text>
    <Text
      style={{ left: 24, top: 53, font: "13px sans-serif", fill: "#475569" }}
    >
      Shaded zone: 40–60% · teal line: 50% target
    </Text>
    <Group style={{ translateX: 65, translateY: 85 }}>
      <Overlay style={{ width: 400, height: 160 }}>
        <LinearScale
          id="day"
          domain={[1, 3]}
          range={[0, 400]}
          style={{ width: 400, height: 160 }}
        >
          <LinearScale
            id="fill"
            domain={[0, 100]}
            range={[160, 0]}
            style={{ width: 400, height: 160 }}
          >
            <AxisTitle {...fillTitle} />
            <AxisTitle
              scale="day"
              position="bottom"
              label="Elapsed time"
              unit="days"
              offset={42}
            />
            <ReferenceBand {...zone} />
            <GridLines {...grid} />
            <ReferenceLine {...target} />
            <Axis
              scale="fill"
              position="left"
              tickValues={[0, 25, 50, 75, 100]}
              tickFormat={(value) => `${value}%`}
            />
            <Axis
              scale="day"
              position="bottom"
              tickValues={[1, 2, 3]}
              tickFormat={(value) => `Day ${value}`}
            />
            <LineSeries
              data={readings}
              x="day"
              y="fill"
              xScale="day"
              yScale="fill"
              style={{ stroke: "#183153", strokeWidth: 2 }}
            />
            <PointSeries
              data={readings}
              x="day"
              y="fill"
              xScale="day"
              yScale="fill"
              style={{ fill: "#183153", radius: 4 }}
            />
          </LinearScale>
        </LinearScale>
      </Overlay>
    </Group>
    <Text
      style={{ left: 24, top: 330, font: "12px sans-serif", fill: "#475569" }}
    >
      Day 1 below zone · Day 2 inside · Day 3 above
    </Text>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
