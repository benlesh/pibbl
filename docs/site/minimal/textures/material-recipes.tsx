import { pibbl, Rectangle } from "@pibbl/core";
import {
  cellular,
  marble,
  paper,
  useTexture,
  type MaterialOptions,
} from "@pibbl/core/textures";

const materials = [
  {
    name: "Marble",
    recipe: marble,
    scale: 2,
    palette: ["#eef3f1", "#83a9ae", "#224c5a"],
  },
  {
    name: "Paper",
    recipe: paper,
    scale: 6,
    palette: ["#fafaf7", "#d0d4cf", "#9aa39e"],
  },
  {
    name: "Cellular",
    recipe: cellular,
    scale: 4,
    palette: ["#101b29", "#24657d", "#6cd0d5"],
  },
];
function Material({ index }: { index: number }) {
  const material = materials[index]!;
  const options: MaterialOptions = {
    seed: 42,
    scale: material.scale,
    detail: 0.55,
  };
  const texture = useTexture(material.recipe(options), {
    resolution: { width: 224, height: 156 },
    palette: material.palette,
  });
  return (
    <Rectangle
      style={{
        width: 224,
        height: 156,
        fill: texture.paint({ mode: "stretch" }),
      }}
    />
  );
}
const grid = document.createElement("div");
grid.style.cssText =
  "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:480px";
document.body.append(grid);
const controllers = materials.map((material, index) => {
  const figure = document.createElement("figure");
  figure.style.margin = "0";
  const caption = document.createElement("figcaption");
  caption.textContent = material.name;
  const canvas = document.createElement("canvas");
  canvas.width = 224;
  canvas.height = 156;
  figure.append(caption, canvas);
  grid.append(figure);
  return pibbl(canvas, <Material index={index} />);
});
window.addEventListener(
  "pagehide",
  () => controllers.forEach((controller) => controller.dispose()),
  { once: true },
);
