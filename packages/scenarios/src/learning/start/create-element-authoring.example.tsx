import {
  crc,
  createElement,
  crcState,
  Group,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";

function CreateElementPoster(_props: Record<never, never>) {
  const [message, setMessage] = crcState("NO JSX");

  return createElement(
    Group,
    null,
    createElement(Rectangle, {
      style: { width: 720, height: 420, fill: "#eef2ff" },
    }),
    createElement(Rectangle, {
      style: {
        x: 96,
        y: 78,
        width: 528,
        height: 264,
        fill: "#312e81",
        stroke: "#17211d",
        strokeWidth: 6,
      },
    }),
    createElement(Rectangle, {
      style: {
        x: 164,
        y: 124,
        width: 392,
        height: 172,
        fill: "#f7c948",
        cursor: "pointer",
      },
      onClick: () =>
        setMessage((value) => (value === "NO JSX" ? "SAME CRC" : "NO JSX")),
    }),
    createElement(
      Text,
      {
        style: {
          x: 360,
          y: 190,
          fill: "#17211d",
          font: "900 48px sans-serif",
          textAlign: "center",
        },
      },
      message,
    ),
    createElement(
      Text,
      {
        style: {
          x: 360,
          y: 246,
          fill: "#17211d",
          font: "700 13px monospace",
          textAlign: "center",
        },
      },
      "CLICK THE CARD",
    ),
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, createElement(CreateElementPoster, null));
}
