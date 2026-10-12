import {
  Rectangle,
  Text,
  pibbl,
  useLayoutBox,
  type LayoutItemStyle,
} from "@pibbl/core";

function Scene() {
  const box = useLayoutBox();
  const item: LayoutItemStyle = { left: 16, top: 16 };
  return (
    <>
      <Rectangle
        style={{
          ...item,
          width: box.width - 32,
          height: box.height - 32,
          fill: "#0f766e",
        }}
      />
      <Text
        style={{ left: 28, top: 48, font: "16px sans-serif", fill: "#fff" }}
      >
        {`${box.width} x ${box.height}`}
      </Text>
    </>
  );
}
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(canvas, <Scene />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
