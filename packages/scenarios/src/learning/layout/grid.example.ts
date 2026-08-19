import {
  crc,
  crcState,
  defineComp,
  grid,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const GridStudy = defineComp(function GridStudy() {
  const [active, setActive] = crcState(false);
  return [
    rect({ style: { width: 720, height: 420, fill: "#f7f0df" } }),
    grid({
      style: {
        width: 560,
        height: 260,
        padding: 80,
        gridTemplateColumns: [150, "25%", "1fr"],
        gridTemplateRows: [100, "1fr"],
        gap: 14,
      },
      children: [
        rect({ style: {
          width: "auto", height: "auto", gridColumnStart: 1, gridRowStart: 1,
          fill: "#f7c948", stroke: "#17211d", strokeWidth: 3,
        } }),
        rect({ style: {
          width: "auto", height: "auto", gridColumnStart: 2, gridColumnSpan: 2,
          gridRowStart: 1, fill: active ? "#74d3ae" : "#ff6b57",
          stroke: "#17211d", strokeWidth: 3, cursor: "pointer",
        }, onClick: () => setActive(value => !value) }),
        rect({ style: {
          width: "auto", height: "auto", gridColumnStart: 1, gridColumnSpan: 2,
          gridRowStart: 2, fill: "#1f4bd8",
        } }),
        rect({ style: {
          width: "auto", height: "auto", gridColumnStart: 3, gridRowStart: 2,
          fill: "#74d3ae",
        } }),
      ],
    }),
    text({
      style: {
        text: "EXPLICIT TRACKS · EXPLICIT PLACEMENT",
        x: 360, y: 52, fill: "#17211d", font: "900 18px sans-serif",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, GridStudy({}));
}
