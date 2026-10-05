import {
  pibbl,
  Circle,
  Text,
  useSignal,
  usePlayback,
  drive,
  tween,
  easing,
  type PibblEasing,
  type PibblInterpolator,
  type PibblTweenOptions,
  type PibblAnimationDefinition,
  type PibblPlayback,
  type PibblPlaybackOptions,
  type PibblPlaybackEvent,
  type PibblPlaybackStatus,
} from "@pibbl/core";

const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 160;
document.body.append(canvas);
const events = document.createElement("output");
document.body.append(events);
const curve: PibblEasing = easing.easeInOut;
const interpolate: PibblInterpolator<number> = (from, to, progress) =>
  from + (to - from) * progress;
const options: PibblTweenOptions<number> = {
  from: 30,
  to: 360,
  duration: 2400,
  easing: curve,
  interpolate,
};
const definition: PibblAnimationDefinition<number> = tween(options);
const playbackOptions: PibblPlaybackOptions = {
  autoplay: true,
  onEvent(event: PibblPlaybackEvent) {
    events.textContent = event.type;
  },
};
let controls: PibblPlayback | undefined;
function Scene() {
  const x = useSignal(30);
  const playback = usePlayback(drive(x, definition), playbackOptions);
  controls = playback;
  const status: PibblPlaybackStatus = playback.status.get();
  return (
    <>
      <Circle style={{ radius: 20, left: x, top: 60, fill: "#087e8b" }} />
      <Text
        style={{ left: 20, top: 120, fill: "#222", font: "16px sans-serif" }}
      >
        {status}
      </Text>
    </>
  );
}
const controller = pibbl(canvas, <Scene />);
const commands: [string, () => void][] = [
  ["Replay", () => controls?.play()],
  ["Pause", () => controls?.pause()],
  ["Resume", () => controls?.resume()],
  ["Reverse", () => controls?.reverse()],
  ["Seek halfway", () => controls?.seek(1200)],
  ["Double speed", () => controls?.setPlaybackRate(2)],
  ["Finish", () => controls?.finish()],
  ["Cancel", () => controls?.cancel()],
];
for (const [label, action] of commands) {
  const button = document.createElement("button");
  button.textContent = label;
  button.onclick = action;
  document.body.append(button);
}
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
