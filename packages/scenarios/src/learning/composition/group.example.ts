import {
  crc,
  crcState,
  defineComp,
  g,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const GroupStudy = defineComp(function GroupStudy() {
  const [selected, setSelected] = crcState(false);
  const ticket = g({
    x: 172,
    y: 72,
    rotate: -8,
    rotateOrigin: [188, 128],
    children: [
      rect({
        x: 0,
        y: 0,
        width: 376,
        height: 256,
        fillStyle: selected ? "#74d3ae" : "#ff6b57",
        strokeStyle: "#17211d",
        lineWidth: 6,
        cursor: "pointer",
        onClick: () => setSelected((value) => !value),
      }),
      rect({ x: 28, y: 30, width: 74, height: 74, fillStyle: "#f7c948" }),
      rect({ x: 274, y: 152, width: 74, height: 74, fillStyle: "#1f4bd8" }),
      text({
        text: selected ? "GROUPED!" : "ONE GROUP",
        x: 188,
        y: 112,
        fillStyle: "#17211d",
        font: "900 34px sans-serif",
        textAlign: "center",
      }),
      text({
        text: "MOVE · ROTATE · SCALE",
        x: 188,
        y: 162,
        fillStyle: "#17211d",
        font: "700 13px monospace",
        textAlign: "center",
      }),
    ],
  });
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    ticket,
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, GroupStudy({}));
}
