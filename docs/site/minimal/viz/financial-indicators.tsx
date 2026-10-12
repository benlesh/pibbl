import { FocusManagement, Text, pibbl } from "@pibbl/core";
import {
  bollingerBands,
  exponentialMovingAverage,
  simpleMovingAverage,
} from "@pibbl/core/viz";

const prices = [
  { close: 100 },
  { close: 102 },
  { close: 101 },
  { close: 105 },
];
const options = { value: "close", period: 3 } as const;
const sma = simpleMovingAverage(prices, options);
const ema = exponentialMovingAverage(prices, options);
const bands = bollingerBands(prices, options);

export default function mount(canvas: HTMLCanvasElement) {
  const last = prices.length - 1;
  return pibbl(canvas, <FocusManagement><Text style={{ left: 16, top: 18, font: "12px sans-serif" }}>
    {`SMA ${sma[last]!.average} · EMA ${ema[last]!.average} · band mean ${bands[last]!.mean}`}
  </Text></FocusManagement>);
}
