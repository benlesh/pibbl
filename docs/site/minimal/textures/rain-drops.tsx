/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import { displacement } from "@crc/core/filters";
import {
  rainDrops,
  useTexture,
  type RainDropsMessage,
  type RainDropsOptions,
} from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

function RainGlass() {
  const options: RainDropsOptions = { seed: 7, condensation: 0.8, rainRate: 20 };
  const rain = useTexture(rainDrops(options));
  const nudge: RainDropsMessage = { type: "nudge", x: 0.5, y: 0.5, dx: 0, dy: 0.1 };
  return <Rectangle
    style={{ width: 320, height: 200, fill: "#385d70", filter: displacement({ map: rain.paint({ mode: "stretch" }), strength: 16, blurRadius: 12, region: { x: 0, y: 0, width: 320, height: 200 } }) }}
    onClick={() => rain.send(nudge)}
  />;
}

const controller = crc(canvas, <RainGlass />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
