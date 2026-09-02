import { crc, crcState, Rectangle, Text, type CRCController } from "@crc/core";

interface PosterCardProps {
  message: string;
  onSelect: () => void;
}

function PosterCard({ message, onSelect }: PosterCardProps) {
  return [
    <Rectangle
      style={{
        x: 154,
        y: 112,
        width: 412,
        height: 196,
        fill: "#1f4bd8",
        cursor: "pointer",
      }}
      onClick={onSelect}
    />,
    <Text
      style={{
        x: 360,
        y: 180,
        fill: "#fffdf6",
        font: "800 64px sans-serif",
        textAlign: "center",
      }}
    >
      {message}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 258,
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
  const [message, setMessage] = crcState("HELLO");

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
        x: 74,
        y: 72,
        width: 572,
        height: 276,
        fill: "#f7c948",
        stroke: "#17211d",
        strokeWidth: 6,
      }}
    />,
    <PosterCard
      message={message}
      onSelect={() =>
        setMessage((value) => (value === "HELLO" ? "CRC!" : "HELLO"))
      }
    />,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Poster />);
}
