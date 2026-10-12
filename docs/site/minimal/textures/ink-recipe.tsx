/** @jsxImportSource @pibbl/core */
import { pibbl, Rectangle } from "@pibbl/core";
import {
  reactionDiffusion,
  useTexture,
  type InkMessage,
  type ReactionDiffusionOptions,
} from "@pibbl/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

function Ink() {
  const options: ReactionDiffusionOptions = { seed: 12, preset: "stripes" };
  const texture = useTexture(reactionDiffusion(options), {
    resolution: { width: 128, height: 80 },
  });
  return (
    <Rectangle
      style={{ width: 320, height: 200, fill: texture }}
      onClick={(event) => {
        const paint: InkMessage = {
          type: "paint",
          u: event.x / 320,
          v: event.y / 200,
          radius: 8,
          strength: 0.9,
        };
        texture.send(paint);
      }}
    />
  );
}

const controller = pibbl(canvas, <Ink />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
