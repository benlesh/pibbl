import { pibbl, Overlay } from "@pibbl/core";
import {
  Axis,
  BarSeries,
  Scale,
  type BarCategoryAccessor,
  type BarSeriesProps,
  type BarSeriesStyle,
  type BarStyleResolver,
  type BarThresholdFill,
} from "@pibbl/core/viz";

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
const app = pibbl(
  canvas,
  <Overlay style={{ left: 70, top: 15, width: 230, height: 170 }}>
    <Scale
      id="month"
      type="band"
      domain={sales.map((sale) => sale.month)}
      range="width"
      paddingInner={0.2}
      style={{ width: 230, height: 170 }}
    >
      <Scale id="amount" type="linear" domain={[0, 80]} range="height" reverse>
        <BarSeries {...bars} />
        <Axis scale="amount" position="left" tickValues={[0, 20, 40, 60, 80]} />
        <Axis
          scale="month"
          position="bottom"
          tickValues={sales.map((sale) => sale.month)}
        />
      </Scale>
    </Scale>
  </Overlay>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
