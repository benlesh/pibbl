import { crc } from "@crc/core";
import {
  Axis,
  BarSeries,
  Scale,
  type BarCategoryAccessor,
  type BarSeriesProps,
  type BarSeriesStyle,
  type BarStyleResolver,
  type BarThresholdFill,
} from "@crc/core/viz";

type Sale = { month: string; amount: number };
const sales: readonly Sale[] = [
  { month: "Apr", amount: 28 },
  { month: "May", amount: 52 },
  { month: "Jun", amount: 74 },
];
const category: BarCategoryAccessor<Sale> = "month";
const fill: BarThresholdFill = {
  type: "threshold",
  thresholds: [50],
  colors: ["#0f766e", "#f97316"],
};
const baseStyle: BarSeriesStyle = { fill, bandwidth: "auto" };
const style: BarStyleResolver<Sale> = (datum) => ({
  ...baseStyle,
  opacity: datum.amount < 30 ? 0.65 : 1,
});
const bars: BarSeriesProps<Sale> = {
  data: sales,
  category,
  value: "amount",
  categoryScale: "month",
  valueScale: "amount",
  style,
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = crc(
  canvas,
  <Scale
    id="month"
    type="band"
    domain={sales.map((sale) => sale.month)}
    range="width"
    paddingInner={0.2}
    style={{ width: 320, height: 220 }}
  >
    <Scale id="amount" type="linear" domain={[0, 80]} range="height" reverse>
      <BarSeries {...bars} />
      <Axis scale="amount" position="left" tickCount={4} />
    </Scale>
  </Scale>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
