import {
  pibbl,
  Group,
  Rectangle,
  Circle,
  Text,
  useVisibilityTransition,
  embers,
  type PibblEmbersOptions,
  type PibblEmbersPhysicsOptions,
  type PibblEmberCollision,
  type PibblTransitionEffect,
  type PibblVisibilityTransition,
  type PibblVisibilityTransitionOptions,
  type PibblVisibilityTransitionResult,
  type PibblVisibilityTransitionStatus,
  type PibblTransitionBinding,
} from "@pibbl/core";

const physics: PibblEmbersPhysicsOptions = {
  gravity: [0, 120],
  collide(from, to): PibblEmberCollision | undefined {
    if (from[1] < 260 && to[1] >= 260)
      return { fraction: (260 - from[1]) / (to[1] - from[1]), normal: [0, -1] };
    return undefined;
  },
};
const options: PibblEmbersOptions = {
  region: { x: 100, y: 100, width: 280, height: 100 },
  linger: 700,
  physics,
};
const effect: PibblTransitionEffect = embers(options);
const visibility: PibblVisibilityTransitionOptions = {
  initial: false,
  enter: effect,
  duration: 1600,
};
const canvas = document.createElement("canvas");
canvas.width = 480;
canvas.height = 300;
const output = document.createElement("output");
output.style.display = "block";
document.body.append(canvas, output);
let handle: PibblVisibilityTransition | undefined;
let mounted!: (value: PibblVisibilityTransition) => void;
const ready = new Promise<PibblVisibilityTransition>((resolve) => {
  mounted = resolve;
});
function Scene() {
  const transition = useVisibilityTransition(visibility);
  handle = transition;
  mounted(transition);
  const binding: PibblTransitionBinding = transition.binding;
  const status: PibblVisibilityTransitionStatus = transition.status.get();
  return (
    <>
      <Rectangle style={{ width: 480, height: 300, fill: "#11151c" }} />
      <Group style={{ transition: binding }}>
        <Circle
          style={{
            cx: 146,
            cy: 148,
            radius: 32,
            stroke: "#64e0b5",
            strokeWidth: 8,
          }}
        />
        <Rectangle
          style={{
            left: 138,
            top: 132,
            width: 16,
            height: 32,
            fill: "#64e0b5",
          }}
        />
        <Text
          style={{
            left: 204,
            top: 151,
            font: "bold 30px sans-serif",
            fill: "#ffffff",
          }}
        >
          Pibbl
        </Text>
        <Text
          style={{
            left: 204,
            top: 179,
            font: "16px sans-serif",
            fill: "#c8d3dc",
          }}
        >
          embers
        </Text>
      </Group>
      <Text
        style={{ left: 20, top: 279, fill: "#c8d3dc", font: "14px sans-serif" }}
      >
        {status}
      </Text>
    </>
  );
}
const controller = pibbl(canvas, <Scene />);
// Wait for the scheduled first mount before starting its entrance.
void ready.then((transition) => transition.show());
for (const action of ["show", "hide"] as const) {
  const button = document.createElement("button");
  button.textContent = action;
  button.onclick = async () => {
    const result: PibblVisibilityTransitionResult | undefined =
      await handle?.[action]();
    if (result) output.textContent = result.phase + ": " + result.status;
  };
  document.body.append(button);
}
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
