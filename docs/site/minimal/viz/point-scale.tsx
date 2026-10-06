import { Circle, Group, Overlay, Text, pibbl } from "@pibbl/core";
import {
  Axis,
  PointScale,
  usePointScale,
  type PointScaleProps,
  type ResolvedPointScale,
} from "@pibbl/core/viz";

// Illustrative values, not a measured dataset.
const values = ["Draft", "Review", "Approved"];
const scaleProps: PointScaleProps = {
  id: "position",
  domain: ["Draft", "Review", "Approved"],
  range: "width",
  style: { width: 430, height: 60 },
  padding: 0.5,
};
function Marks() {
  const scale: ResolvedPointScale = usePointScale("position").get();
  return (
    <>
      <Axis
        scale="position"
        position="bottom"
        tickValues={values}
        tickFormat={(value) => String(value)}
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
      Checkpoints in a review
    </Text>
    <Text
      style={{ left: 20, top: 54, font: "13px sans-serif", fill: "#475569" }}
    >
      Categories have equal spacing, not numeric distance.
    </Text>
    <Group style={{ translateX: 65, translateY: 80 }}>
      <Overlay style={{ width: 430, height: 60 }}>
        <PointScale {...scaleProps}>
          <Marks />
        </PointScale>
      </Overlay>
    </Group>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
