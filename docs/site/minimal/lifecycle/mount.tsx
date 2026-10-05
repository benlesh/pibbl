import { pibbl, Rectangle, type Canvas, type PibblController } from "@pibbl/core";

const canvas: Canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 180;
document.body.append(canvas);
const controller: PibblController = pibbl(
  canvas,
  <Rectangle
    style={{ left: 30, top: 30, width: 220, height: 100, fill: "#087e8b" }}
  />,
);
const update = document.createElement("button");
update.textContent = "Update root";
update.onclick = () => {
  pibbl(
    canvas,
    <Rectangle
      style={{ left: 60, top: 30, width: 220, height: 100, fill: "#b83970" }}
    />,
  );
};
const stop = document.createElement("button");
stop.textContent = "Dispose";
stop.onclick = () => {
  controller.dispose();
  update.disabled = true;
  stop.disabled = true;
};
document.body.append(update, stop);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
