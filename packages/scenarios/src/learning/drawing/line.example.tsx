import {
  crc,
  useSignal,
  Line,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";
function LineStudy() {
  const tracking = useSignal(false);
  return [
    <Rectangle
      style={{
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: "#f7f0df",
      }}
    />,
    <Line
      style={{
        coords: [
          [64, 338],
          [174, 238],
          [270, 278],
          [370, 112],
          [478, 184],
          [650, 68],
        ],
        stroke: "#17211d",
        strokeWidth: 18,
      }}
    />,
    <Line
      style={{
        coords: [
          [64, 328],
          [174, 228],
          [270, 268],
          [370, 102],
          [478, 174],
          [650, 58],
        ],
        stroke: tracking.get() ? "#ff6b57" : "#1f4bd8",
        strokeWidth: 7,
        lineInteractionWidth: 34,
        cursor: "crosshair",
      }}
      onMouseOver={() => tracking.set(true)}
      onMouseOut={() => tracking.set(false)}
    />,
    <Text
      style={{
        x: 64,
        y: 56,
        fill: "#17211d",
        font: "800 18px monospace",
      }}
    >
      {tracking.get() ? "ON THE ROUTE" : "FOLLOW THE ROUTE"}
    </Text>,
  ];
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <LineStudy />);
}
