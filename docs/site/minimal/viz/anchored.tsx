import { crc, Circle, Rectangle, Text } from "@crc/core";
import {
  AnchoredLayout,
  type AnchoredItem,
  type AnchoredLayoutProps,
  type AnchoredPlacement,
} from "@crc/core/viz";

interface Callout extends AnchoredItem {
  readonly label: string;
}
const items: readonly Callout[] = [
  {
    key: "first",
    label: "First",
    anchor: { x: 50, y: 90 },
    anchorRadius: 7,
    width: 90,
    height: 34,
  },
  {
    key: "second",
    label: "Second",
    anchor: { x: 170, y: 110 },
    anchorRadius: 7,
    width: 90,
    height: 34,
  },
];
const bounds: AnchoredPlacement = { x: 0, y: 0, width: 320, height: 220 };
const props: AnchoredLayoutProps<Callout> = {
  items,
  bounds,
  direction: "horizontal",
  gap: 8,
  children: (item) => (
    <>
      <Rectangle
        style={{ width: item.width, height: item.height, fill: "#0f766e" }}
      />
      <Text style={{ left: 8, top: 22, font: "12px sans-serif", fill: "#fff" }}>
        {item.label}
      </Text>
    </>
  ),
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = crc(
  canvas,
  <>
    {items.map((item) => (
      <Circle
        key={item.key}
        pointerEvents="none"
        style={{
          cx: item.anchor.x,
          cy: item.anchor.y,
          radius: item.anchorRadius ?? 6,
          fill: "#f97316",
        }}
      />
    ))}
    <AnchoredLayout {...props} />
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
