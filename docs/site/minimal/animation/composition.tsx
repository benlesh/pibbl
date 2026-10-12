import {
  pibbl,
  Circle,
  useSignal,
  usePlayback,
  keyframes,
  spring,
  drive,
  sequence,
  parallel,
  wait,
  marker,
  repeat,
  type PibblAnimationProgram,
  type PibblAnimationRepeatDirection,
  type PibblAnimationRepeatOptions,
  type PibblKeyframesOptions,
  type PibblSpringOptions,
} from "@pibbl/core";

const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 200;
document.body.append(canvas);
const output = document.createElement("output");
document.body.append(output);
function Scene() {
  const x = useSignal(40);
  const y = useSignal(60);
  const keys: PibblKeyframesOptions<number> = {
    values: [40, 200, 360],
    duration: 1400,
  };
  const bounce: PibblSpringOptions = {
    from: 60,
    to: 130,
    stiffness: 160,
    damping: 12,
  };
  const direction: PibblAnimationRepeatDirection = "normal";
  const cycles: PibblAnimationRepeatOptions = { iterations: 3, direction };
  const program: PibblAnimationProgram = repeat(
    sequence(
      parallel(drive(x, keyframes(keys)), drive(y, spring(bounce))),
      marker("arrived"),
      wait(300),
    ),
    cycles,
  );
  usePlayback(program, {
    autoplay: true,
    onEvent(event) {
      output.textContent = event.marker ?? event.type;
    },
  });
  return <Circle style={{ radius: 22, left: x, top: y, fill: "#b83970" }} />;
}
const controller = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
