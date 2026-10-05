import { pibbl, Path, PathGeometry, Circle, Line, Rectangle, Text, useConst, useSignal, useRef, type PibblController, type PibblPointerEvent, type PathQuadCorners, type PathQuadMode, transformPath, quadTransform } from '@pibbl/core';


const source = { x: 0, y: 0, width: 240, height: 300 };
const initial: PathQuadCorners = {
  topLeft: { x: 425, y: 156 },
  topRight: { x: 735, y: 126 },
  bottomLeft: { x: 380, y: 464 },
  bottomRight: { x: 776, y: 444 },
};
const names = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;
const labels = ["TOP LEFT", "TOP RIGHT", "BOTTOM RIGHT", "BOTTOM LEFT"];

/** An asymmetric compound outline: the porthole winds opposite the hull. */
function rocket() {
  const hull = new PathGeometry();
  hull.moveTo(120, 20);
  hull.bezierCurveTo(155, 42, 174, 94, 170, 153);
  hull.lineTo(211, 198);
  hull.lineTo(220, 240);
  hull.lineTo(160, 211);
  hull.quadraticCurveTo(145, 230, 92, 220);
  hull.lineTo(40, 247);
  hull.lineTo(53, 191);
  hull.lineTo(80, 157);
  hull.bezierCurveTo(77, 92, 86, 48, 120, 20);
  hull.closePath();
  hull.moveTo(143, 111);
  hull.arc(120, 111, 23, 0, -Math.PI * 2, true);
  hull.closePath();
  const stripe = new PathGeometry();
  stripe.moveTo(89, 173);
  stripe.quadraticCurveTo(127, 186, 167, 168);
  stripe.lineTo(164, 186);
  stripe.quadraticCurveTo(127, 203, 90, 190);
  stripe.closePath();
  const flame = new PathGeometry();
  flame.moveTo(99, 232);
  flame.bezierCurveTo(77, 265, 119, 275, 117, 296);
  flame.bezierCurveTo(152, 267, 152, 247, 143, 232);
  flame.closePath();
  const shine = new PathGeometry();
  shine.moveTo(105, 64);
  shine.quadraticCurveTo(94, 80, 94, 119);
  const grid = new PathGeometry();
  for (let i = 0; i <= 6; i++) {
    grid.moveTo(i * 40, 0);
    grid.lineTo(i * 40, 300);
    grid.moveTo(0, i * 50);
    grid.lineTo(240, i * 50);
  }
  return [grid, flame, hull, stripe, shine];
}

function WarpStudy() {
  const original = useConst(rocket);
  const transform = (corners: PathQuadCorners, mode: PathQuadMode) =>
    original.map((path) =>
      transformPath(path, quadTransform({ source, destination: corners, mode }), { tolerance: 0.3, maxSegments: 20_000 }),
    );
  const state = useSignal(
    useConst(() => ({
      corners: initial,
      mode: "bilinear" as PathQuadMode,
      paths: transform(initial, "bilinear"),
      error: "",
    })),
  );
  const update = (corners: PathQuadCorners, mode: PathQuadMode) => {
    try {
      state.set({ corners, mode, paths: transform(corners, mode), error: "" });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      state.set({
        corners,
        mode,
        paths: state.get().paths,
        error:
          mode === "perspective"
            ? "Keep corners convex, or try Bilinear."
            : "Move corners closer to the canvas.",
      });
    }
  };
  const drag = useRef<{
    pointerId: number;
    corner: keyof PathQuadCorners;
  } | null>(null);
  const reference = useConst(() => {
    const path = original[2].clone();
    path.transform({ a: 0.55, d: 0.55, e: 85, f: 220 });
    return path;
  });
  const current = state.get();
  const stop = (event: PibblPointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const label = (
    value: string,
    x: number,
    y: number,
    font = "11px monospace",
    fill = "#8d99b9",
  ) => (
    <Text style={{ left: x, top: y, font, fill }} pointerEvents="none">
      {value}
    </Text>
  );
  return (
    <>
      <Rectangle
        style={{ width: 900, height: 580, fill: "#0c1223" }}
        pointerEvents="none"
      />
      {Array.from({ length: 46 }, (_, i) => (
        <Circle
          key={i}
          style={{
            cx: 28 + ((i * 173) % 845),
            cy: 115 + ((i * 97) % 390),
            radius: i % 3 === 0 ? 1.4 : 0.7,
            fill: i % 3 === 0 ? "#677896" : "#2d3b54",
          }}
          pointerEvents="none"
        />
      ))}
      {label("Pibbl / GEOMETRY LAB", 30, 24, "11px monospace", "#8df0d1")}
      {label(
        "Bend the flight plan.",
        28,
        47,
        "bold 32px sans-serif",
        "#f0f0ff",
      )}
      {label(
        "Four corners. One continuous transformation.",
        30,
        91,
        "13px sans-serif",
      )}
      <Line
        style={{
          coords: [
            [30, 122],
            [298, 122],
          ],
          stroke: "#29334b",
          strokeWidth: 1,
        }}
        pointerEvents="none"
      />
      {label("01 / ORIGINAL", 32, 164)}
      {label(
        "A little rocket. A lot of possibility.",
        32,
        188,
        "12px sans-serif",
      )}
      <Rectangle
        style={{
          left: 85,
          top: 220,
          width: 132,
          height: 165,
          stroke: "#35425e",
          strokeWidth: 1,
        }}
        pointerEvents="none"
      />
      <Path
        style={{
          d: reference,
          fill: "#34425d",
          stroke: "#6c7d9f",
          strokeWidth: 1,
        }}
        pointerEvents="none"
      />
      {label("240 × 300 / LOCAL SPACE", 62, 409, "10px monospace")}
      {label("02 / WARPED", 380, 86, "11px monospace", "#8df0d1")}
      <Path
        style={{ d: current.paths[0], stroke: "#223951", strokeWidth: 1 }}
        pointerEvents="none"
      />
      <Path
        style={{
          d: current.paths[1],
          fill: "#ff916c",
          stroke: "#ffc49f",
          strokeWidth: 1.5,
        }}
        pointerEvents="none"
      />
      <Path
        style={{
          d: current.paths[2],
          fill: "#c8bcff",
          stroke: "#eee8ff",
          strokeWidth: 2,
        }}
        pointerEvents="none"
      />
      <Path
        style={{ d: current.paths[3], fill: "#8772dd" }}
        pointerEvents="none"
      />
      <Path
        style={{ d: current.paths[4], stroke: "#ffffff", strokeWidth: 3 }}
        pointerEvents="none"
      />
      <Line
        style={{
          coords: [...names, names[0]].map(
            (name) =>
              [current.corners[name].x, current.corners[name].y] as const,
          ),
          stroke: "#528d89",
          strokeWidth: 1,
        }}
        pointerEvents="none"
      />
      {names.map((name, i) => {
        const p = current.corners[name];
        return label(
          labels[i],
          p.x - 24,
          p.y + (i < 2 ? -28 : 22),
          "9px monospace",
          "#a5d9cf",
        );
      })}
      {names.map((name) => {
        const p = current.corners[name];
        return (
          <>
            <Circle
              key={`${name}-halo`}
              style={{ cx: p.x, cy: p.y, radius: 15, fill: "#163b42" }}
              pointerEvents="none"
            />
            <Circle
              key={name}
              style={{
                cx: p.x,
                cy: p.y,
                radius: 8,
                fill: "#8df0d1",
                stroke: "#e5fff7",
                strokeWidth: 2,
                cursor: "grab",
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { pointerId: event.pointerId, corner: name };
              }}
              onPointerMove={(event) => {
                if (
                  drag.current?.pointerId !== event.pointerId ||
                  drag.current.corner !== name
                )
                  return;
                const corners = {
                  ...state.get().corners,
                  [name]: { x: event.x, y: event.y },
                };
                update(corners, state.get().mode);
              }}
              onPointerUp={stop}
              onPointerCancel={stop}
              onLostPointerCapture={() => {
                drag.current = null;
              }}
            />
          </>
        );
      })}
      {(["bilinear", "perspective"] as const).map((mode, i) => (
        <>
          <Rectangle
            key={mode}
            style={{
              left: 30 + i * 126,
              top: 434,
              width: 118,
              height: 32,
              fill: current.mode === mode ? "#8df0d1" : "#202c43",
              cursor: "pointer",
            }}
            onClick={() => update(state.get().corners, mode)}
          />
          {label(
            mode === "bilinear" ? "Bilinear" : "Perspective",
            45 + i * 126,
            444,
            "12px sans-serif",
            current.mode === mode ? "#102d2a" : "#d6ddf1",
          )}
        </>
      ))}
      {label(
        current.mode === "bilinear"
          ? "BILINEAR / RUBBER SHEET"
          : "PERSPECTIVE / PROJECTED",
        32,
        479,
        "10px monospace",
        "#8df0d1",
      )}
      {current.error && (
        <>
          <Rectangle
            style={{
              left: 340,
              top: 490,
              width: 515,
              height: 20,
              fill: "#492d32",
            }}
            pointerEvents="none"
          />
          {label(
            "PREVIOUS VALID PREVIEW",
            350,
            495,
            "9px monospace",
            "#ffc2a3",
          )}
          {label(current.error, 546, 495, "10px sans-serif", "#ffe2d2")}
        </>
      )}
      <Rectangle
        style={{ left: 30, top: 512, width: 840, height: 44, fill: "#151e32" }}
        pointerEvents="none"
      />
      {label("DRAG THE MINT HANDLES", 46, 528, "10px monospace", "#e3e8fa")}
      {label(
        `${current.paths.reduce((sum, path) => sum + path.segmentCount, 0)} segments · 0.3 tolerance`,
        294,
        528,
        "10px monospace",
      )}
      <Rectangle
        style={{
          left: 758,
          top: 520,
          width: 94,
          height: 28,
          fill: "#293651",
          cursor: "pointer",
        }}
        onClick={() => update(initial, "bilinear")}
      />
      {label("RESET ↗", 779, 528, "10px monospace", "#e3e8fa")}
    </>
  );
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <WarpStudy />);
}
