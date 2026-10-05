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
const imageStyle: ImgStyle = {
  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9wrNwAAAAASUVORK5CYII=",
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
