import { pibbl } from "@pibbl/core";
import { LinearScale, TrajectorySeries, type TrajectorySeriesProps, type TrajectoryGroupAccessor, type TrajectorySeriesStyle } from "@pibbl/core/viz";
const records = [
  { id: "P01", week: 0, change: 0 },
  { id: "P02", week: 0, change: 0 },
  { id: "P01", week: 4, change: -10 },
  { id: "P02", week: 4, change: null },
  { id: "P01", week: 12, change: -18 },
  { id: "P02", week: 12, change: -8 },
];
const group: TrajectoryGroupAccessor<(typeof records)[number]> = "id";
const style: TrajectorySeriesStyle = { stroke: "#087f8c", strokeWidth: 2 };
const props: TrajectorySeriesProps<(typeof records)[number]> = { data: records, group, x: "week", y: "change", xScale: "visit", yScale: "outcome", style };
const canvas = document.createElement("canvas");
canvas.width = 400; canvas.height = 300;
document.body.append(canvas);
const app = pibbl(canvas,
  <LinearScale id="visit" domain={[0, 12]} range={[40, 360]}>
    <LinearScale id="outcome" domain={[-25, 5]} range={[260, 30]}>
      <TrajectorySeries {...props} />
    </LinearScale>
  </LinearScale>);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
