import {
  pibbl,
  Circle,
  useSignal,
  usePlayback,
  drive,
  parallel,
  defineAnimation,
  stepper,
  type PibblAnimationOptions,
  type PibblAnimationSampleInput,
  type PibblStepperOptions,
} from "@pibbl/core";

const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 200;
document.body.append(canvas);
const wave: PibblAnimationOptions<number> = {
  duration: 6000,
  sample({ initialValue, localTime }: PibblAnimationSampleInput<number>) {
    return initialValue + Math.sin(localTime / 350) * 60;
  },
};
type State = { x: number; velocity: number };
const integration: PibblStepperOptions<State, number> = {
  stepMilliseconds: 16,
  maxElapsedMilliseconds: 64,
  initial: (x) => ({ x, velocity: 70 }),
  step: (state, milliseconds) => ({
    ...state,
    x: state.x + (state.velocity * milliseconds) / 1000,
  }),
  read: (state) => state.x,
  done: (state) => state.x >= 360,
};
function Scene() {
  const y = useSignal(100);
  const x = useSignal(30);
  usePlayback(
    parallel(drive(y, defineAnimation(wave)), drive(x, stepper(integration))),
    { autoplay: true },
  );
  return <Circle style={{ radius: 15, left: x, top: y, fill: "#3369bb" }} />;
}
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
