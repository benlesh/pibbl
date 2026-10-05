import {
  crc,
  Circle,
  signal,
  useAnimatedValue,
  type CRCTweenAnimatedValueOptions,
  type CRCSpringAnimatedValueOptions,
} from "@crc/core";

const target = signal(50);
const button = document.createElement("button");
button.textContent = "Move both circles";
button.onclick = () => target.update((x) => (x === 50 ? 350 : 50));
const canvas = document.createElement("canvas");
canvas.width = 420;
canvas.height = 180;
document.body.append(button, canvas);
const smooth: CRCTweenAnimatedValueOptions<number> = {
  type: "tween",
  duration: 600,
};
const bouncy: CRCSpringAnimatedValueOptions = {
  type: "spring",
  stiffness: 180,
  damping: 12,
};
function Scene() {
  const tweened = useAnimatedValue(target.get(), smooth);
  const sprung = useAnimatedValue(target.get(), bouncy);
  return (
    <>
      <Circle style={{ radius: 18, left: tweened, top: 50, fill: "#087e8b" }} />
      <Circle style={{ radius: 18, left: sprung, top: 120, fill: "#b83970" }} />
    </>
  );
}
const controller = crc(canvas, <Scene />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
