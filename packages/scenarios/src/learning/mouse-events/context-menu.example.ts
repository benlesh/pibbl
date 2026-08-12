import {
  crc,
  crcState,
  defineComp,
  rect,
  text,
  type CRCController,
} from "@crc/core";

const ContextMenuStudy = defineComp(function ContextMenuStudy() {
  const [opened, setOpened] = crcState(false);
  return [
    rect({ x: 0, y: 0, width: 720, height: 420, fillStyle: "#f7f0df" }),
    rect({
      x: 98,
      y: 82,
      width: 350,
      height: 256,
      fillStyle: "#ff6b57",
      strokeStyle: "#17211d",
      lineWidth: 6,
      cursor: "context-menu",
      onContextMenu: (event) => {
        event.originalEvent.preventDefault();
        setOpened(true);
      },
    }),
    text({
      text: "RIGHT CLICK",
      x: 273,
      y: 170,
      fillStyle: "#17211d",
      font: "900 38px sans-serif",
      textAlign: "center",
    }),
    text({
      text: opened
        ? "Context received\nDefault menu prevented"
        : "A contextual action\ncan stay contextual.",
      x: 560,
      y: 154,
      maxWidth: 130,
      lineHeight: 26,
      wordWrap: true,
      fillStyle: "#17211d",
      font: "700 17px sans-serif",
      textAlign: "center",
    }),
  ];
});

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, ContextMenuStudy({}));
}
