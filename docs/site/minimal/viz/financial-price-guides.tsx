import { Text, pibbl } from "@pibbl/core";
import { LinearScale, ReferenceLine, ScaleAdjust, formatNumber } from "@pibbl/core/viz";
const last = 104.35, previous = 102.2;
const price = (value: number) => formatNumber(value, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 190; document.body.append(canvas);
const controller = pibbl(canvas, <LinearScale id="price" domain={[98, 108]} range={[165, 25]}>
  <Text style={{ left: 20, top: 8, font: "12px sans-serif", fill: "#18283d" }}>Data-anchored price guides</Text>
  <ReferenceLine scale="price" direction="horizontal" value={previous} span={[20, 240]} style={{ stroke: "#8092aa" }} />
  <ReferenceLine scale="price" direction="horizontal" value={last} span={[20, 240]} style={{ stroke: "#00876e", strokeWidth: 2 }} />
  <ScaleAdjust yScale="price" y={last}><Text style={{ left: 248, top: -6, font: "11px monospace", fill: "#00876e" }}>{price(last)}</Text></ScaleAdjust>
</LinearScale>);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
