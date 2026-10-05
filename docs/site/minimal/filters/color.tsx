/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import {
  grayscale,
  hueRotate,
  invert,
  type CRCGrayscaleFilterOptions,
  type CRCHueRotateFilterOptions,
  type CRCInvertFilterOptions,
} from "@crc/core/filters";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

const gray: CRCGrayscaleFilterOptions = { amount: 0.35 };
const hue: CRCHueRotateFilterOptions = { degrees: 45 };
const inversion: CRCInvertFilterOptions = { amount: 0.1 };
const controller = crc(canvas, (
  <Rectangle style={{ left: 40, top: 35, width: 240, height: 130, fill: "#2665a8", filter: [grayscale(gray), hueRotate(hue), invert(inversion)] }} />
));
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
