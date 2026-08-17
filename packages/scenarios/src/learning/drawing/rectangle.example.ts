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
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#f7f0df',
      },
    }),
    rect({
      style: {
        x: 54,
        y: 52,
        width: 252,
        height: 316,
        fill: '#1f4bd8',
      },
    }),
    rect({
      style: {
        x: 268,
        y: 104,
        width: 280,
        height: 190,
        fill: hovered ? '#74d3ae' : '#ff6b57',
        stroke: '#17211d',
        strokeWidth: 6,
        cursor: 'crosshair',
      },
      onMouseOver: () => setHovered(true),
      onMouseOut: () => setHovered(false),
    }),
    rect({
      style: {
        x: 534,
        y: 50,
        width: 132,
        height: 132,
        fill: '#f7c948',
        stroke: '#17211d',
        strokeWidth: 2,
        alignToPixelGrid: 'round',
      },
    }),
    rect({
      style: {
        x: 406,
        y: 292,
        width: 260,
        height: 76,
        stroke: '#17211d',
        strokeWidth: 6,
      },
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
