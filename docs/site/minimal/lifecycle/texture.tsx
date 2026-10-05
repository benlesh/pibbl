import {
  pibbl,
  Rectangle,
  defineTexture,
  useTexture,
  type TextureDefinition,
  type TextureContext,
  type TextureFrame,
  type TextureRecipe,
  type Texture,
  type TextureOptions,
  type TexturePlacement,
  type TexturePaint,
} from "@pibbl/core";

type Config = { speed: number };
type State = { hue: number; speed: number };
type Message = { hue: number };
const definition: TextureDefinition<Config, State, Message> = {
  create(context: TextureContext, config) {
    context.requestFrame();
    return { hue: 170, speed: config.speed };
  },
  update(state, config) {
    state.speed = config.speed;
  },
  receive(state, message, context) {
    state.hue = message.hue;
    context.invalidate();
  },
  advance(state, frame: TextureFrame, context) {
    state.hue = (state.hue + frame.delta * state.speed) % 360;
    context.invalidate();
    context.requestFrame();
  },
  rasterize(state, { canvas }) {
    const context = canvas.getContext("2d")!;
    context.fillStyle = `hsl(${state.hue},70%,40%)`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
  },
};
const makeTile = defineTexture(definition);
const recipe: TextureRecipe<Message> = makeTile({ speed: 0.02 });
const options: TextureOptions = { resolution: { width: 32, height: 32 } };
const placement: TexturePlacement = {
  mode: "repeat",
  tileWidth: 40,
  tileHeight: 40,
};
let texture: Texture<Message> | undefined;
function Scene() {
  texture = useTexture(recipe, options);
  const paint: TexturePaint = texture.paint(placement);
  return (
    <Rectangle
      style={{ left: 20, top: 20, width: 280, height: 140, fill: paint }}
    />
  );
}
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 180;
document.body.append(canvas);
const controller = pibbl(canvas, <Scene />);
const button = document.createElement("button");
button.textContent = "Send pink hue";
button.onclick = () => texture?.send({ hue: 330 });
document.body.append(button);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
