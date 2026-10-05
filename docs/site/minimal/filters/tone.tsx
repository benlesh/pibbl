/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import {
  brightness,
  contrast,
  saturate,
  type CRCBrightnessFilterOptions,
  type CRCContrastFilterOptions,
  type CRCSaturateFilterOptions,
} from "@crc/core/filters";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

const light: CRCBrightnessFilterOptions = { amount: 1.25 };
const depth: CRCContrastFilterOptions = { amount: 1.15 };
const color: CRCSaturateFilterOptions = { amount: 1.4 };
const controller = crc(canvas, (
  <Rectangle style={{ left: 40, top: 35, width: 240, height: 130, fill: "#cc7057", filter: [brightness(light), contrast(depth), saturate(color)] }} />
));
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
