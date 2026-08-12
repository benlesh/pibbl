import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const DoubleClickStudy = defineComp(function DoubleClickStudy() {
  const [stamps, setStamps] = crcState(0);
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#1f4bd8" }),
    rect({
      x: 190,
      y: 76,
      width: 340,
      height: 268,
      fillStyle: "#f7c948",
      strokeStyle: "#17211d",
      lineWidth: 7,
      cursor: "copy",
      onDblClick: () => setStamps((value) => value + 1),
    }),
    text({
      text: stamps ? `STAMPED × ${stamps}` : "DOUBLE CLICK",
      x: 360,
      y: 166,
      fillStyle: "#17211d",
      font: "900 42px sans-serif",
      textAlign: "center",
    }),
    text({
      text: "A SECONDARY GESTURE",
      x: 360,
      y: 236,
      fillStyle: "#17211d",
      font: "700 14px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, DoubleClickStudy({}));
}
