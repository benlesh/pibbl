/** @jsxImportSource @pibbl/core */
import { pibbl } from "@pibbl/core";
import {
  ProceduralTexture,
  texturePalettes,
  type ProceduralTextureProps,
  type TextureKind,
  type TexturePalette,
  type TextureRenderFrame,
  type TextureRenderer,
  type TextureResolution,
} from "@pibbl/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

const kind: TextureKind = "marble";
const resolution: TextureResolution = { width: 320, height: 200 };
const palette: TexturePalette = texturePalettes.lagoon;
const render: TextureRenderer = (
  context,
  frame: Readonly<TextureRenderFrame>,
) => {
  context.drawImage(frame.source, 0, 0, frame.width, frame.height);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(frame.mask, 0, 0, frame.width, frame.height);
};
const props: ProceduralTextureProps = {
  kind,
  resolution,
  palette,
  seed: 42,
  scale: 2,
  detail: 0.3,
  render,
};
const controller = pibbl(
  canvas,
  <ProceduralTexture {...props} style={{ width: 320, height: 200 }} />,
);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
