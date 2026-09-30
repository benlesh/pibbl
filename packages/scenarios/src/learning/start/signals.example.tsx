import {
  computed,
  crc,
  useSignal,
  Rectangle,
  Text,
  signal,
  type CRCController,
} from "@crc/core";

const x = signal(144, { debugName: "learning x" });
const doubledX = computed(() => x.get() * 2, { debugName: "learning doubled x" });
const signalSummary = computed(
  () => `x ${x.get()} · computed ${doubledX.get()}`,
  { debugName: "learning signal summary" },
);

function SignalCard() {
  const color = useSignal("#2563eb", { debugName: "learning color" });

  return [
    <Rectangle style={{ width: 720, height: 420, fill: "#eef2ff" }} />,
    <Rectangle
      style={{
        left: x,
        top: 126,
        width: 432,
        height: 174,
        fill: color,
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => {
        x.update((value) => (value === 144 ? 196 : 144));
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        left: 360,
        top: 180,
        fill: "#ffffff",
        font: "900 28px sans-serif",
        textAlign: "center",
      }}
    >
      SIGNALS FLOW TO RECEIVERS
    </Text>,
    <Text
      pointerEvents="none"
      style={{
        left: 360,
        top: 222,
        fill: "#f7c948",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >
      {signalSummary}
    </Text>,
    <Text
      pointerEvents="none"
      style={{
        left: 360,
        top: 264,
        fill: "#ffffff",
        font: "600 13px monospace",
        textAlign: "center",
      }}
    >
      CLICK TO UPDATE THE WRITABLE SIGNAL
    </Text>,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <SignalCard />);
}
