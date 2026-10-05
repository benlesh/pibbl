/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import {
  opacity,
  sepia,
  type CRCOpacityFilterOptions,
  type CRCSepiaFilterOptions,
} from "@crc/core/filters";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

const transparency: CRCOpacityFilterOptions = { amount: 0.8 };
const warmth: CRCSepiaFilterOptions = { amount: 0.7 };
const controller = crc(canvas, (
  <Rectangle style={{ left: 40, top: 35, width: 240, height: 130, fill: "#82a9c3", filter: [sepia(warmth), opacity(transparency)] }} />
));
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
