import { pibbl } from "@pibbl/core";
import {
  BaselineSeries,
  LinearScale,
  type BaselineSeriesStyle,
} from "@pibbl/core/viz";
const prices = [
  { time: 0, close: 98 },
  { time: 1, close: 104 },
  { time: 2, close: null },
  { time: 3, close: 102 },
  { time: 4, close: 96 },
];
const style: BaselineSeriesStyle = {
  above: { fill: "teal", stroke: "teal" },
  below: { fill: "coral", stroke: "coral" },
  fillOpacity: 0.22,
};
export default function mount(canvas: HTMLCanvasElement) {
  return pibbl(
    canvas,
    <LinearScale id="time" domain={[0, 4]} range={[16, 300]}>
      <LinearScale id="price" domain={[94, 106]} range={[180, 16]}>
        <BaselineSeries
          data={prices}
          x="time"
          y="close"
          xScale="time"
          yScale="price"
          baseline={100}
          style={style}
        />
      </LinearScale>
    </LinearScale>,
  );
}
