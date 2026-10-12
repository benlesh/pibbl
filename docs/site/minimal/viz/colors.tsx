import { Rectangle, Text, pibbl } from "@pibbl/core";
import {
  SequentialColorScale,
  DivergingColorScale,
  ThresholdColorScale,
  useSequentialColorScale,
  useDivergingColorScale,
  useThresholdColorScale,
  type SequentialColorScaleProps,
  type DivergingColorScaleProps,
  type ThresholdColorScaleProps,
  type ResolvedSequentialColorScale,
  type ResolvedDivergingColorScale,
  type ResolvedThresholdColorScale,
  type ColorScaleStop,
  type ThresholdColorBand,
} from "@pibbl/core/viz";
// NOAA/Scripps Mauna Loa Jan–Mar 1980, monthly CO2 means in ppm.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
const values = [337.9, 338.34, 340.07];
function Row({
  map,
  y,
  label,
}: {
  map: (value: number) => string;
  y: number;
  label: string;
}) {
  return (
    <>
      {values.map((v, i) => (
        <Rectangle
          key={i}
          style={{
            left: 14 + i * 95,
            top: y,
            width: 90,
            height: 24,
            fill: map(v),
          }}
        />
      ))}
      <Text style={{ left: 14, top: y + 30, font: "11px sans-serif" }}>
        {label}
      </Text>
    </>
  );
}
function Sequential() {
  const scale: ResolvedSequentialColorScale =
    useSequentialColorScale("color").get();
  const stops: readonly ColorScaleStop[] = scale.stops;
  return (
    <Row
      map={scale.map}
      y={10}
      label={`Sequential: ${stops[0].value}–${stops[1].value} ppm`}
    />
  );
}
function Diverging() {
  const scale: ResolvedDivergingColorScale =
    useDivergingColorScale("color").get();
  return <Row map={scale.map} y={70} label="Diverging: 336 / 340 / 342 ppm" />;
}
function Threshold() {
  const scale: ResolvedThresholdColorScale =
    useThresholdColorScale("color").get();
  const bands: readonly ThresholdColorBand[] = scale.bands;
  return (
    <Row
      map={scale.map}
      y={130}
      label={`Threshold: <${bands[0].upper} / ${bands[1].lower}–<${bands[1].upper} / ≥${bands[2].lower} ppm`}
    />
  );
}
const sequential: SequentialColorScaleProps = {
  id: "color",
  domain: [336, 342],
  colors: ["#e5f0ed", "#12575a"],
};
const diverging: DivergingColorScaleProps = {
  id: "color",
  domain: [336, 340, 342],
  colors: ["#245c88", "#f5f1dd", "#b64c32"],
};
const threshold: ThresholdColorScaleProps = {
  id: "color",
  thresholds: [338, 340],
  colors: ["#245c88", "#e7bd66", "#b64c32"],
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <SequentialColorScale {...sequential}>
      <Sequential />
    </SequentialColorScale>
    <DivergingColorScale {...diverging}>
      <Diverging />
    </DivergingColorScale>
    <ThresholdColorScale {...threshold}>
      <Threshold />
    </ThresholdColorScale>
    <Text style={{ left: 14, top: 195, font: "10px sans-serif" }}>
      NOAA/Scripps · Jan–Mar 1980 · ppm
    </Text>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
