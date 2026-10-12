import {
  pibbl,
  Rectangle,
  Text,
  Group,
  useTexture,
  type TextureRecipe,
} from "@pibbl/core";
import {
  stripes,
  checkers,
  woodGrain,
  type StripesOptions,
  type CheckersOptions,
  type WoodGrainOptions,
  type PatternMotionOptions,
} from "@pibbl/core/textures";

const motion: PatternMotionOptions = { phase: 0, speed: 0 };
const stripeOptions: StripesOptions = {
  ...motion,
  bands: 8,
  dutyCycle: 0.4,
  wave: 0.06,
};
const checkerOptions: CheckersOptions = { ...motion, columns: 8, rows: 8 };
const woodOptions: WoodGrainOptions = {
  ...motion,
  seed: 42,
  grain: 24,
  distortion: 0.6,
  knots: 2,
};
const swatches = [
  { name: "Stripes", recipe: stripes(stripeOptions), named: false },
  { name: "Checkers", recipe: checkers(checkerOptions), named: false },
  { name: "Wood grain", recipe: woodGrain(woodOptions), named: false },
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
      <Rectangle style={{ width: 736, height: 288, fill: "#231f2b" }} />
      {swatches.map((swatch, index) => (
        <Swatch key={swatch.name} {...swatch} index={index} />
      ))}
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 736;
canvas.height = 288;
canvas.style.cssText = "display:block;max-width:100%;height:auto";
document.body.append(canvas);
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
