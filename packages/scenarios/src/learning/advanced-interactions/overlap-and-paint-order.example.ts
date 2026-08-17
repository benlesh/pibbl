import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const PaintOrderStudy = defineComp(function PaintOrderStudy() {
  const [winner, setWinner] = crcState("none");
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
        x: 118,
        y: 92,
        width: 320,
        height: 238,
        fill: '#1f4bd8',
        cursor: 'pointer',
      },
      onClick: () => setWinner('cobalt'),
    }),
    rect({
      style: {
        x: 282,
        y: 126,
        width: 320,
        height: 238,
        fill: '#ff6b57',
        opacity: 0.94,
        cursor: 'pointer',
      },
      onClick: () => setWinner('coral'),
    }),
    text({
      text: "UNDER",
      x: 206,
      y: 184,
      fillStyle: "#fffdf6",
      font: "900 32px sans-serif",
      textAlign: "center",
    }),
    text({
      text: "TOP",
      x: 510,
      y: 238,
      fillStyle: "#17211d",
      font: "900 32px sans-serif",
      textAlign: "center",
    }),
    text({
      text:
        winner === "none"
          ? "CLICK THE OVERLAP"
          : `TARGET / ${winner.toUpperCase()}`,
      x: 360,
      y: 54,
      fillStyle: "#17211d",
      font: "800 16px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, PaintOrderStudy({}));
}
