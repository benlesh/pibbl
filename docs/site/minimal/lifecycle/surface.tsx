import {
  crc,
  Rectangle,
  Text,
  type CRCConfig,
  type CRCFit,
  type CRCPixelRatio,
  type CRCFixedViewportConfig,
  type CRCResponsiveViewportConfig,
} from "@crc/core";

const fit: CRCFit = "contain";
const pixelRatio: CRCPixelRatio = "device";
const fixed: CRCFixedViewportConfig = {
  viewport: { width: 320, height: 160 },
  fit,
  pixelRatio,
};
const responsive: CRCResponsiveViewportConfig = {
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
      A sized CRC surface
    </Text>
  </>
);
let config: CRCConfig = fixed;
let controller = crc(canvas, scene, config);
const button = document.createElement("button");
button.textContent = "Use responsive viewport";
button.onclick = () => {
  controller.dispose();
  config = config === fixed ? responsive : fixed;
  controller = crc(canvas, scene, config);
  button.textContent =
    config === fixed ? "Use responsive viewport" : "Use fixed viewport";
};
document.body.append(button);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
