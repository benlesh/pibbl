import { pibbl, useSignal, Rectangle, Text, type PibblController } from "@pibbl/core";

interface PosterCardProps {
  message: string;
  onSelect: () => void;
}

function PosterCard({ message, onSelect }: PosterCardProps) {
  return [
    <Rectangle
      style={{
        left: 154,
        top: 112,
        width: 412,
        height: 196,
        fill: "#1f4bd8",
        cursor: "pointer",
      }}
      onClick={onSelect}
    />,
    <Text
      style={{
        left: 360,
        top: 180,
        fill: "#fffdf6",
        font: "800 64px sans-serif",
        textAlign: "center",
      }}
    >
      {message}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 258,
        fill: "#fffdf6",
        font: "700 14px monospace",
        textAlign: "center",
      }}
    >
      CLICK THE CARD
    </Text>,
  ];
}

function Poster() {
  const message = useSignal("HELLO");

  return [
    <Rectangle
      style={{
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Rectangle
      style={{
        left: 74,
        top: 72,
        width: 572,
        height: 276,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 6,
      }}
    />,
    <PosterCard
      message={message.get()}
      onSelect={() =>
        message.update((value) => (value === "HELLO" ? "Pibbl!" : "HELLO"))
      }
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Poster />);
}
