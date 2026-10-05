import { pibbl, Circle, Rectangle, Text } from "@pibbl/core";
import {
  closestPoint,
  defineSeries,
  HoverCard,
  HoverData,
  Scale,
  type HoverBounds,
  type HoverCardProps,
  type HoverCardStyle,
  type HoverDataProps,
  type HoverPlacement,
} from "@pibbl/core/viz";

const data = [{ x: 2, y: 3, label: "Peak" }];
const query = closestPoint({
  series: { series: defineSeries({ data, x: "x", y: "y" }) },
  position: { x: 160, y: 88 },
  xScale: "x",
  yScale: "y",
});
const bounds: HoverBounds = { x: 0, y: 0, width: 320, height: 220 };
const placement: HoverPlacement = "above";
const cardStyle: HoverCardStyle = {
  width: 96,
  height: 32,
  fill: "#ffffff",
  stroke: "#0f766e",
};
const hover: HoverDataProps<NonNullable<ReturnType<typeof query>>> = {
  query,
  children: (hit) => {
    if (!hit) return null;
    const card: HoverCardProps = {
      anchor: hit.anchor,
      bounds,
      placement,
      style: cardStyle,
      children: (
        <Text
          style={{ left: 8, top: 20, font: "12px sans-serif", fill: "#111827" }}
        >
          {hit.datum.label}
        </Text>
      ),
    };
    return (
      <>
        <Circle
          style={{
            cx: hit.anchor.x,
            cy: hit.anchor.y,
            radius: 5,
            fill: "#f97316",
          }}
        />
        <HoverCard {...card} />
      </>
    );
  },
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(
  canvas,
  <>
    <Rectangle style={{ width: 320, height: 220, fill: "#f8fafc" }} />
    <Scale
      id="x"
      type="linear"
      domain={[0, 4]}
      range="width"
      style={{ width: 320, height: 220 }}
    >
      <Scale id="y" type="linear" domain={[0, 6]} range="height" reverse>
        <HoverData {...hover} />
      </Scale>
    </Scale>
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
