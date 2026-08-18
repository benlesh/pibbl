import {
  crc,
  crcState,
  defineComp,
  flex,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const FlexStudy = defineComp(function FlexStudy() {
  const [active, setActive] = crcState<"left" | "right">("left");
  return [
    rect({ style: { width: 720, height: 420, fill: "#f7f0df" } }),
    flex({
      style: {
        width: 560,
        height: 250,
        padding: 18,
        gap: 18,
        alignItems: "center",
      },
      children: ["left", "right"].map(side => rect({
        key: side,
        style: {
          width: 170,
          height: active === side ? 190 : 140,
          minWidth: 90,
          flexBasis: 170,
          flexGrow: active === side ? 2 : 1,
          flexShrink: 1,
          fill: side === "left" ? "#1f4bd8" : "#ff6b57",
          stroke: "#17211d",
          strokeWidth: 4,
          cursor: "pointer",
        },
        onClick: () => setActive(side as "left" | "right"),
      })),
    }),
    text({
      style: {
        text: "GROW · SHRINK · ALIGN",
        x: 360,
        y: 54,
        fill: "#17211d",
        font: "900 20px sans-serif",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, FlexStudy({}));
}
