import {
  Absolute,
  Group,
  Line,
  Rectangle,
  Text,
  crc,
  useLayoutBox,
  type CRCController,
} from "@crc/core";
import { Axis, LineSeries, Scale } from "@crc/viz";

const rows = [
  [Date.UTC(2026, 0, 15), 42],
  [Date.UTC(2026, 1, 1), 56],
  [Date.UTC(2026, 1, 15), 51],
  [Date.UTC(2026, 2, 1), 74],
  [Date.UTC(2026, 2, 15), 68],
].map(([time, value]) => ({ time, value }));
const ink = "#172b3a";

function Scene() {
  const box = useLayoutBox();
  const origin = { x: 72, y: 140 };
  const width = Math.max(240, box.width - 108);
  const height = Math.max(130, box.height - origin.y - 96);
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#fffdf8" }}
      />
      <Text
        style={{ left: 28, top: 26, font: "bold 26px sans-serif", fill: ink }}
      >
        UTC release trend
      </Text>
      <Text
        style={{ left: 28, top: 60, font: "12px sans-serif", fill: "#637785" }}
      >
        Illustrative weekly score · timestamps remain epoch milliseconds
      </Text>
      <Group style={{ translateX: origin.x, translateY: origin.y }}>
        <Absolute style={{ width, height }}>
          <Scale
            id="time"
            type="utc"
            domain={[rows[0]!.time, rows[rows.length - 1]!.time]}
            range="width"
          >
            <Scale
              id="score"
              type="linear"
              domain={[0, 100]}
              range="height"
              reverse
            >
              <Axis
                scale="time"
                position="bottom"
                tickCount={4}
                tickFormat={(value) =>
                  new Date(value as number).toISOString().slice(5, 10)
                }
                style={{
                  stroke: "#a4b3b7",
                  fill: "#637785",
                  font: "11px sans-serif",
                }}
              />
              <Axis
                scale="score"
                position="left"
                tickCount={5}
                style={{
                  stroke: "#a4b3b7",
                  fill: "#637785",
                  font: "11px sans-serif",
                }}
              />
              <Line
                pointerEvents="none"
                style={{
                  coords: [
                    [0, 0],
                    [width, 0],
                  ],
                  stroke: "#e4eae9",
                  strokeWidth: 1,
                }}
              />
              <LineSeries
                data={rows}
                x="time"
                y="value"
                xScale="time"
                yScale="score"
                style={{ stroke: "#197d70", strokeWidth: 3 }}
              />
            </Scale>
          </Scale>
        </Absolute>
      </Group>
      <Text
        style={{
          left: 37,
          top: origin.y + height + 60,
          font: "11px sans-serif",
          fill: "#637785",
        }}
      >
        UTC calendar ticks use a deterministic default ISO formatter; this
        example uses a compact override.
      </Text>
    </Group>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Scene />, { viewport: "responsive" });
}
