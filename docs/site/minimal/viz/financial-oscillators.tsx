import { FocusManagement, Text, pibbl } from "@pibbl/core";
import {
  movingAverageConvergenceDivergence,
  relativeStrengthIndex,
  stochasticOscillator,
  type MovingAverageConvergenceDivergencePoint,
  type MovingAverageConvergenceDivergenceOptions,
  type OscillatorOptions,
  type RelativeStrengthIndexPoint,
  type RelativeStrengthIndexOptions,
  type StochasticOscillatorOptions,
  type StochasticOscillatorPoint,
} from "@pibbl/core/viz";

const prices = [
  { high: 103, low: 99, close: 100 },
  { high: 105, low: 100, close: 104 },
  { high: 106, low: 102, close: 103 },
  { high: 108, low: 102, close: 107 },
];
const closing: OscillatorOptions<(typeof prices)[number]> = { value: "close" };
const rsiOptions: RelativeStrengthIndexOptions<(typeof prices)[number]> = {
  ...closing,
  period: 2,
};
const rsi: readonly RelativeStrengthIndexPoint<(typeof prices)[number]>[] =
  relativeStrengthIndex(prices, rsiOptions);
const macdOptions: MovingAverageConvergenceDivergenceOptions<
  (typeof prices)[number]
> = {
  ...closing,
  fastPeriod: 2,
  slowPeriod: 3,
  signalPeriod: 2,
};
const macd: readonly MovingAverageConvergenceDivergencePoint<
  (typeof prices)[number]
>[] = movingAverageConvergenceDivergence(prices, macdOptions);
const stochasticOptions: StochasticOscillatorOptions<(typeof prices)[number]> =
  {
    high: "high",
    low: "low",
    close: "close",
    lookbackPeriod: 2,
    kPeriod: 1,
    dPeriod: 2,
  };
const stochastic: readonly StochasticOscillatorPoint<
  (typeof prices)[number]
>[] = stochasticOscillator(prices, stochasticOptions);

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
