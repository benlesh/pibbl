/** @jsxImportSource @pibbl/core */
import { pibbl, Rectangle } from "@pibbl/core";
import {
  lightning,
  useTexture,
  type ElectricControl,
  type ElectricOptions,
  type ElectricPoint,
  type LightningMessage,
  type LightningOptions,
} from "@pibbl/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

function Arc() {
  const positive: ElectricPoint = { x: 0.2, y: 0.5 };
  const negative: ElectricPoint = { x: 0.8, y: 0.5 };
  const appearance: ElectricOptions = { seed: 9, branching: 0.6, glow: 1.2 };
  const options: LightningOptions = {
    ...appearance,
    positive,
    negative,
    frequency: 15,
    contactCore: true,
  };
  const texture = useTexture(lightning(options));
  const reset: ElectricControl = { type: "reset", seed: 9 };
  const message: LightningMessage = reset;
  return (
    <>
      <Rectangle style={{ width: 320, height: 200, fill: "#11151c" }} />
      <Rectangle
        style={{ width: 320, height: 200, fill: texture }}
        onClick={() => texture.send(message)}
      />
    </>
  );
}

const controller = pibbl(canvas, <Arc />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
