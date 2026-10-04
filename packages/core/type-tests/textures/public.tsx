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
} from "@crc/core/textures";
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
import { InkSimulation } from "@crc/core/textures";
void bad;
void InkSimulation;

import { Rectangle, type Texture, type TextureRecipe } from "@crc/core";
import {
  tendrils,
  lightning,
  useTexture,
  type ElectricSource,
  type ElectricSourceMessage,
  type TendrilsMessage,
  type TendrilsOptions,
  type LightningMessage,
} from "@crc/core/textures";
const sites: readonly ElectricSource[] = [
  { id: "node-a", point: { x: 0.2, y: 0.3 }, weight: 1 },
  { id: "node-b", point: { x: 0.8, y: 0.7 }, weight: 4 },
];
const weighted: TendrilsOptions = {
  sources: sites,
  rise: 0.5,
  count: 12,
  crackle: 0.6,
};
const recipe: TextureRecipe<TendrilsMessage> = tendrils(weighted);
const message: ElectricSourceMessage = {
  type: "upsert-source",
  source: { id: "pointer:1", point: { x: 0.4, y: 0.6 }, weight: 20 },
};
export function WeightedFill() {
  const texture: Texture<TendrilsMessage> = useTexture(recipe, {
    resolution: { width: 256, height: 256 },
  });
  const arc: Texture<LightningMessage> = useTexture(
    lightning({ positive: sites[0].point, negative: sites[1].point }),
  );
  return (
    <Group>
      <Rectangle
        style={{ width: 256, height: 256, fill: texture }}
        onClick={() => texture.send(message)}
      />
      <Rectangle
        style={{
          width: 128,
          height: 128,
          fill: texture.paint({
            mode: "repeat",
            tileWidth: 128,
            tileHeight: 128,
          }),
        }}
      />
      <Rectangle style={{ width: 256, height: 128, fill: arc }} />
    </Group>
  );
}
const obsoleteCommand = {
  type: "attract",
  id: 1,
  point: { x: 0.5, y: 0.5 },
} as const;
// @ts-expect-error Pointer input is ordinary source data, not an attraction command.
const oldCommand: TendrilsMessage = obsoleteCommand;
// @ts-expect-error Boundary and interior locations are source data, not modes.
const oldOptions: TendrilsOptions = { termination: "perimeter" };
void oldCommand;
void oldOptions;

import { reactionDiffusion, type InkMessage } from "@crc/core/textures";
const stir: InkMessage = {
  type: "stir",
  u: 0.5,
  v: 0.5,
  du: 0.01,
  dv: -0.02,
  radius: 20,
};
export function StirredInkConsumer() {
  const texture = useTexture(reactionDiffusion({ preset: "stripes" }));
  return (
    <Rectangle
      style={{ width: 256, height: 128, fill: texture }}
      onClick={() => texture.send(stir)}
    />
  );
}
// @ts-expect-error Displacement requires both normalized vector components.
const incompleteStir: InkMessage = { type: "stir", u: 0.5, v: 0.5, du: 0.1 };
void incompleteStir;

import { rainDrops, type RainDropsMessage } from "@crc/core/textures";
import { displacement } from "@crc/core/filters";
export function RainGlassConsumer() {
  const rain = useTexture(rainDrops({ condensation: 0.8, trailPersistence: 20, irregularity: 1 }));
  const finger: RainDropsMessage = { type: "finger", x: 0.5, y: 0.5, radius: 0.05 };
  return <Group children={null} style={{ filter: displacement({ map: rain.paint({ mode: "stretch" }), strength: 18, blurRadius: 16, region: { x: 0, y: 0, width: 200, height: 100 } }) }} onPointerDown={() => rain.send(finger)} onPointerUp={() => rain.send({ type: "release" })} />;
}
