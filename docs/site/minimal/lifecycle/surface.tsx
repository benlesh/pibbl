import {
  pibbl,
  Rectangle,
  Text,
  type PibblConfig,
  type PibblFit,
  type PibblPixelRatio,
  type PibblFixedViewportConfig,
  type PibblResponsiveViewportConfig,
} from "@pibbl/core";

const fit: PibblFit = "contain";
const pixelRatio: PibblPixelRatio = "device";
const fixed: PibblFixedViewportConfig = {
  viewport: { width: 320, height: 160 },
  fit,
  pixelRatio,
};
const responsive: PibblResponsiveViewportConfig = {
  viewport: "responsive",
  pixelRatio,
};
const canvas = document.createElement("canvas");
canvas.style.cssText = "display:block;width:100%;height:180px";
const host = document.createElement("div");
host.style.cssText =
  "width:360px;max-width:100%;resize:horizontal;overflow:auto";
host.append(canvas);
document.body.append(host);
const scene = (
  <>
    <Rectangle style={{ width: "100%", height: "100%", fill: "#e5f2ef" }} />
    <Text
      style={{ left: 20, top: 70, font: "24px sans-serif", fill: "#087e8b" }}
    >
      A sized Pibbl surface
    </Text>
  </>
);
let config: PibblConfig = fixed;
let controller = pibbl(canvas, scene, config);
const button = document.createElement("button");
button.textContent = "Use responsive viewport";
button.onclick = () => {
  controller.dispose();
  config = config === fixed ? responsive : fixed;
  controller = pibbl(canvas, scene, config);
  button.textContent =
    config === fixed ? "Use responsive viewport" : "Use fixed viewport";
};
document.body.append(button);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
