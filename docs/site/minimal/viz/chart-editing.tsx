import { Group, pibbl, signal } from "@pibbl/core";
import {
  EditableReferenceBand,
  EditableReferenceLine,
  EditableTrendLine,
  LinearScale,
  RangeNavigator,
  TradingTimeScale,
  type ChartAnchor,
  type EditableReferenceBandProps,
  type EditableReferenceBandStyle,
  type EditableReferenceLineProps,
  type EditableReferenceLineStyle,
  type EditableTrendLineProps,
  type EditableTrendLineStyle,
  type RangeNavigatorProps,
  type RangeNavigatorStyle,
} from "@pibbl/core/viz";

const windowValues = signal<readonly [number, number]>([1, 3]);
const level = signal(30);
const band = signal<readonly [number, number]>([40, 55]);
const anchors = signal<readonly [ChartAnchor, ChartAnchor]>([
  { x: 1_000, y: 20 },
  { x: 3_000, y: 60 },
]);
const navigatorStyle: RangeNavigatorStyle = { fill: "#2563eb", opacity: 0.2 };
const lineStyle: EditableReferenceLineStyle = {
  stroke: "#d97706",
  hitSize: 20,
};
const bandStyle: EditableReferenceBandStyle = {
  fill: "#16a34a",
  opacity: 0.18,
};
const trendStyle: EditableTrendLineStyle = { stroke: "#7c3aed", handleSize: 7 };
const navigator: RangeNavigatorProps = {
  scale: "overview",
  values: windowValues,
  span: [140, 170],
  minimumSpan: 1,
  onChange: windowValues.set,
  style: navigatorStyle,
};
const reference: EditableReferenceLineProps = {
  scale: "price",
  direction: "horizontal",
  value: level,
  span: [30, 370],
  keyboardStep: 1,
  onChange: level.set,
  style: lineStyle,
};
const referenceBand: EditableReferenceBandProps = {
  scale: "price",
  direction: "horizontal",
  values: band,
  span: [30, 370],
  keyboardStep: 1,
  onChange: band.set,
  style: bandStyle,
};
const trend: EditableTrendLineProps = {
  xScale: "time",
  yScale: "price",
  anchors,
  keyboardStep: { x: 1_000, y: 1 },
  onChange: anchors.set,
  style: trendStyle,
};
const canvas = document.createElement("canvas");
canvas.width = 400;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <Group>
    <TradingTimeScale
      id="time"
      timestamps={[1_000, 2_000, 3_000, 4_000]}
      range={[30, 370]}
    >
      <LinearScale id="price" domain={[0, 100]} range={[120, 20]}>
        <EditableReferenceBand {...referenceBand} />
        <EditableReferenceLine {...reference} />
        <EditableTrendLine {...trend} />
      </LinearScale>
    </TradingTimeScale>
    <LinearScale id="overview" domain={[0, 4]} range={[30, 370]}>
      <RangeNavigator {...navigator} />
    </LinearScale>
  </Group>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
