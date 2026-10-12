import { pibbl } from "@pibbl/core";
import { LinearScale, PairedSeries, type PairedSeriesProps, type PairedSeriesStyle } from "@pibbl/core/viz";
const records = [
  { id: "P01", before: 62, after: 44 },
  { id: "P02", before: 58, after: null },
  { id: "P03", before: 70, after: 63 },
];
const style: PairedSeriesStyle = { stroke: "#087f8c", strokeWidth: 2 };
const props: PairedSeriesProps<(typeof records)[number]> = { data: records, before: "before", after: "after", beforeX: 0, afterX: 12, xScale: "visit", yScale: "outcome", style };
const canvas = document.createElement("canvas");
canvas.width = 400; canvas.height = 300;
document.body.append(canvas);
const app = pibbl(canvas,
  <LinearScale id="visit" domain={[0, 12]} range={[40, 360]}>
    <LinearScale id="outcome" domain={[0, 100]} range={[260, 30]}>
      <PairedSeries {...props} />
    </LinearScale>
  </LinearScale>);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
