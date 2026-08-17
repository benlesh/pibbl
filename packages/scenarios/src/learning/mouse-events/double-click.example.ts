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
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#1f4bd8',
      },
    }),
    rect({
      style: {
        x: 190,
        y: 76,
        width: 340,
        height: 268,
        fill: '#f7c948',
        stroke: '#17211d',
        strokeWidth: 7,
        cursor: 'copy',
      },
      onDblClick: () => setStamps((value) => value + 1),
    }),
    text({
      style: {
        text: stamps ? `STAMPED × ${stamps}` : "DOUBLE CLICK",
        x: 360,
        y: 166,
        fill: "#17211d",
        font: "900 42px sans-serif",
        textAlign: "center",
      },
    }),
    text({
      style: {
        text: "A SECONDARY GESTURE",
        x: 360,
        y: 236,
        fill: "#17211d",
        font: "700 14px monospace",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, DoubleClickStudy({}));
}
