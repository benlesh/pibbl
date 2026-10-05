import {
  crc,
  Group,
  Rectangle,
  SvgPath,
  Text,
  useVisibilityTransition,
  hologram,
  type CRCHologramOptions,
  type CRCTransitionEffect,
  type CRCVisibilityTransition,
  type CRCVisibilityTransitionOptions,
  type CRCVisibilityTransitionResult,
  type CRCVisibilityTransitionStatus,
  type CRCTransitionBinding,
} from "@crc/core";

const options: CRCHologramOptions = {
  region: { x: 138, y: 44, width: 204, height: 204 },
  entry: { x: 240, y: 258 },
  brightness: 0.8,
};
const effect: CRCTransitionEffect = hologram(options);
const visibility: CRCVisibilityTransitionOptions = {
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
let handle: CRCVisibilityTransition | undefined;
let mounted!: (value: CRCVisibilityTransition) => void;
const ready = new Promise<CRCVisibilityTransition>((resolve) => {
  mounted = resolve;
});
function Scene() {
  const transition = useVisibilityTransition(visibility);
  handle = transition;
  mounted(transition);
  const binding: CRCTransitionBinding = transition.binding;
  const status: CRCVisibilityTransitionStatus = transition.status.get();
  return (
    <>
      <Rectangle style={{ width: 480, height: 300, fill: "#11151c" }} />
      <Group style={{ transition: binding }}>
        <SvgPath
          style={{
            // The window winds opposite the hull, leaving a real transparent hole.
            d: "M240 50 Q278 85 276 130 L336 194 L282 182 L262 156 L262 196 L218 196 L218 156 L198 182 L144 194 L204 130 Q202 85 240 50 Z M240 88 A16 16 0 1 0 240 120 A16 16 0 1 0 240 88 Z",
            fill: "#64e0b5",
            stroke: "#c6fff0",
            strokeWidth: 3,
          }}
        />
        <SvgPath
          style={{
            d: "M210 141 L172 182 M270 141 L308 182 M240 136 L240 181",
            stroke: "#176c67",
            strokeWidth: 4,
          }}
        />
        <SvgPath
          style={{
            d: "M224 208 L232 222 L224 237 L216 222 Z M240 212 L247 228 L240 246 L233 228 Z M256 208 L264 222 L256 237 L248 222 Z",
            fill: "#f6c66a",
          }}
        />
      </Group>
      <Text
        style={{ left: 20, top: 279, fill: "#c8d3dc", font: "14px sans-serif" }}
      >
        {status}
      </Text>
    </>
  );
}
const controller = crc(canvas, <Scene />);
// Wait for the scheduled first mount before starting its entrance.
void ready.then((transition) => transition.show());
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
