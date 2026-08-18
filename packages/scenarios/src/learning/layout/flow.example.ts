import {
  crc,
  crcState,
  defineComp,
  flow,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const colors = ["#1f4bd8", "#ff6b57", "#74d3ae", "#f7c948"] as const;

const FlowStudy = defineComp(function FlowStudy() {
  const [selected, setSelected] = crcState(0);
  return [
    rect({ style: { width: 720, height: 420, fill: "#f7f0df" } }),
    flow({
      style: { width: 552, height: 240, gap: 16, lineGap: 16, wrap: true },
      children: [
        ...colors.map((fill, index) => rect({
          key: String(index),
          style: {
            width: index === selected ? 180 : 120,
            height: 84,
            fill,
            stroke: "#17211d",
            strokeWidth: index === selected ? 5 : 2,
            cursor: "pointer",
          },
          onClick: () => setSelected(index),
        })),
        text({
          style: {
            text: "AUTO-SIZED TEXT JOINS THE FLOW",
            font: "800 16px sans-serif",
            fill: "#17211d",
          },
        }),
      ],
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, FlowStudy({}));
}
