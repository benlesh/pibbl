import {
  crc,
  Group,
  Path,
  Rectangle,
  Text,
  type CRCController,
} from "@crc/core";

const WORKSPACE_TOP = 56;

function connectionPath(
  from: Readonly<{ x: number; y: number }>,
  to: Readonly<{ x: number; y: number }>,
): Path2D {
  const path = new Path2D();
  const bend = Math.max(56, Math.abs(to.x - from.x) * 0.5);
  path.moveTo(from.x, from.y);
  path.bezierCurveTo(from.x + bend, from.y, to.x - bend, to.y, to.x, to.y);
  return path;
}

function arrowheadPath(point: Readonly<{ x: number; y: number }>): Path2D {
  const path = new Path2D();
  path.moveTo(point.x, point.y);
  path.lineTo(point.x - 14, point.y - 7);
  path.lineTo(point.x - 14, point.y + 7);
  path.closePath();
  return path;
}

function DiagramEditor() {
  const ideaPort = { x: 260, y: 222 + WORKSPACE_TOP };
  const sketchPort = { x: 326, y: 134 + WORKSPACE_TOP };

  return [
    <Rectangle style={{ width: 960, height: 56, fill: "#fffdf6" }} />,
    <Text
      pointerEvents="none"
      style={{ x: 24, y: 34, fill: "#17211d", font: "900 22px sans-serif" }}
    >
      WORKFLOW MAP
    </Text>,
    <Rectangle
      style={{ x: 0, y: 56, width: 960, height: 512, fill: "#eef2e8" }}
    />,
    <Path
      pointerEvents="none"
      style={{
        d: connectionPath(ideaPort, sketchPort),
        stroke: "#17211d",
        strokeWidth: 4,
      }}
    />,
    <Path
      pointerEvents="none"
      style={{ d: arrowheadPath(sketchPort), fill: "#17211d" }}
    />,
    <Group style={{ translateX: 92, translateY: 236 }}>
      <Rectangle
        style={{
          width: 168,
          height: 84,
          fill: "#ff6b57",
          stroke: "#17211d",
          strokeWidth: 3,
          cornerRadius: 16,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 84,
          y: 34,
          fill: "#17211d",
          font: "900 18px sans-serif",
          textAlign: "center",
        }}
      >
        IDEA
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 84,
          y: 59,
          fill: "#17211d",
          font: "700 12px sans-serif",
          textAlign: "center",
        }}
      >
        Find the spark
      </Text>
      <Rectangle
        pointerEvents="none"
        style={{
          x: -5,
          y: 37,
          width: 10,
          height: 10,
          fill: "#fffdf6",
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 5,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          x: 163,
          y: 37,
          width: 10,
          height: 10,
          fill: "#fffdf6",
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 5,
        }}
      />
    </Group>,
    <Group style={{ translateX: 326, translateY: 148 }}>
      <Rectangle
        style={{
          width: 168,
          height: 84,
          fill: "#f7c948",
          stroke: "#17211d",
          strokeWidth: 3,
          cornerRadius: 16,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 84,
          y: 34,
          fill: "#17211d",
          font: "900 18px sans-serif",
          textAlign: "center",
        }}
      >
        SKETCH
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 84,
          y: 59,
          fill: "#17211d",
          font: "700 12px sans-serif",
          textAlign: "center",
        }}
      >
        Shape the flow
      </Text>
      <Rectangle
        pointerEvents="none"
        style={{
          x: -5,
          y: 37,
          width: 10,
          height: 10,
          fill: "#fffdf6",
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 5,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          x: 163,
          y: 37,
          width: 10,
          height: 10,
          fill: "#fffdf6",
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 5,
        }}
      />
    </Group>,
    <Rectangle
      style={{ x: 0, y: 568, width: 960, height: 32, fill: "#17211d" }}
    />,
    <Text
      pointerEvents="none"
      style={{ x: 20, y: 589, fill: "#fffdf6", font: "700 12px monospace" }}
    >
      READY · 100%
    </Text>,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <DiagramEditor />);
}
