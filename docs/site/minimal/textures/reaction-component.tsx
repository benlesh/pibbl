/** @jsxImportSource @crc/core */
import { crc } from "@crc/core";
import {
  ReactionDiffusion,
  texturePalettes,
  type ReactionDiffusionProps,
  type TextureBrush,
} from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

const brush: TextureBrush = { radius: 6, strength: 0.8 };
const props: ReactionDiffusionProps = {
  seed: 7,
  preset: "spots",
  palette: texturePalettes.ember,
  resolution: { width: 128, height: 80 },
  brush,
};
const controller = crc(canvas, <ReactionDiffusion {...props} style={{ width: 320, height: 200 }} />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
