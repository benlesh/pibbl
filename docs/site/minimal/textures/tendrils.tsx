/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import {
  tendrils,
  useTexture,
  type ElectricSource,
  type ElectricSourceMessage,
  type TendrilsMessage,
  type TendrilsOptions,
} from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 240;
document.body.append(canvas);

function Filaments() {
  const source: ElectricSource = { id: "electrode-a", point: { x: 0.25, y: 0.75 }, weight: 10 };
  const options: TendrilsOptions = { seed: 4, center: { x: 0.5, y: 0.5 }, sources: [source], count: 12, glow: 1.2 };
  const texture = useTexture(tendrils(options));
  const nextSource: ElectricSourceMessage = {
    type: "upsert-source",
    source: { id: "electrode-b", point: { x: 0.75, y: 0.7 }, weight: 15 },
  };
  const message: TendrilsMessage = nextSource;
  return <Rectangle style={{ width: 320, height: 240, fill: texture }} onClick={() => texture.send(message)} />;
}

const controller = crc(canvas, <Filaments />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
