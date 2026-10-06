import { pibbl, signal, usePlayback, drive, repeat } from "@pibbl/core";
import {
  Sprite,
  type SpriteFrame,
  loadSpriteSheet,
  defineSpriteAnimation,
  type SpriteGrid,
  type SpriteSheet,
  type SpriteProps,
  type SpriteStyle,
} from "@pibbl/core/sprites";
const atlas = document.createElement("canvas");
atlas.width = 32;
atlas.height = 16;
const context = atlas.getContext("2d")!;
context.fillStyle = "#087e8b";
context.fillRect(0, 0, 16, 16);
context.fillStyle = "#f2a65a";
context.fillRect(16, 0, 16, 16);
const grid: SpriteGrid = { frameWidth: 16, frameHeight: 16 };
const canvas = document.createElement("canvas");
canvas.width = 160;
canvas.height = 120;
document.body.append(canvas);
let disposed = false;
let release = () => {};
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    release();
  },
  { once: true },
);
async function mount() {
  const sheet: SpriteSheet = await loadSpriteSheet(atlas.toDataURL(), { grid });
  if (disposed) {
    sheet.dispose();
    return;
  }
  const first: SpriteFrame = sheet.frames[0];
  const frame = signal(first);
  const animation = defineSpriteAnimation({
    frames: [first, sheet.frames[1]],
    fps: 2,
  });
  const style: SpriteStyle = { width: 64, height: 64 };
  const props: SpriteProps = { frame: first, sampling: "nearest" };
  function Scene() {
    usePlayback(repeat(drive(frame, animation), { iterations: Infinity }));
    return <Sprite {...props} frame={frame} style={style} />;
  }
  const app = pibbl(canvas, <Scene />);
  release = () => {
    app.dispose();
    sheet.dispose();
  };
}
mount().catch((error) => {
  const message = document.createElement("p");
  message.textContent = String(error);
  document.body.append(message);
});
