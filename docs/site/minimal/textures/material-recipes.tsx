/** @jsxImportSource @crc/core */
import { crc, Rectangle } from "@crc/core";
import {
  cellular,
  marble,
  paper,
  useTexture,
  type MaterialOptions,
} from "@crc/core/textures";

const canvas = document.createElement("canvas");
canvas.width = 330;
canvas.height = 130;
document.body.append(canvas);

function Materials() {
  const options: MaterialOptions = { seed: 42, scale: 6, detail: 0.65 };
  const stone = useTexture(marble(options));
  const sheet = useTexture(paper(options));
  const cells = useTexture(cellular(options));
  return [
    <Rectangle key="stone" style={{ left: 0, top: 0, width: 110, height: 130, fill: stone }} />,
    <Rectangle key="sheet" style={{ left: 110, top: 0, width: 110, height: 130, fill: sheet }} />,
    <Rectangle key="cells" style={{ left: 220, top: 0, width: 110, height: 130, fill: cells }} />,
  ];
}

const controller = crc(canvas, <Materials />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
