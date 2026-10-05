/** @jsxImportSource @crc/core */
import { crc, Rectangle, useTexture } from "@crc/core";
import {
  displacement,
  reflectedLight,
  type CRCDisplacementFilterOptions,
  type CRCReflectedLightFilterOptions,
  type CRCReflectedLightSource,
} from "@crc/core/filters";
import { waterWaves } from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas);

function Scene() {
  const waves = useTexture(waterWaves({ seed: 7, speed: 0.5 }));
  const map = waves.paint({ mode: "stretch" });
  const region = { x: 30, y: 25, width: 260, height: 150 };
  const refraction: CRCDisplacementFilterOptions = { map, region, strength: 8 };
  const lightColor: CRCReflectedLightSource = "#ffffff";
  const highlights: CRCReflectedLightFilterOptions = {
    map,
    region,
    source: lightColor,
    opacity: 0.3,
    direction: [-0.6, -0.8],
  };
  return <Rectangle style={{ ...region, fill: "#137b94", filter: [displacement(refraction), reflectedLight(highlights)] }} />;
}

const controller = crc(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
