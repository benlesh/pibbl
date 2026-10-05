import {
  crc,
  Circle,
  Text,
  useSignal,
  usePlayback,
  track,
  tween,
  easing,
  type CRCEasing,
  type CRCInterpolator,
  type CRCTweenOptions,
  type CRCAnimationDefinition,
  type CRCPlayback,
  type CRCPlaybackOptions,
  type CRCPlaybackEvent,
  type CRCPlaybackStatus,
} from "@crc/core";

const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 160;
document.body.append(canvas);
const events = document.createElement("output");
document.body.append(events);
const curve: CRCEasing = easing.easeInOut;
const interpolate: CRCInterpolator<number> = (from, to, progress) =>
  from + (to - from) * progress;
const options: CRCTweenOptions<number> = {
  from: 30,
  to: 360,
  duration: 2400,
  easing: curve,
  interpolate,
};
const definition: CRCAnimationDefinition<number> = tween(options);
const playbackOptions: CRCPlaybackOptions = {
  autoplay: true,
  onEvent(event: CRCPlaybackEvent) {
    events.textContent = event.type;
  },
};
let controls: CRCPlayback | undefined;
function Scene() {
  const x = useSignal(30);
  const playback = usePlayback(track(x, definition), playbackOptions);
  controls = playback;
  const status: CRCPlaybackStatus = playback.status.get();
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
const controller = crc(canvas, <Scene />);
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
