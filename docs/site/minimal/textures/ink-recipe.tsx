/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import {
  reactionDiffusion,
  useTexture,
  type InkMessage,
  type ReactionDiffusionOptions,
} from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

function Ink() {
  const options: ReactionDiffusionOptions = { seed: 12, preset: "stripes" };
  const texture = useTexture(reactionDiffusion(options), {
    resolution: { width: 128, height: 80 },
  });
  const paint: InkMessage = { type: "paint", u: 0.5, v: 0.5, radius: 8, strength: 0.9 };
  return <Rectangle style={{ width: 320, height: 200, fill: texture }} onClick={() => texture.send(paint)} />;
}

const controller = crc(canvas, <Ink />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
