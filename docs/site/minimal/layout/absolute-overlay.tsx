import {
  Absolute,
  Overlay,
  Rectangle,
  Text,
  crc,
  type AbsoluteProps,
  type AbsoluteStyle,
  type OverlayProps,
  type OverlayStyle,
} from "@crc/core";

const absoluteStyle: AbsoluteStyle = { width: 320, height: 220 };
const overlayStyle: OverlayStyle = {
  left: 145,
  top: 55,
  width: 145,
  height: 100,
  alignItems: "center",
  justifyItems: "center",
};
const overlayProps: OverlayProps = {
  children: (
    <>
      <Rectangle style={{ width: 145, height: 100, fill: "#0f766e" }} />
      <Text
        style={{
          width: 80,
          height: 20,
          font: "bold 15px sans-serif",
          fill: "#fff",
        }}
      >
        Overlay
      </Text>
    </>
  ),
};
const absoluteProps: AbsoluteProps = {
  children: (
    <>
      <Rectangle
        style={{ left: 20, top: 25, width: 125, height: 145, fill: "#f97316" }}
      />
      <Overlay {...overlayProps} style={overlayStyle} />
    </>
  ),
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = crc(canvas, <Absolute {...absoluteProps} style={absoluteStyle} />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
