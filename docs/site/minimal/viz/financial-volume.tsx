import { pibbl } from "@pibbl/core";
import {
  LinearScale,
  VolumeSeries,
  type VolumeSeriesProps,
  type VolumeSeriesStyle,
} from "@pibbl/core/viz";

type Volume = { time: number; volume: number };
const rows: readonly Volume[] = [
  { time: 0, volume: 18 },
  { time: 1, volume: 33 },
  { time: 2, volume: 0 },
  { time: 3, volume: 24 },
];
const props: VolumeSeriesProps<Volume> = {
  data: rows,
  time: "time",
  volume: "volume",
  xScale: "time",
  yScale: "volume",
};
const style: VolumeSeriesStyle = {
  fill: "#0f766e",
  stroke: "#134e4a",
  strokeWidth: 1,
};

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 180;
document.body.append(canvas);
const controller = pibbl(
  canvas,
  <LinearScale id="time" domain={[0, 3]} range={[30, 290]}>
    <LinearScale id="volume" domain={[0, 40]} range={[145, 20]} reverse>
      <VolumeSeries
        data={props.data}
        time={props.time}
        volume={props.volume}
        xScale={props.xScale}
        yScale={props.yScale}
        style={style}
      />
    </LinearScale>
  </LinearScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
