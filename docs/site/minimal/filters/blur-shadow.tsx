/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import {
  blur,
  dropShadow,
  type CRCBlurFilterOptions,
  type CRCDropShadowFilterOptions,
  type CRCFilter,
} from "@crc/core/filters";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

const softEdge: CRCBlurFilterOptions = { radius: 2 };
const shadow: CRCDropShadowFilterOptions = {
  offsetX: 8,
  offsetY: 10,
  blurRadius: 6,
  color: "#17211d88",
};
const effects: readonly CRCFilter[] = [blur(softEdge), dropShadow(shadow)];
const controller = crc(canvas, (
  <Rectangle style={{ left: 54, top: 45, width: 200, height: 100, fill: "#f7c948", filter: effects }} />
));
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
