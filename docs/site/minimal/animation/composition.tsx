import {
  crc,
  Circle,
  useSignal,
  usePlayback,
  keyframes,
  spring,
  track,
  sequence,
  parallel,
  wait,
  marker,
  repeat,
  type CRCAnimationProgram,
  type CRCAnimationRepeatDirection,
  type CRCAnimationRepeatOptions,
  type CRCKeyframesOptions,
  type CRCSpringOptions,
} from "@crc/core";

const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 200;
document.body.append(canvas);
const output = document.createElement("output");
document.body.append(output);
function Scene() {
  const x = useSignal(40);
  const y = useSignal(60);
  const keys: CRCKeyframesOptions<number> = {
    values: [40, 200, 360],
    duration: 1400,
  };
  const bounce: CRCSpringOptions = {
    from: 60,
    to: 130,
    stiffness: 160,
    damping: 12,
  };
  const direction: CRCAnimationRepeatDirection = "normal";
  const cycles: CRCAnimationRepeatOptions = { iterations: 3, direction };
  const program: CRCAnimationProgram = repeat(
    sequence(
      parallel(track(x, keyframes(keys)), track(y, spring(bounce))),
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
const controller = crc(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
