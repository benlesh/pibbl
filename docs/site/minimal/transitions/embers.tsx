import {
  crc,
  Group,
  Rectangle,
  Text,
  useVisibilityTransition,
  embers,
  type CRCEmbersOptions,
  type CRCEmbersPhysicsOptions,
  type CRCEmberCollision,
  type CRCTransitionEffect,
  type CRCVisibilityTransition,
  type CRCVisibilityTransitionOptions,
  type CRCVisibilityTransitionResult,
  type CRCVisibilityTransitionStatus,
  type CRCTransitionBinding,
} from "@crc/core";

const physics: CRCEmbersPhysicsOptions = {
  gravity: [0, 120],
  collide(from, to): CRCEmberCollision | undefined {
    if (from[1] < 160 && to[1] >= 160)
      return { fraction: (160 - from[1]) / (to[1] - from[1]), normal: [0, -1] };
    return undefined;
  },
};
const options: CRCEmbersOptions = {
  region: { x: 30, y: 30, width: 260, height: 100 },
  linger: 700,
  physics,
};
const effect: CRCTransitionEffect = embers(options);
const visibility: CRCVisibilityTransitionOptions = {
  initial: true,
  enter: effect,
  duration: 1200,
};
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 220;
const output = document.createElement("output");
document.body.append(canvas, output);
let handle: CRCVisibilityTransition | undefined;
function Scene() {
  const transition = useVisibilityTransition(visibility);
  handle = transition;
  const binding: CRCTransitionBinding = transition.binding;
  const status: CRCVisibilityTransitionStatus = transition.status.get();
  return (
    <>
      <Group style={{ transition: binding }}>
        <Rectangle
          style={{
            left: 30,
            top: 30,
            width: 260,
            height: 100,
            fill: "#087e8b",
          }}
        />
        <Text
          style={{ left: 60, top: 90, font: "24px sans-serif", fill: "#fff" }}
        >
          embers
        </Text>
      </Group>
      <Text
        style={{ left: 30, top: 195, fill: "#222", font: "14px sans-serif" }}
      >
        {status}
      </Text>
    </>
  );
}
const controller = crc(canvas, <Scene />);
for (const action of ["show", "hide"] as const) {
  const button = document.createElement("button");
  button.textContent = action;
  button.onclick = async () => {
    const result: CRCVisibilityTransitionResult | undefined =
      await handle?.[action]();
    if (result) output.textContent = result.phase + ": " + result.status;
  };
  document.body.append(button);
}
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
