import { crc, useSignal, Rectangle, Text, type CRCController } from "@crc/core";
function MouseOutStudy() {
  const departures = useSignal(0);
  const inside = useSignal(false);
  return [
    <Rectangle
      style={{
        left: 0,
        top: 0,
        width: 720,
        height: 420,
        fill: "#17211d",
      }}
    />,
    <Rectangle
      style={{
        left: 190,
        top: 68,
        width: 340,
        height: 284,
        fill: inside.get() ? "#f7c948" : "#74d3ae",
        cursor: "crosshair",
      }}
      onMouseOver={() => inside.set(true)}
      onMouseOut={() => {
        inside.set(false);
        departures.update((value) => value + 1);
      }}
    />,
    <Text
      style={{
        left: 360,
        top: 166,
        fill: "#17211d",
        font: "900 42px sans-serif",
        textAlign: "center",
      }}
    >
      {inside.get() ? "YOU ARE IN" : "MINT PORTAL"}
    </Text>,
    <Text
      style={{
        left: 360,
        top: 244,
        fill: "#17211d",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >{`DEPARTURES / ${departures.get()}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MouseOutStudy />);
}
