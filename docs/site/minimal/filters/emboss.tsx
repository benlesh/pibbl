import { pibbl, Group, Rectangle, Text, useTexture } from "@pibbl/core";
import { emboss, type PibblEmbossFilterOptions } from "@pibbl/core/filters";
import { plainWeave } from "@pibbl/core/textures";
function Scene() {
  const height = useTexture(
    plainWeave({ threads: 24, relief: 0.8, fuzz: 0.5 }),
    {
      resolution: { width: 256, height: 256 },
      palette: ["#000000", "#ffffff"],
    },
  );
  const options: PibblEmbossFilterOptions = {
    region: { x: 0, y: 0, width: 224, height: 224 },
    depth: 3,
    strength: 0.8,
    direction: [-0.6, -0.8],
  };
  return (
    <>
      <Rectangle style={{ width: 496, height: 288, fill: "#231f2b" }} />
      <Text
        style={{
          left: 16,
          top: 16,
          font: "600 14px system-ui",
          fill: "#f5e9d3",
        }}
      >
        Flat paint
      </Text>
      <Text
        style={{
          left: 256,
          top: 16,
          font: "600 14px system-ui",
          fill: "#f5e9d3",
        }}
      >
        Embossed weave
      </Text>
      <Rectangle
        style={{ left: 16, top: 46, width: 224, height: 224, fill: "#c56948" }}
      />
      <Group style={{ translateX: 256, translateY: 46 }}>
        <Rectangle
          style={{
            width: 224,
            height: 224,
            fill: "#c56948",
            filter: emboss(
              height.paint({ mode: "repeat", tileWidth: 112, tileHeight: 112 }),
              options,
            ),
          }}
        />
      </Group>
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 496;
canvas.height = 288;
canvas.style.cssText = "display:block;max-width:100%;height:auto";
document.body.append(canvas);
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
