import {
  crc,
  crcState,
  defineComp,
  line,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const LineStudy = defineComp(function LineStudy() {
  const [tracking, setTracking] = crcState(false);
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    line({
      coords: [
        [64, 338],
        [174, 238],
        [270, 278],
        [370, 112],
        [478, 184],
        [650, 68],
      ],
      strokeStyle: "#17211d",
      lineWidth: 18,
    }),
    line({
      coords: [
        [64, 328],
        [174, 228],
        [270, 268],
        [370, 102],
        [478, 174],
        [650, 58],
      ],
      strokeStyle: tracking ? "#ff6b57" : "#1f4bd8",
      lineWidth: 7,
      lineInteractionWidth: 34,
      cursor: "crosshair",
      onMouseOver: () => setTracking(true),
      onMouseOut: () => setTracking(false),
    }),
    text({
      text: tracking ? "ON THE ROUTE" : "FOLLOW THE ROUTE",
      x: 64,
      y: 56,
      fillStyle: "#17211d",
      font: "800 18px monospace",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, LineStudy({}));
}
