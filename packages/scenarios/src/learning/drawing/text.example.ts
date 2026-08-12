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
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    rect({
      x: 48,
      y: 46,
      width: 624,
      height: 328,
      fillStyle: "#fffdf6",
      strokeStyle: "#17211d",
      lineWidth: 5,
    }),
    text({
      text: "TYPE / CANVAS",
      x: 360,
      y: 82,
      fillStyle: accent,
      font: "900 52px sans-serif",
      textAlign: "center",
      cursor: "pointer",
      onClick: () =>
        setAccent((value) => (value === "#1f4bd8" ? "#ff6b57" : "#1f4bd8")),
    }),
    text({
      text: "CRC keeps drawing text direct: choose a font, alignment, wrapping width, and an overflow strategy.",
      x: 96,
      y: 184,
      maxWidth: 528,
      maxHeight: 92,
      lineHeight: 30,
      wordWrap: true,
      overflow: "ellipsis",
      fillStyle: "#17211d",
      font: "500 21px sans-serif",
    }),
    text({
      text: "CLICK THE HEADLINE",
      x: 360,
      y: 326,
      fillStyle: "#5f665f",
      font: "700 13px monospace",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, TypeStudy({}));
}
