/** @jsxImportSource @crc/core */
import { crc, Group, Text, type CRCController } from "@crc/core";
import {
  ReactionDiffusion,
  ProceduralTexture,
  texturePalettes,
  type TextureRenderer,
  type ReactionDiffusionProps,
  type ProceduralTextureProps,
  type TextureRenderFrame,
  type TextureKind,
  type TexturePalette,
  type TextureBrush,
  type TextureResolution,
} from "@crc/textures";
const resolution: TextureResolution = { width: 128, height: 80 };
const brush: TextureBrush = { radius: 6, strength: 0.8 };
const kind: TextureKind = "marble";
const palette: TexturePalette = texturePalettes.lagoon;
const renderer: TextureRenderer = (ctx, texture: TextureRenderFrame) => {
  ctx.fillStyle = ctx.createPattern(texture.source, "repeat")!;
  ctx.fillRect(0, 0, texture.width, texture.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(texture.mask, 0, 0, texture.width, texture.height);
};
const ink: ReactionDiffusionProps = {
  resolution,
  brush,
  palette,
  render: renderer,
  paused: true,
  resetRevision: 1,
};
const material: ProceduralTextureProps = {
  kind,
  seed: 42,
  scale: 6,
  detail: 0.5,
  render: renderer,
};
export function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    <Group>
      <ReactionDiffusion
        {...ink}
        pointerEvents="none"
        style={{ width: 400, height: 250 }}
      />
      <ProceduralTexture {...material} style={{ width: 400, height: 250 }} />
      <Text style={{ fill: "#000000" }}>Texture</Text>
    </Group>,
  );
}
// @ts-expect-error The package has a closed material vocabulary.
const bad = <ProceduralTexture kind="unknown" />;
// @ts-expect-error No public seek command or private solver is exposed.
import { InkSimulation } from "@crc/textures";
void bad;
void InkSimulation;
