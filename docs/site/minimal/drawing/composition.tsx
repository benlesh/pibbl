import {
  Clip,
  Group,
  Image,
  Layer,
  Rectangle,
  Text,
  crc,
  createCirclePath,
  type ClipProps,
  type ClipStyle,
  type GStyle,
  type GroupProps,
  type ImageProps,
  type ImgStyle,
  type LayerProps,
  type LayerStyle,
  type TextProps,
  type TextFit,
  type TextStyle,
} from "@crc/core";

const groupStyle: GStyle = { translateX: 24, translateY: 24 };
const clipStyle: ClipStyle = {
  d: createCirclePath({ cx: 70, cy: 70, radius: 58 }),
};
const layerStyle: LayerStyle = { width: 140, height: 140 };
const clipProps: ClipProps = {
  children: <Rectangle style={{ width: 140, height: 140, fill: "#0f766e" }} />,
};
const layerProps: LayerProps = {
  children: <Clip {...clipProps} style={clipStyle} />,
};
const groupProps: GroupProps = {
  children: <Layer {...layerProps} style={layerStyle} />,
};
const textProps: TextProps = { pointerEvents: "auto" };
const fit: TextFit = "ellipsis";
const textStyle: TextStyle = {
  left: 170,
  top: 70,
  font: "bold 20px sans-serif",
  fill: "#111827",
  fit,
};
const imageProps: ImageProps = { pointerEvents: "auto" };
const thumbnail = document.createElement("canvas");
thumbnail.width = 64;
thumbnail.height = 64;
const thumbnailContext = thumbnail.getContext("2d")!;
thumbnailContext.fillStyle = "#dbeafe";
thumbnailContext.fillRect(0, 0, 64, 64);
thumbnailContext.fillStyle = "#f97316";
thumbnailContext.beginPath();
thumbnailContext.arc(47, 17, 9, 0, Math.PI * 2);
thumbnailContext.fill();
thumbnailContext.fillStyle = "#0f766e";
thumbnailContext.beginPath();
thumbnailContext.moveTo(0, 64);
thumbnailContext.lineTo(28, 24);
thumbnailContext.lineTo(64, 64);
thumbnailContext.fill();
const imageStyle: ImgStyle = {
  src: thumbnail.toDataURL("image/png"),
  left: 170,
  top: 95,
  width: 80,
  height: 80,
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = crc(
  canvas,
  <>
    <Group {...groupProps} style={groupStyle} />
    <Text {...textProps} style={textStyle}>
      Canvas
    </Text>
    <Image {...imageProps} style={imageStyle} />
  </>,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
