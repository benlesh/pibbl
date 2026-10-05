import { pibbl, Group, Circle, Rectangle, Text } from "@pibbl/core";
import {
  opacity,
  sepia,
  type PibblFilter,
  type PibblOpacityFilterOptions,
  type PibblSepiaFilterOptions,
} from "@pibbl/core/filters";

const transparency: PibblOpacityFilterOptions = { amount: 0.4 };
const warmth: PibblSepiaFilterOptions = { amount: 1 };
const comparisons: [string, PibblFilter | undefined][] = [
  ["Original", undefined],
  ["Opacity 0.4", opacity(transparency)],
  ["Sepia 1", sepia(warmth)],
];
function Subject() {
  return (
    <>
      <Rectangle
        style={{ left: 22, top: 30, width: 60, height: 92, fill: "#277e99" }}
      />
      <Rectangle
        style={{ left: 82, top: 30, width: 60, height: 92, fill: "#dc7764" }}
      />
      <Rectangle
        style={{ left: 142, top: 30, width: 60, height: 92, fill: "#ddb84f" }}
      />
      <Circle style={{ cx: 112, cy: 73, radius: 32, fill: "#23333a" }} />
      <Text
        style={{
          left: 112,
          top: 82,
          textAlign: "center",
          font: "bold 23px sans-serif",
          fill: "#fff",
        }}
      >
        Pibbl
      </Text>
    </>
  );
}
const grid = document.createElement("div");
grid.style.cssText =
  "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:480px";
document.body.append(grid);
const controllers = comparisons.map(([label, filter]) => {
  const figure = document.createElement("figure");
  figure.style.margin = "0";
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 156;
  figure.append(caption, canvas);
  grid.append(figure);
  return pibbl(
    canvas,
    <>
      <Rectangle style={{ width: 224, height: 156, fill: "#f1f4f5" }} />
      {Array.from({ length: 70 }, (_, i) => (
        <Rectangle
          key={i}
          style={{
            left: (i % 10) * 24,
            top: Math.floor(i / 10) * 24,
            width: 24,
            height: 24,
            fill: (i + Math.floor(i / 10)) % 2 ? "#e0e6e9" : "#f1f4f5",
          }}
        />
      ))}
      <Group style={{ filter }}>
        <Subject />
      </Group>
    </>,
  );
});
window.addEventListener(
  "pagehide",
  () => controllers.forEach((controller) => controller.dispose()),
  { once: true },
);
