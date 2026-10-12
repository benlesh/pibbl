import { FocusManagement, Text, pibbl } from "@pibbl/core";
import {
  LineSeries,
  LinearScale,
  UTCScale,
  indexTo100,
  type IndexedValuePoint,
} from "@pibbl/core/viz";
const prices = [
  { time: Date.UTC(2026, 0, 2), close: 40 },
  { time: Date.UTC(2026, 0, 5), close: 44 },
  { time: Date.UTC(2026, 0, 6), close: 38 },
];
const indexed:
  readonly IndexedValuePoint<(typeof prices)[number]>[] | undefined =
  indexTo100(prices, {
    time: "time",
    value: "close",
    baseTime: prices[0]!.time,
  });
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(
    canvas,
    <FocusManagement>
      <UTCScale
        id="time"
        domain={[prices[0]!.time, prices.at(-1)!.time]}
        range={[24, 296]}
      >
        <LinearScale id="index" domain={[90, 115]} range={[176, 40]}>
          <Text
            pointerEvents="none"
            style={{
              left: 24,
              top: 12,
              font: "11px sans-serif",
              fill: "#18283d",
            }}
          >
            Common base = 100: 100, 110, 95
          </Text>
          {indexed ? (
            <LineSeries
              data={indexed}
              x="time"
              y="indexValue"
              xScale="time"
              yScale="index"
              style={{ stroke: "#00876e", strokeWidth: 2 }}
            />
          ) : (
            <Text>Unavailable common base</Text>
          )}
        </LinearScale>
      </UTCScale>
    </FocusManagement>,
  );
}

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = mount(canvas);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
