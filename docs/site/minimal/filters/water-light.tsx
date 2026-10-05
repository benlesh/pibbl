import { crc, Group, Rectangle, Circle, useTexture } from "@crc/core";
import {
  displacement,
  reflectedLight,
  type CRCDisplacementFilterOptions,
  type CRCReflectedLightFilterOptions,
  type CRCReflectedLightSource,
} from "@crc/core/filters";
import { waterWaves } from "@crc/core/textures";

function Scene({
  mode,
}: {
  mode: "original" | "displacement" | "light" | "both";
}) {
  const waves = useTexture(waterWaves({ seed: 7, speed: 0.5 }));
  const map = waves.paint({ mode: "stretch" });
  const region = { x: 0, y: 0, width: 224, height: 156 };
  const refraction: CRCDisplacementFilterOptions = {
    map,
    region,
    strength: 12,
  };
  const lightColor: CRCReflectedLightSource = "#ffffff";
  const highlights: CRCReflectedLightFilterOptions = {
    map,
    region,
    source: lightColor,
    opacity: 0.65,
    direction: [-0.6, -0.8],
  };
  const filters =
    mode === "original"
      ? []
      : mode === "displacement"
        ? [displacement(refraction)]
        : mode === "light"
          ? [reflectedLight(highlights)]
          : [displacement(refraction), reflectedLight(highlights)];
  return (
    <Group style={{ filter: filters }}>
      <Rectangle style={{ width: 224, height: 156, fill: "#165165" }} />
      {Array.from({ length: 35 }, (_, i) => (
        <Rectangle
          key={i}
          style={{
            left: (i % 7) * 32 + 2,
            top: Math.floor(i / 7) * 32 + 2,
            width: 28,
            height: 28,
            fill: "#79bac5",
          }}
        />
      ))}
      <Circle
        style={{
          cx: 112,
          cy: 78,
          radius: 40,
          fill: "#e4b852",
          stroke: "#fff",
          strokeWidth: 4,
        }}
      />
    </Group>
  );
}
const grid = document.createElement("div");
grid.style.cssText =
  "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:480px";
document.body.append(grid);
const comparisons = [
  ["Original", "original"],
  ["Displacement", "displacement"],
  ["Reflected light", "light"],
  ["Both filters", "both"],
] as const;
const controllers = comparisons.map(([label, mode]) => {
  const figure = document.createElement("figure");
  figure.style.margin = "0";
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 156;
  figure.append(caption, canvas);
  grid.append(figure);
  return crc(canvas, <Scene mode={mode} />);
});
window.addEventListener(
  "pagehide",
  () => controllers.forEach((controller) => controller.dispose()),
  { once: true },
);
