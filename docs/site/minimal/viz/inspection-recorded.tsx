import { Group, Rectangle, Text, pibbl, useSignal } from "@pibbl/core";
import {
  LinearScale,
  LineSeries,
  PointSeries,
  defineSeries,
  linearInterpolation,
} from "@pibbl/core/viz";
import {
  anchorInsideClips,
  firstSourceObservation,
  lastSourceObservation,
  nearestRecordedPoint,
  nearestRecordedX,
  sampleRecordedX,
  useNumericInspection,
  usePointInspection,
  type InspectionCandidate,
  type NearestRecordedPointHit,
  type NearestRecordedPointOptions,
  type NearestRecordedXHit,
  type NearestRecordedXOptions,
  type NumericDomainInterpolation,
  type NumericDuplicateResolver,
  type NumericInspectionRef,
  type NumericRenderedAnchors,
  type NumericRenderedFilter,
  type NumericRenderedObservation,
  type NumericRenderedSeries,
  type PointInspectionRef,
  type PointRenderedSeries,
  type RecordedNumericHit,
  type RecordedXSample,
  type RenderedSeries,
  type RenderedSeriesPoint,
  type SampleRecordedXOptions,
} from "@pibbl/core/viz/inspection";

type Price = { time: number; price: number };
const data: readonly Price[] = [
  { time: 0, price: 10 },
  { time: 5, price: 15 },
  { time: 10, price: 12 },
];
const series = defineSeries({ data, x: "time", y: "price" });

function Chart() {
  const numeric: NumericInspectionRef<Price> = useNumericInspection(series);
  const points: PointInspectionRef<Price> = usePointInspection(series);
  const message = useSignal("Click the plot to inspect time 6.");
  const inspect = () => {
    const rendered: NumericRenderedSeries<Price> | undefined =
      numeric.rendered();
    const pointRendered: PointRenderedSeries<Price> | undefined =
      points.rendered();
    const alias: RenderedSeries<Price> | undefined = rendered;
    if (!alias) return;
    const candidateFilter: NumericRenderedFilter<Price> = (
      candidate: InspectionCandidate<Price>,
    ) => anchorInsideClips(candidate);
    const xOptions: NearestRecordedXOptions<Price> = {
      domainX: 6,
      filter: candidateFilter,
    };
    const nearest: NearestRecordedXHit<Price> | undefined = nearestRecordedX(
      alias,
      xOptions,
    );
    const rootPoint: RenderedSeriesPoint = { x: 170, y: 100 };
    const pointOptions: NearestRecordedPointOptions<Price> = { rootPoint };
    const nearestPoint: NearestRecordedPointHit<Price> | undefined =
      pointRendered && nearestRecordedPoint(pointRendered, pointOptions);
    const interpolation: NumericDomainInterpolation = linearInterpolation();
    const resolver: NumericDuplicateResolver<Price> = lastSourceObservation;
    const sampleOptions: SampleRecordedXOptions<Price> = {
      domainX: 6,
      interpolation,
      resolveDuplicate: resolver,
    };
    const sample: RecordedXSample<Price> | undefined = sampleRecordedX(
      alias,
      sampleOptions,
    );
    const observed: RecordedNumericHit<Price> | undefined = nearest;
    const row: NumericRenderedObservation<Price> | undefined =
      alias.observations[0];
    const anchors: NumericRenderedAnchors | undefined =
      row && alias.anchorAtDomain(row);
    const first =
      row && alias.observations[1]
        ? firstSourceObservation(row, alias.observations[1])
        : row;
    message.set(
      `Recorded ${observed?.datum.price ?? "none"}; estimate ${sample?.domainY ?? "none"}; point row ${nearestPoint?.sourceIndex ?? "none"}; anchor ${anchors?.anchorRoot.x ?? "none"}; first row ${first?.sourceIndex ?? "none"}`,
    );
  };
  return (
    <>
      <Group onClick={inspect}>
        <Rectangle style={{ width: 300, height: 170, fill: "#f5f8f5" }} />
        <LineSeries
          {...series}
          xScale="time"
          yScale="price"
          inspection={numeric}
          style={{ stroke: "#147b68" }}
        />
        <PointSeries
          {...series}
          xScale="time"
          yScale="price"
          inspection={points}
          style={{ radius: 6, fill: "#cf6b4c" }}
        />
      </Group>
      <Text
        pointerEvents="none"
        style={{ left: 8, top: 195, font: "12px sans-serif", fill: "#173a35" }}
      >
        {message.get()}
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
    <LinearScale id="price" domain={[0, 20]} range={[150, 20]}>
      <Chart />
    </LinearScale>
  </LinearScale>,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
