import {
  pibbl,
  Group,
  Rectangle,
  Text,
  useVisibilityTransition,
  fade,
  type PibblTransitionEffect,
  type PibblVisibilityTransition,
  type PibblVisibilityTransitionOptions,
  type PibblVisibilityTransitionResult,
  type PibblVisibilityTransitionStatus,
  type PibblTransitionBinding,
} from "@pibbl/core";

const effect: PibblTransitionEffect = fade();
const visibility: PibblVisibilityTransitionOptions = {
  initial: true,
  enter: effect,
  duration: 1200,
};
const canvas = document.createElement("canvas");
canvas.width = 360;
canvas.height = 220;
const output = document.createElement("output");
document.body.append(canvas, output);
let handle: PibblVisibilityTransition | undefined;
function Scene() {
  const transition = useVisibilityTransition(visibility);
  handle = transition;
  const binding: PibblTransitionBinding = transition.binding;
  const status: PibblVisibilityTransitionStatus = transition.status.get();
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
          fade
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
const controller = pibbl(canvas, <Scene />);
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
