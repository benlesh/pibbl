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
        style: {
          x: 0,
          y: 0,
          width: 376,
          height: 256,
          fill: selected ? '#74d3ae' : '#ff6b57',
          stroke: '#17211d',
          strokeWidth: 6,
          cursor: 'pointer',
        },
        onClick: () => setSelected((value) => !value),
      }),
      rect({
        style: {
          x: 28,
          y: 30,
          width: 74,
          height: 74,
          fill: '#f7c948',
        },
      }),
      rect({
        style: {
          x: 274,
          y: 152,
          width: 74,
          height: 74,
          fill: '#1f4bd8',
        },
      }),
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
    rect({
      style: {
        x: 0,
        y: 0,
        width: 720,
        height: 420,
        fill: '#f7f0df',
      },
    }),
    ticket,
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, GroupStudy({}));
}
