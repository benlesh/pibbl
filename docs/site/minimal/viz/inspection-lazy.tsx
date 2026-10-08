import {
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblLogicalMouseEvent,
} from "@pibbl/core";
import { LinearScale, PointSeries, defineSeries } from "@pibbl/core/viz";
import {
  nearestRecordedX,
  usePointInspection,
  withInspection,
  type InspectionContext,
  type InspectionRef,
  type NumericRenderedSeries,
} from "@pibbl/core/viz/inspection";

type Reading = { time: number; price: number };
const series = defineSeries({
  data: [
    { time: 0, price: 10 },
    { time: 10, price: 30 },
  ] satisfies readonly Reading[],
  x: "time",
  y: "price",
});
function Chart() {
  const inspection = usePointInspection(series);
  const readout = useSignal("Click the plot.");
  const inspect = withInspection(
    (event: PibblLogicalMouseEvent, context: InspectionContext) => {
      const ref: InspectionRef<NumericRenderedSeries<Reading>> = inspection;
      const rendered = context.rendered(ref);
      if (!rendered) return;
      const options = {
        domainX: rendered.domainXAtRoot({ x: event.x, y: event.y }),
      };
      const first = context.request(nearestRecordedX, rendered, options);
      const repeated = context.request(nearestRecordedX, rendered, {
        ...options,
      });
      readout.set(
        `Price ${first?.datum.price ?? "none"}; memoized ${first === repeated}.`,
      );
    },
  );
  return (
    <>
      <Group onClick={inspect}>
        <Rectangle style={{ width: 300, height: 170, fill: "#edf5f2" }} />
        <PointSeries
          {...series}
          xScale="time"
          yScale="price"
          inspection={inspection}
          style={{ radius: 7, fill: "#087f8c" }}
        />
      </Group>
      <Text
        pointerEvents="none"
        style={{ left: 8, top: 195, font: "12px sans-serif", fill: "#173a35" }}
      >
        {readout.get()}
      </Text>
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 230;
document.body.append(canvas);
const controller = pibbl(
  canvas,
  <LinearScale id="time" domain={[0, 10]} range={[30, 280]}>
    <LinearScale id="price" domain={[0, 40]} range={[150, 20]}>
      <Chart />
    </LinearScale>
  </LinearScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
