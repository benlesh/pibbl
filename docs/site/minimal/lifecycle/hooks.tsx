/** @jsxImportSource @crc/core */
import {
  crc,
  Rectangle,
  Text,
  useSignal,
  useComputed,
  useConst,
  useRef,
  useReaction,
  type CRCRef,
  type CRCReactionOptions,
} from "@crc/core";

const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 160;
const output = document.createElement("output");
document.body.append(canvas, output);
function Counter() {
  const count = useSignal(0);
  const doubled = useComputed(() => count.get() * 2);
  const label = useConst(() => "Click the rectangle");
  const renders: CRCRef<number> = useRef(0);
  renders.current = (renders.current ?? 0) + 1;
  const options: CRCReactionOptions = { debugName: "counter-output" };
  useReaction(
    () => {
      output.textContent = `Committed count: ${count.get()}`;
      return () => {
        output.textContent = "";
      };
    },
    [],
    options,
  );
  return [
    <Rectangle
      style={{ width: 320, height: 160, fill: "#267d7c" }}
      onClick={() => count.update((n) => n + 1)}
    />,
    <Text
      pointerEvents="none"
      style={{ left: 15, top: 50, fill: "white", font: "18px sans-serif" }}
    >
      {label}: {count.get()} / doubled {doubled.get()}
    </Text>,
  ];
}
const controller = crc(canvas, <Counter />);
window.addEventListener("pagehide", () => controller.dispose(), { once: true });
