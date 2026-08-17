import {
  crc,
  crcState,
  defineComp,
  g,
  rect,
  svgPath,
  text,
  type CRCController,
} from "@crc/core";

const SvgPathStudy = defineComp(function SvgPathStudy() {
  const [active, setActive] = crcState(false);
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#f7c948',
      },
    }),
    rect({
      style: {
        x: 52,
        y: 52,
        width: 616,
        height: 316,
        fill: '#fffdf6',
        stroke: '#17211d',
        strokeWidth: 6,
      },
    }),
    g({
      x: 238,
      y: 70,
      scaleX: 2.45,
      scaleY: 2.45,
      children: [
        svgPath({
          style: {
            d: 'M50 88 C20 68 4 48 8 28 C12 4 42 0 50 20 C58 0 88 4 92 28 C96 48 80 68 50 88 Z',
            fill: active ? '#1f4bd8' : '#ff6b57',
            stroke: '#17211d',
            strokeWidth: 2,
            cursor: 'pointer',
          },
          onClick: () => setActive((value) => !value),
        }),
      ],
    }),
    text({
      text: active ? "SVG PATH / ACTIVE" : "SVG PATH / CLICK",
      x: 360,
      y: 326,
      fillStyle: "#17211d",
      font: "800 17px sans-serif",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, SvgPathStudy({}));
}
