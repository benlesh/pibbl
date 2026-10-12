import {
  pibbl,
  Rectangle,
  Text,
  Group,
  useTexture,
  type TextureRecipe,
} from "@pibbl/core";
import {
  polkaDots,
  halftone,
  plaid,
  truchet,
  plaidPresets,
  type PolkaDotsOptions,
  type HalftoneOptions,
  type PlaidOptions,
  type PlaidBand,
  type TruchetOptions,
} from "@pibbl/core/textures";

const dots: PolkaDotsOptions = {
  columns: 12,
  rows: 12,
  stagger: 0.5,
  jitter: 0.1,
};
const tone: HalftoneOptions = { columns: 24, rows: 24, contrast: 0.9 };
const curves: TruchetOptions = {
  columns: 8,
  rows: 8,
  lineWidth: 0.12,
  seed: 42,
};
const colors = { paper: "#f5e9d3", ink: "#304c48", accent: "#c56948" };
const bands: readonly PlaidBand<keyof typeof colors>[] = [
  { width: 8, color: "paper" },
  { width: 2, color: "ink" },
  { width: 1, color: "accent" },
];
const cloth: PlaidOptions<typeof colors> = {
  ...plaidPresets.tartan,
  colors,
  horizontal: bands,
  vertical: bands,
};
const swatches = [
  { name: "Dots", recipe: polkaDots(dots), named: false },
  { name: "Halftone", recipe: halftone(tone), named: false },
  { name: "Plaid", recipe: plaid(cloth), named: true },
  { name: "Truchet", recipe: truchet(curves), named: false },
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
      <Rectangle style={{ width: 976, height: 288, fill: "#231f2b" }} />
      {swatches.map((swatch, index) => (
        <Swatch key={swatch.name} {...swatch} index={index} />
      ))}
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 976;
canvas.height = 288;
canvas.style.cssText = "display:block;max-width:100%;height:auto";
document.body.append(canvas);
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
