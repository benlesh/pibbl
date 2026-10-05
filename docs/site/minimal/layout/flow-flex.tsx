import {
  Flex,
  Flow,
  Rectangle,
  pibbl,
  type FlexItemStyle,
  type FlexProps,
  type FlexStyle,
  type FlowProps,
  type FlowStyle,
} from "@pibbl/core";

const flexItem: FlexItemStyle = { flexGrow: 1, flexBasis: 60 };
const flexStyle: FlexStyle = {
  width: 300,
  height: 90,
  flexDirection: "row",
  justifyContent: "space-between",
  gap: 8,
};
const flexProps: FlexProps = {
  children: (
    <>
      <Rectangle
        style={{
          ...flexItem,
          width: 60,
          minWidth: 0,
          height: 70,
          fill: "#0f766e",
        }}
      />
      <Rectangle
        style={{
          ...flexItem,
          width: 60,
          minWidth: 0,
          height: 70,
          fill: "#f97316",
        }}
      />
      <Rectangle
        style={{
          ...flexItem,
          width: 60,
          minWidth: 0,
          height: 70,
          fill: "#7c3aed",
        }}
      />
    </>
  ),
};
const flowStyle: FlowStyle = {
  width: 320,
  height: 220,
  direction: "vertical",
  gap: 12,
  padding: 10,
};
const flowProps: FlowProps = {
  children: (
    <>
      <Rectangle style={{ width: 300, height: 50, fill: "#e11d48" }} />
      <Flex {...flexProps} style={flexStyle} />
    </>
  ),
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = pibbl(canvas, <Flow {...flowProps} style={flowStyle} />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
