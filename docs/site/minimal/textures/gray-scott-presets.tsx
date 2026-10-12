import {
  pibbl,
  Rectangle,
  Text,
  Group,
  useTexture,
  type TextureRecipe,
} from "@pibbl/core";
import {
  reactionDiffusion,
  grayScottPresets,
  type ReactionDiffusionPreset,
} from "@pibbl/core/textures";

const preset: ReactionDiffusionPreset = "coral";
const swatches = [
  {
    name: "Gray\u2013Scott coral",
    recipe: reactionDiffusion({
      ...grayScottPresets[preset],
      seed: 42,
      warmupSteps: 1600,
    }),
    named: false,
  },
];
function Swatch<Message>({
  recipe,
  name,
  index,
  named,
}: {
  recipe: TextureRecipe<Message>;
  name: string;
  index: number;
  named: boolean;
}) {
  const texture = useTexture(recipe, {
    resolution: { width: 224, height: 224 },
    palette: named ? undefined : ["#f5e9d3", "#304c48"],
  });
  return (
    <Group style={{ translateX: 16 + index * 240, translateY: 16 }}>
      <Text style={{ top: 0, font: "600 14px system-ui", fill: "#f5e9d3" }}>
        {name}
      </Text>
      <Rectangle
        style={{
          top: 30,
          width: 224,
          height: 224,
          fill: texture.paint({
            mode: "repeat",
            tileWidth: 112,
            tileHeight: 112,
          }),
        }}
      />
    </Group>
  );
}
function Scene() {
  return (
    <>
      <Rectangle style={{ width: 256, height: 288, fill: "#231f2b" }} />
      {swatches.map((swatch, index) => (
        <Swatch key={swatch.name} {...swatch} index={index} />
      ))}
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 256;
canvas.height = 288;
canvas.style.cssText = "display:block;max-width:100%;height:auto";
document.body.append(canvas);
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
