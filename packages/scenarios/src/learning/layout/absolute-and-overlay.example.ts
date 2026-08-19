import {
  absolute,
  crc,
  crcState,
  defineComp,
  overlay,
  rect,
  text,
  type CRCController,
  type LayoutItemStyle,
  type OverlayStyle,
} from "@crc/core";

const AbsoluteOverlayStudy = defineComp(function AbsoluteOverlayStudy() {
  const [active, setActive] = crcState(false);
  const panelStyle = {
    left: 100,
    top: 70,
    width: 520,
    height: 280,
    alignItems: "center",
    justifyItems: "center",
  } satisfies OverlayStyle & LayoutItemStyle;
  return absolute({
    style: { width: "100%", height: "100%" },
    children: [
      rect({ style: { width: "100%", height: "100%", fill: "#f7f0df" } }),
      overlay({
        style: panelStyle,
        children: [
          rect({ style: { width: "100%", height: "100%", fill: "#1f4bd8" } }),
          rect({
            style: {
              width: 270,
              height: 130,
              fill: active ? "#74d3ae" : "#ff6b57",
              stroke: "#17211d",
              strokeWidth: 5,
              cursor: "pointer",
            },
            onClick: () => setActive(value => !value),
          }),
          text({
            style: {
              text: active ? "OVERLAY ACTIVE" : "CLICK THE OVERLAY",
              x: 130,
              y: 14,
              fill: "#17211d",
              font: "800 22px sans-serif",
              textAlign: "center",
              textBaseline: "middle",
              width: 260,
              height: 28,
              alignSelf: "center",
              justifySelf: "center",
            },
          }),
        ],
      }),
    ],
  });
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, AbsoluteOverlayStudy({}));
}
