import { pibbl } from "@pibbl/core";
import {
  LinearScale,
  VolumeSeries,
  type VolumeSeriesProps,
} from "@pibbl/core/viz";
import {
  nearestRecordedVolumeX,
  paintedVolumeAt,
  useVolumeInspection,
  type NearestVolumeHit,
  type PaintedVolumeHit,
  type VolumeInspectionCandidate,
  type VolumeInspectionRef,
  type VolumeObservation,
  type VolumeRenderedSeries,
} from "@pibbl/core/viz/inspection";

type Volume = { time: number; volume: number };
const inputs: Pick<VolumeSeriesProps<Volume>, "data" | "time" | "volume"> = {
  data: [
    { time: 0, volume: 12 },
    { time: 1, volume: 28 },
    { time: 2, volume: 20 },
  ],
  time: "time",
  volume: "volume",
};
let inspection: VolumeInspectionRef<Volume> | undefined;
const result = document.createElement("p");
const button = document.createElement("button");
button.textContent = "Inspect time 1";
const insideCommittedClips = (
  candidate: VolumeInspectionCandidate<Volume>,
): boolean => candidate.anchorInsideClips();
button.onclick = () => {
  const rendered: VolumeRenderedSeries<Volume> | undefined =
    inspection?.rendered();
  if (!rendered) return;
  const nearest: NearestVolumeHit<Volume> | undefined = nearestRecordedVolumeX(
    rendered,
    {
      time: 1,
      filter: insideCommittedClips,
    },
  );
  const painted: PaintedVolumeHit<Volume> | undefined = paintedVolumeAt(
    rendered,
    {
      rootPoint: nearest?.anchorRoot ?? { x: 0, y: 0 },
    },
  );
  const observed: VolumeObservation<Volume> | undefined = nearest;
  result.textContent = `Nearest ${observed?.volume ?? "none"}; painted ${painted?.volume ?? "none"}.`;
};

function Chart() {
  inspection = useVolumeInspection(inputs);
  return (
    <VolumeSeries
      data={inputs.data}
      time={inputs.time}
      volume={inputs.volume}
      xScale="time"
      yScale="volume"
      inspection={inspection}
      style={{ fill: "#0f766e" }}
    />
  );
}

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 180;
document.body.append(canvas, button, result);
const controller = pibbl(
  canvas,
  <LinearScale id="time" domain={[0, 2]} range={[30, 290]}>
    <LinearScale id="volume" domain={[0, 30]} range={[145, 20]} reverse>
      <Chart />
    </LinearScale>
  </LinearScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
