import { Circle, Group, Overlay, Text, pibbl, useLayoutBox, type PibblController } from "@pibbl/core";
import { Axis, LogScale, useLogScale } from "@pibbl/core/viz";
function Marks() {
  const scale = useLogScale("ratio").get();
  return <>
    <Axis scale="ratio" position="top" tickCount={4} labelOverlap="skip" />
    {[1, 10, 100, 1000].map(value => <Circle key={value} style={{ cx: scale.map(value), cy: 30, radius: 5, fill: "#087f8c" }} />)}
    <Text style={{ left: 0, top: 62, font: "12px sans-serif", fill: "#172f3d" }}>{`Midpoint = ${scale.invert((scale.range[0] + scale.range[1]) / 2).toFixed(2)}`}</Text>
  </>;
}
function Scene() {
  const { width } = useLayoutBox();
  return <>
    <Text style={{ left: 24, top: 24, font: "600 23px sans-serif", fill: "#172f3d", when: [{ query: { maxWidth: 380 }, style: { font: "600 18px sans-serif" } }] }}>Equal ratios, equal distances</Text>
    <Group style={{ translateX: 40, translateY: 100, when: [{ query: { maxHeight: 260 }, style: { translateY: 76 } }] }}>
      <Overlay style={{ width: Math.max(1, width - 80), height: 100 }}>
        <LogScale id="ratio" domain={[1, 1000]} range="width" style={{ width: "100%", height: "100%" }}><Marks /></LogScale>
      </Overlay>
    </Group>
  </>;
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Scene />, { viewport: "responsive" });
}
