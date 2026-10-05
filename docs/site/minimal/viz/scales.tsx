import { crc, Overlay } from "@crc/core";
import {
  Axis,
  Scale,
  useScale,
  type AxisProps,
  type AxisStyle,
  type BandCategory,
  type BandDomain,
  type BandScaleProps,
  type BandScaleRange,
  type LinearDomain,
  type LinearScaleProps,
  type ResolvedBandScale,
  type ResolvedLinearScale,
  type ResolvedScale,
  type ScaleId,
  type ScaleLayoutStyle,
  type ScaleProps,
  type ScaleRange,
} from "@crc/core/viz";

const xId: ScaleId = "month";
const yId: ScaleId = "sales";
const category: BandCategory = "Jun";
const months: BandDomain = ["Apr", "May", category];
const yDomain: LinearDomain = [0, 100];
const xRange: BandScaleRange = "width";
const yRange: ScaleRange = "height";
const layout: ScaleLayoutStyle = { width: 230, height: 170 };
const x: BandScaleProps = {
  id: xId,
  type: "band",
  domain: months,
  range: xRange,
  paddingInner: 0.15,
  style: layout,
};
const y: LinearScaleProps = {
  id: yId,
  type: "linear",
  domain: yDomain,
  range: yRange,
  reverse: true,
};
const scaleProps: ScaleProps = x;
const axisStyle: AxisStyle = { stroke: "#64748b", fill: "#334155" };
const axis: AxisProps = {
  scale: yId,
  position: "left",
  tickCount: 5,
  style: axisStyle,
};
function Probe() {
  const resolved: ResolvedScale = useScale(yId).get();
  const linear: ResolvedLinearScale = useScale(yId, "linear").get();
  const band: ResolvedBandScale = useScale(xId, "band").get();
  const count =
    resolved.type === "linear" ? linear.ticks(5).length : band.domain.length;
  return (
    <>
      {count > 0 && <Axis {...axis} />}
      <Axis scale={xId} position="bottom" tickValues={band.domain} />
    </>
  );
}

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = crc(
  canvas,
  <Overlay style={{ left: 70, top: 15, width: 230, height: 170 }}>
    <Scale {...scaleProps}>
      <Scale {...y}>
        <Probe />
      </Scale>
    </Scale>
  </Overlay>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
