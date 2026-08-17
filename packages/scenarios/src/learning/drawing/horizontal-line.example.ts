import {
  crc,
  crcState,
  defineComp,
  horizontalLine,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const HorizontalStudy = defineComp(function HorizontalStudy() {
  const [band, setBand] = crcState("none");
  const rule = (y: number, color: string, name: string) =>
    horizontalLine({
      style: {
        y,
        left: 82,
        right: 638,
        stroke: color,
        strokeWidth: band === name ? 14 : 5,
        lineInteractionWidth: 30,
        alignToPixelGrid: "round",
      },
      onMouseOver: () => setBand(name),
      onMouseOut: () => setBand("none"),
    });
  return [
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#17211d',
      },
    }),
    text({
      text: "HORIZONTAL RHYTHM",
      x: 82,
      y: 54,
      fillStyle: "#fffdf6",
      font: "800 24px sans-serif",
    }),
    rule(154, "#1f4bd8", "cobalt"),
    rule(230, "#ff6b57", "coral"),
    rule(306, "#f7c948", "yellow"),
    text({
      text: band === "none" ? "SWEEP THE LINES" : band.toUpperCase(),
      x: 638,
      y: 344,
      fillStyle: "#74d3ae",
      font: "700 14px monospace",
      textAlign: "right",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, HorizontalStudy({}));
}
