import {
  computed,
  crc,
  crcSignal,
  Rectangle,
  Text,
  signal,
  type CRCController,
} from "@crc/core";

const x = signal(144, { debugName: "learning x" });
const doubledX = computed(() => x.get() * 2, { debugName: "learning doubled x" });

function SignalCard() {
  const color = crcSignal("#2563eb", { debugName: "learning color" });
  const derivedX = doubledX.get();
  const currentX = derivedX / 2;
  const currentColor = color.get();

  return [
    <Rectangle style={{ width: 720, height: 420, fill: "#eef2ff" }} />,
    <Rectangle
      style={{
        x: currentX,
        y: 126,
        width: 432,
        height: 174,
        fill: currentColor,
        stroke: "#17211d",
        strokeWidth: 6,
        cursor: "pointer",
      }}
      onClick={() => {
        x.update((value) => (value === 144 ? 196 : 144));
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 180,
        fill: "#ffffff",
        font: "900 28px sans-serif",
        textAlign: "center",
      }}
    >
      SIGNALS ARE EXPLICIT
    </Text>,
    <Text
      style={{
        x: 360,
        y: 222,
        fill: "#f7c948",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >
      {`x.get() ${currentX} · computed ${derivedX}`}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 264,
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
