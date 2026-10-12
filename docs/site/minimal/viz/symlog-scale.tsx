import { Circle, Group, Overlay, Text, pibbl } from "@pibbl/core";
import {
  Axis,
  SymlogScale,
  useSymlogScale,
  type SymlogScaleProps,
  type ResolvedSymlogScale,
} from "@pibbl/core/viz";

// Illustrative values, not a measured dataset.
const values = [-100, -10, 0, 10, 100];
const scaleProps: SymlogScaleProps = {
  id: "position",
  domain: [-100, 100],
  range: "width",
  style: { width: 430, height: 60 },
  constant: 10,
};
function Marks() {
  const scale: ResolvedSymlogScale = useSymlogScale("position").get();
  return (
    <>
      <Axis
        scale="position"
        position="bottom"
        tickValues={values}
        tickFormat={(value) => `${Number(value) > 0 ? "+" : ""}${value}`}
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
      Daily inventory changes
    </Text>
    <Text
      style={{ left: 20, top: 54, font: "13px sans-serif", fill: "#475569" }}
    >
      Negative means shipped; positive means received.
    </Text>
    <Group style={{ translateX: 65, translateY: 80 }}>
      <Overlay style={{ width: 430, height: 60 }}>
        <SymlogScale {...scaleProps}>
          <Marks />
        </SymlogScale>
      </Overlay>
    </Group>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
