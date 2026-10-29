import { FocusManagement, Text, } from "@pibbl/core";
import { pibblSync } from '@pibbl/core/sync';
import {
  bollingerBands,
  exponentialMovingAverage,
  simpleMovingAverage,
  type BollingerBandPoint,
  type BollingerBandsOptions,
  type MovingAveragePoint,
  type MovingAverageOptions,
} from "@pibbl/core/viz";

const prices = [{ close: 100 }, { close: 102 }, { close: 101 }, { close: 105 }];
const options: MovingAverageOptions<(typeof prices)[number]> = {
  value: "close",
  period: 3,
};
const bandOptions: BollingerBandsOptions<(typeof prices)[number]> = {
  ...options,
  multiplier: 2,
};
const sma: readonly MovingAveragePoint<(typeof prices)[number]>[] =
  simpleMovingAverage(prices, options);
const ema: readonly MovingAveragePoint<(typeof prices)[number]>[] =
  exponentialMovingAverage(prices, options);
const bands: readonly BollingerBandPoint<(typeof prices)[number]>[] =
  bollingerBands(prices, bandOptions);

export function FinancialIndicatorsExample() {
  const last = prices.length - 1;

  return (
    <FocusManagement>
      <Text
        style={{ left: 16, top: 18, font: "12px sans-serif", fill: "#18283d" }}
      >
        {`SMA ${sma[last]!.average} · EMA ${ema[last]!.average} · band mean ${bands[last]!.mean}`}
      </Text>
    </FocusManagement>
  );
}

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibblSync(canvas, <FinancialIndicatorsExample />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
