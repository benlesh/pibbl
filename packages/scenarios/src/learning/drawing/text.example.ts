import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const TypeStudy = defineComp(function TypeStudy() {
  const [accent, setAccent] = crcState("#1f4bd8");
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
        x: 48,
        y: 46,
        width: 624,
        height: 328,
        fill: '#fffdf6',
        stroke: '#17211d',
        strokeWidth: 5,
      },
    }),
    text({
      style: {
        text: "TYPE / CANVAS",
        x: 360,
        y: 82,
        fill: accent,
        font: "900 52px sans-serif",
        textAlign: "center",
        cursor: "pointer",
      },
      onClick: () =>
      setAccent((value) => (value === "#1f4bd8" ? "#ff6b57" : "#1f4bd8")),
    }),
    text({
      style: {
        text: "CRC keeps drawing text direct: choose a font, alignment, wrapping width, and an overflow strategy.",
        x: 96,
        y: 184,
        width: 528,
        height: 92,
        lineHeight: 30,
        wrap: true,
        fit: "ellipsis",
        fill: "#17211d",
        font: "500 21px sans-serif",
      },
    }),
    text({
      style: {
        text: "CLICK THE HEADLINE",
        x: 360,
        y: 326,
        fill: "#5f665f",
        font: "700 13px monospace",
        textAlign: "center",
      },
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, TypeStudy({}));
}
