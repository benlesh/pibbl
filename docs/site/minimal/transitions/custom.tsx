import {
  crc,
  Rectangle,
  defineTransition,
  useVisibilityTransition,
  type CRCTransitionDefinition,
  type CRCTransitionRenderFrame,
  type CRCVisibilityTransition,
} from "@crc/core";

const definition: CRCTransitionDefinition = {
  render({
    context,
    progress,
    drawSource,
  }: Readonly<CRCTransitionRenderFrame>) {
    context.save();
    context.globalAlpha = progress * progress;
    drawSource();
    context.restore();
  },
};
const effect = defineTransition(definition);
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 180;
document.body.append(canvas);
let transition: CRCVisibilityTransition | undefined;
function Scene() {
  transition = useVisibilityTransition({ enter: effect, duration: 1000 });
  return (
    <Rectangle
      style={{
        left: 30,
        top: 30,
        width: 260,
        height: 100,
        fill: "#b83970",
        transition: transition.binding,
      }}
    />
  );
}
const controller = crc(canvas, <Scene />);
const button = document.createElement("button");
button.textContent = "Toggle visibility";
button.onclick = () => {
  if (transition)
    void (transition.visible.get() ? transition.hide() : transition.show());
};
document.body.append(button);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
