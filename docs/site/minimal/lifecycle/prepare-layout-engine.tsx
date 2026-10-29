import { Rectangle, pibbl, prepareLayoutEngine } from "@pibbl/core";

await prepareLayoutEngine();
const canvas = document.createElement("canvas");
canvas.width = 240;
canvas.height = 100;
document.body.append(canvas);
const controller = await pibbl(
  canvas,
  <Rectangle
    style={{ left: 20, top: 20, width: 200, height: 60, fill: "#087e8b" }}
  />,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
