import {
  type SpriteRectangle,
  type SpriteFrameData,
  type SpriteAnimationFrameData,
  type SpriteSheetData,
  type SpriteSheetFormat,
} from "@pibbl/core/sprites";
import { aseprite } from "@pibbl/core/sprites/formats/aseprite";
import { texturePacker } from "@pibbl/core/sprites/formats/texture-packer";
const rect: SpriteRectangle = { x: 0, y: 0, width: 16, height: 16 };
const frame: SpriteFrameData = { name: "idle", rect };
const step: SpriteAnimationFrameData = { frame: frame.name, duration: 120 };
const normalized: SpriteSheetData = {
  images: ["atlas.png"],
  frames: [frame],
  animations: { idle: [step] },
};
const custom: SpriteSheetFormat = { parse: () => normalized };
const exported = {
  meta: { image: "atlas.png" },
  frames: { idle: { frame: { x: 0, y: 0, w: 16, h: 16 }, duration: 120 } },
};
const output = document.createElement("pre");
output.textContent = JSON.stringify(
  {
    custom: custom.parse({}),
    aseprite: aseprite().parse(exported),
    texturePacker: texturePacker().parse(exported),
  },
  null,
  2,
);
document.body.append(output);
