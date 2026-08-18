import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  verticalLine,
  type CRCController,
} from "@crc/core";

const VerticalStudy = defineComp(function VerticalStudy() {
  const [stripe, setStripe] = crcState(0);
  const colors = ["#1f4bd8", "#ff6b57", "#f7c948", "#74d3ae"];
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
    ...colors.map((color, index) =>
      verticalLine({
        style: {
          x: 160 + index * 132,
          y1: 74 + index * 18,
          y2: 346 - index * 18,
          stroke: color,
          strokeWidth: stripe === index + 1 ? 26 : 10,
          lineInteractionWidth: 40,
          alignToPixelGrid: "round",
          cursor: "col-resize",
        },
        onMouseOver: () => setStripe(index + 1),
        onMouseOut: () => setStripe(0),
      }),
    ),
    text({
      style: {
        text: stripe ? `STRIPE ${stripe}` : "VERTICAL FIELD",
        x: 360,
        y: 370,
        fill: "#17211d",
        font: "800 17px monospace",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, VerticalStudy({}));
}
