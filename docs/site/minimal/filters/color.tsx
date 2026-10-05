import { crc, Group, Circle, Rectangle, Text } from "@crc/core";
import {
  grayscale,
  hueRotate,
  invert,
  type CRCFilter,
  type CRCGrayscaleFilterOptions,
  type CRCHueRotateFilterOptions,
  type CRCInvertFilterOptions,
} from "@crc/core/filters";

const gray: CRCGrayscaleFilterOptions = { amount: 1 };
const hue: CRCHueRotateFilterOptions = { degrees: 150 };
const inversion: CRCInvertFilterOptions = { amount: 1 };
const comparisons: [string, CRCFilter | undefined][] = [
  ["Original", undefined],
  ["Grayscale 1", grayscale(gray)],
  ["Hue rotation 150 degrees", hueRotate(hue)],
  ["Invert 1", invert(inversion)],
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
        CRC
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
  return crc(
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
