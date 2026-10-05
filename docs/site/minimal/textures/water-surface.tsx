/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import { displacement } from "@crc/core/filters";
import {
  useTexture,
  waterSurface,
  type WaterSurfaceMessage,
  type WaterSurfaceObstacle,
  type WaterSurfaceOptions,
} from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

function Basin() {
  const island: WaterSurfaceObstacle = { x: 0.42, y: 0.35, width: 0.16, height: 0.3 };
  const options: WaterSurfaceOptions = { seed: 5, speed: 0.5, viscosity: 0.2, obstacles: [island] };
  const water = useTexture(waterSurface(options));
  const ripple: WaterSurfaceMessage = { type: "ripple", x: 0.25, y: 0.5 };
  return <Rectangle
    style={{ width: 320, height: 200, fill: "#63a8b7", filter: displacement({ map: water.paint({ mode: "stretch" }), strength: 10, region: { x: 0, y: 0, width: 320, height: 200 } }) }}
    onClick={() => water.send(ripple)}
  />;
}

const controller = crc(canvas, <Basin />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
