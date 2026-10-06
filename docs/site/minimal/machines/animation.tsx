import { pibbl, Circle, signal, drive, tween } from "@pibbl/core";
import { defineMachine, useMachine } from "@pibbl/core/machines";
import {
  playAnimation,
  type MachineAnimationOptions,
  type MachineAnimationProgramFactory,
} from "@pibbl/core/machines/animation";
const x = signal(25);
type Event = { type: "REPLAY" };
const program: MachineAnimationProgramFactory<{}, Event, undefined> = () =>
  drive(x, tween({ from: 25, to: 280, duration: 1000 }));
const options: MachineAnimationOptions = { debugName: "slide" };
const definition = defineMachine<{}, Event>({
  initial: "moving",
  context: {},
  states: {
    moving: {
      invoke: { task: playAnimation(program, options), onDone: "done" },
    },
    done: { on: { REPLAY: "moving" } },
  },
});
function Scene() {
  useMachine(definition, { input: undefined });
  return <Circle style={{ left: x, top: 45, radius: 18, fill: "#087e8b" }} />;
}
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 90;
document.body.append(canvas);
const app = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
