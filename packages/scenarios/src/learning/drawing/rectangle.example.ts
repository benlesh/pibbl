import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const RectangleStudy = defineComp(function RectangleStudy() {
  const [hovered, setHovered] = crcState(false);
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    rect({ x: 54, y: 52, width: 252, height: 316, fillStyle: "#1f4bd8" }),
    rect({
      x: 268,
      y: 104,
      width: 280,
      height: 190,
      fillStyle: hovered ? "#74d3ae" : "#ff6b57",
      strokeStyle: "#17211d",
      lineWidth: 6,
      cursor: "crosshair",
      onMouseOver: () => setHovered(true),
      onMouseOut: () => setHovered(false),
    }),
    rect({
      x: 534,
      y: 50,
      width: 132,
      height: 132,
      fillStyle: "#f7c948",
      strokeStyle: "#17211d",
      lineWidth: 2,
      alignToPixelGrid: "round",
    }),
    rect({
      x: 406,
      y: 292,
      width: 260,
      height: 76,
      strokeStyle: "#17211d",
      lineWidth: 6,
    }),
    text({
      text: hovered ? "TARGET FOUND" : "RECTANGLE STUDY",
      x: 406,
      y: 324,
      fillStyle: "#17211d",
      font: "800 16px sans-serif",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, RectangleStudy({}));
}
