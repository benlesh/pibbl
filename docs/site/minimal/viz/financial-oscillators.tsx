import { FocusManagement, Text, pibbl } from "@pibbl/core";
import {
  movingAverageConvergenceDivergence,
  relativeStrengthIndex,
  stochasticOscillator,
} from "@pibbl/core/viz";

const prices = [
  { high: 103, low: 99, close: 100 },
  { high: 105, low: 100, close: 104 },
  { high: 106, low: 102, close: 103 },
  { high: 108, low: 102, close: 107 },
];
const rsi = relativeStrengthIndex(prices, { value: "close", period: 2 });
const macd = movingAverageConvergenceDivergence(prices, {
  value: "close",
  fastPeriod: 2,
  slowPeriod: 3,
  signalPeriod: 2,
});
const stochastic = stochasticOscillator(prices, {
  high: "high",
  low: "low",
  close: "close",
  lookbackPeriod: 2,
  kPeriod: 1,
  dPeriod: 2,
});

export default function mount(canvas: HTMLCanvasElement) {
  const last = prices.length - 1;
  return pibbl(
    canvas,
    <FocusManagement>
      <Text style={{ left: 16, top: 18, font: "12px sans-serif" }}>
        {`RSI ${rsi[last]!.rsi} · MACD ${macd[last]!.macd} · %K ${stochastic[last]!.k}`}
      </Text>
    </FocusManagement>,
  );
}
