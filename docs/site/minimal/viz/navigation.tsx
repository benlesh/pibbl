import {
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type WritableSignal,
} from "@pibbl/core";
import {
  LineSeries,
  LinearScale,
  useLinearScale,
  panDomain,
  zoomDomain,
  type DomainNavigationConstraints,
  type PanDomainOptions,
  type ZoomDomainOptions,
  type LinearDomain,
} from "@pibbl/core/viz";
// NOAA/Scripps Mauna Loa Jan–Jun1980 CO2 ppm. x = zero-based month index.
// https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
const data = [337.9, 338.34, 340.07, 340.93, 341.45, 341.36].map(
  (ppm, month) => ({ month, ppm }),
);
function Plot({ domain }: { domain: WritableSignal<LinearDomain> }) {
  const scale = useLinearScale("month").get(),
    constraints: DomainNavigationConstraints = {
      bounds: [0, 5] as const,
      minimumSpanRatio: 0.2,
    };
  const pan: PanDomainOptions = { ...constraints, rangeDelta: -32 };
  const zoom: ZoomDomainOptions = {
    ...constraints,
    rangeAnchor: 160,
    factor: 1.5,
  };
  return (
    <>
      <LineSeries data={data} x="month" y="ppm" xScale="month" yScale="ppm" />
      <Rectangle
        onClick={() => domain.set(zoomDomain(scale, zoom))}
        style={{ top: 170, width: 140, height: 32, fill: "#d9e9ea" }}
      />
      <Text
        pointerEvents="none"
        style={{ top: 178, left: 8, font: "12px sans-serif" }}
      >
        Zoom in at center
      </Text>
      <Rectangle
        onClick={() => domain.set(panDomain(scale, pan))}
        style={{ top: 170, left: 160, width: 140, height: 32, fill: "#d9e9ea" }}
      />
      <Text
        pointerEvents="none"
        style={{ top: 178, left: 168, font: "12px sans-serif" }}
      >
        Pan right
      </Text>
    </>
  );
}
function Scene() {
  const domain = useSignal<LinearDomain>([0, 5]);
  return (
    <Group style={{ translateX: 20, translateY: 10 }}>
      <LinearScale id="month" domain={domain} range={[0, 300]}>
        <LinearScale id="ppm" domain={[337, 342]} range={[150, 0]}>
          <Plot domain={domain} />
        </LinearScale>
      </LinearScale>
      <Text style={{ top: 216, font: "9px sans-serif" }}>
        NOAA/Scripps · Jan–Jun1980 · ppm · month index
      </Text>
    </Group>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 240;
document.body.append(canvas);
const app = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
