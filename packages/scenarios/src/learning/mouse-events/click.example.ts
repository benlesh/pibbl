import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const ClickStudy = defineComp(function ClickStudy() {
  const [picks, setPicks] = crcState(0);
  const sleeve = (x: number, color: string, value: number) =>
    rect({
      x,
      y: 118,
      width: 160,
      height: 190,
      fillStyle: color,
      strokeStyle: "#17211d",
      lineWidth: 5,
      cursor: "pointer",
      onClick: () => setPicks((total) => total + value),
    });
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    text({
      text: `RECORD PICKS / ${picks}`,
      x: 360,
      y: 54,
      fillStyle: "#17211d",
      font: "900 28px sans-serif",
      textAlign: "center",
    }),
    sleeve(86, "#1f4bd8", 1),
    sleeve(280, "#ff6b57", 1),
    sleeve(474, "#f7c948", 1),
    text({
      text: "CLICK A SLEEVE",
      x: 360,
      y: 342,
      fillStyle: "#17211d",
      font: "700 14px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, ClickStudy({}));
}
