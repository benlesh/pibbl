/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import { displacement } from "@crc/core/filters";
import {
  useTexture,
  waterWaves,
  type WaterWavesMessage,
  type WaterWavesOptions,
} from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

function Waves() {
  const options: WaterWavesOptions = { seed: 7, speed: 0.6, rippleStrength: 1.2 };
  const water = useTexture(waterWaves(options));
  const ripple: WaterWavesMessage = { type: "ripple", x: 0.5, y: 0.5 };
  return <Rectangle
    style={{ width: 320, height: 200, fill: "#176e8a", filter: displacement({ map: water.paint({ mode: "stretch" }), strength: 12, region: { x: 0, y: 0, width: 320, height: 200 } }) }}
    onClick={() => water.send(ripple)}
  />;
}

const controller = crc(canvas, <Waves />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
