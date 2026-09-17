import { crc, useState, Rectangle, Text, type CRCController } from "@crc/core";
function MouseOutStudy() {
  const [departures, setDepartures] = useState(0);
  const [inside, setInside] = useState(false);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#17211d",
      }}
    />,
    <Rectangle
      style={{
        x: 190,
        y: 68,
        width: 340,
        height: 284,
        fill: inside ? "#f7c948" : "#74d3ae",
        cursor: "crosshair",
      }}
      onMouseOver={() => setInside(true)}
      onMouseOut={() => {
        setInside(false);
        setDepartures((value) => value + 1);
      }}
    />,
    <Text
      style={{
        x: 360,
        y: 166,
        fill: "#17211d",
        font: "900 42px sans-serif",
        textAlign: "center",
      }}
    >
      {inside ? "YOU ARE IN" : "MINT PORTAL"}
    </Text>,
    <Text
      style={{
        x: 360,
        y: 244,
        fill: "#17211d",
        font: "700 15px monospace",
        textAlign: "center",
      }}
    >{`DEPARTURES / ${departures}`}</Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <MouseOutStudy />);
}
