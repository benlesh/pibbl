import { FocusManagement, Text, pibbl } from "@pibbl/core";
import {
  LineSeries,
  LinearScale,
  UTCScale,
  percentageReturns,
  type ComparisonBaseOptions,
  type PercentageReturnPoint,
} from "@pibbl/core/viz";
const prices = [
  { time: Date.UTC(2026, 0, 2), close: 100 },
  { time: Date.UTC(2026, 0, 5), close: 110 },
  { time: Date.UTC(2026, 0, 6), close: null },
  { time: Date.UTC(2026, 0, 7), close: 95 },
];
const options: ComparisonBaseOptions<(typeof prices)[number]> = {
  time: "time",
  value: "close",
  baseTime: prices[0]!.time,
};
const returns:
  readonly PercentageReturnPoint<(typeof prices)[number]>[] | undefined =
  percentageReturns(prices, options);
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(
    canvas,
    <FocusManagement>
      <UTCScale
        id="time"
        domain={[prices[0]!.time, prices.at(-1)!.time]}
        range={[24, 296]}
      >
        <LinearScale id="returns" domain={[-10, 15]} range={[176, 40]}>
          <Text
            pointerEvents="none"
            style={{
              left: 24,
              top: 12,
              font: "11px sans-serif",
              fill: "#18283d",
            }}
          >
            Return from 02 Jan: 0%, +10%, gap, −5%
          </Text>
          {returns ? (
            <LineSeries
              data={returns}
              x="time"
              y="returnPercent"
              xScale="time"
              yScale="returns"
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
