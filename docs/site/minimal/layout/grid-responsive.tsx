import {
  Grid,
  Rectangle,
  crc,
  signal,
  type CRCResponsiveStyle,
  type CRCSizeQuery,
  type CRCStyleRule,
  type GridItemStyle,
  type GridProps,
  type GridStyle,
  type GridTrack,
  type RectStyle,
} from "@crc/core";

const columns: readonly GridTrack[] = ["1fr", "2fr"];
const row: GridItemStyle = {
  gridColumnStart: 1,
  gridColumnSpan: 2,
  gridRowStart: 1,
};
const query: CRCSizeQuery = { maxWidth: 280 };
const narrowRule: CRCStyleRule<RectStyle> = {
  query,
  style: { fill: "#f97316" },
};
const responsive: CRCResponsiveStyle<RectStyle> = {
  width: "100%",
  height: "100%",
  fill: "#0f766e",
  when: [narrowRule],
};
const gridStyle: GridStyle = {
  width: 320,
  height: 220,
  gridTemplateColumns: columns,
  gridTemplateRows: [90, 90],
  gap: 8,
  padding: 10,
};
const gridWidth = signal(320);
const gridProps: GridProps = {
  children: (
    <>
      <Rectangle style={{ ...responsive, ...row }} />
      <Rectangle
        style={{
          gridColumnStart: 1,
          gridRowStart: 2,
          width: "100%",
          height: "100%",
          fill: "#7c3aed",
        }}
      />
      <Rectangle
        style={{
          gridColumnStart: 2,
          gridRowStart: 2,
          width: "100%",
          height: "100%",
          fill: "#e11d48",
        }}
      />
    </>
  ),
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const button = document.createElement("button");
button.textContent = "Narrow";
document.body.append(button);
button.addEventListener("click", () => {
  const narrow = gridWidth.get() === 320;
  gridWidth.set(narrow ? 260 : 320);
  button.textContent = narrow ? "Wide" : "Narrow";
});
const app = crc(
  canvas,
  <Grid {...gridProps} style={{ ...gridStyle, width: gridWidth }} />,
);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
