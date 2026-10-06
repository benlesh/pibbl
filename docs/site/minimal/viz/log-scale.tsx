import { Circle, Group, Overlay, Text, pibbl } from "@pibbl/core";
import {
  Axis,
  LogScale,
  useLogScale,
  type LogScaleProps,
  type ResolvedLogScale,
} from "@pibbl/core/viz";

// Illustrative values, not a measured dataset.
const values = [1, 10, 100, 1000];
const scaleProps: LogScaleProps = {
  id: "position",
  domain: [1, 1000],
  range: "width",
  style: { width: 430, height: 60 },
  base: 10,
};
function Marks() {
  const scale: ResolvedLogScale = useLogScale("position").get();
  return (
    <>
      <Axis
        scale="position"
        position="bottom"
        tickValues={values}
        tickFormat={(value) => `${value} KB`}
      />
      {values.map((value) => (
        <Circle
          key={String(value)}
          style={{ radius: 5, cx: scale.map(value), cy: 30, fill: "#087f8c" }}
        />
      ))}
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 560;
canvas.height = 210;
canvas.style.cssText = "max-width:100%;height:auto";
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <Text
      style={{
        left: 20,
        top: 28,
        font: "600 18px sans-serif",
        fill: "#183153",
      }}
    >
      File sizes across orders of magnitude
    </Text>
    <Text
      style={{ left: 20, top: 54, font: "13px sans-serif", fill: "#475569" }}
    >
      Multiplying the size by ten moves the same distance.
    </Text>
    <Group style={{ translateX: 65, translateY: 80 }}>
      <Overlay style={{ width: 430, height: 60 }}>
        <LogScale {...scaleProps}>
          <Marks />
        </LogScale>
      </Overlay>
    </Group>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
