import {
  Absolute,
  crc,
  useLayoutBox,
  Fragment,
  Group,
  Path,
  Rectangle,
  Text,
  type BoxStyle,
  type CRCController,
  type CRCNode,
  type LayoutItemStyle,
} from "@crc/core";

type NodeId = "idea" | "sketch" | "build" | "ship";

interface DiagramNode {
  readonly id: NodeId;
  readonly title: string;
  readonly subtitle: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
}

interface DiagramEdge {
  readonly id: string;
  readonly from: NodeId;
  readonly to: NodeId;
}

interface ViewTransform {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}

interface RegionProps {
  readonly style: BoxStyle & LayoutItemStyle;
}

const INITIAL_NODES: readonly DiagramNode[] = [
  {
    id: "idea",
    title: "IDEA",
    subtitle: "Find the spark",
    color: "#ff6b57",
    x: 92,
    y: 180,
  },
  {
    id: "sketch",
    title: "SKETCH",
    subtitle: "Shape the flow",
    color: "#f7c948",
    x: 326,
    y: 92,
  },
  {
    id: "build",
    title: "BUILD",
    subtitle: "Make it real",
    color: "#74d3ae",
    x: 392,
    y: 318,
  },
  {
    id: "ship",
    title: "SHIP",
    subtitle: "Share the work",
    color: "#1f4bd8",
    x: 696,
    y: 210,
  },
] as const;

const EDGES: readonly DiagramEdge[] = [
  { id: "idea-sketch", from: "idea", to: "sketch" },
  { id: "sketch-build", from: "sketch", to: "build" },
  { id: "sketch-ship", from: "sketch", to: "ship" },
  { id: "build-ship", from: "build", to: "ship" },
] as const;

const INITIAL_VIEW: ViewTransform = { panX: 0, panY: 0, zoom: 1 };
const WORKSPACE_TOP = 56;
const WORKSPACE_HEIGHT = 512;
const NODE_WIDTH = 168;
const NODE_HEIGHT = 84;

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

function NodeCard({ node }: Readonly<{ node: DiagramNode }>): CRCNode {
  return (
    <Group style={{ translateX: node.x, translateY: node.y }}>
      <Rectangle
        style={{
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          fill: node.color,
          stroke: "#17211d",
          strokeWidth: 3,
          cornerRadius: 16,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          x: -5,
          y: 37,
          width: 10,
          height: 10,
          fill: "#17211d",
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
          fill: "#17211d",
          cornerRadius: 5,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 84,
          y: 34,
          fill: "#17211d",
          font: "900 16px sans-serif",
          textAlign: "center",
        }}
      >
        {node.title}
      </Text>
      <Text
        pointerEvents="none"
        style={{
          x: 84,
          y: 59,
          fill: "#17211d",
          font: "600 13px sans-serif",
          textAlign: "center",
        }}
      >
        {node.subtitle}
      </Text>
    </Group>
  );
}

function Connection({ edge }: Readonly<{ edge: DiagramEdge }>): CRCNode {
  const from = INITIAL_NODES.find((node) => node.id === edge.from);
  const to = INITIAL_NODES.find((node) => node.id === edge.to);
  if (!from || !to) throw new Error(`Unknown node in edge "${edge.id}".`);
  const fromPort = { x: from.x + NODE_WIDTH, y: from.y + NODE_HEIGHT / 2 };
  const toPort = { x: to.x, y: to.y + NODE_HEIGHT / 2 };
  return (
    <Fragment>
      <Path
        pointerEvents="none"
        style={{
          d: connectionPath(fromPort, toPort),
          stroke: "#17211d",
          strokeWidth: 4,
        }}
      />
      <Path
        pointerEvents="none"
        style={{ d: arrowheadPath(toPort), fill: "#17211d" }}
      />
    </Fragment>
  );
}

function Toolbar({ style: _specifiedStyle }: RegionProps): CRCNode {
  const box = useLayoutBox();
  return [
    <Rectangle
      style={{ width: box.width, height: box.height, fill: "#fffdf6" }}
    />,
    <Text
      pointerEvents="none"
      style={{ x: 24, y: 34, fill: "#17211d", font: "900 22px sans-serif" }}
    >
      WORKFLOW MAP
    </Text>,
    <Text
      pointerEvents="none"
      style={{ x: 250, y: 32, fill: "#667066", font: "600 13px sans-serif" }}
    >
      Arrange the next great thing
    </Text>,
    <Rectangle
      pointerEvents="none"
      style={{
        x: 820,
        y: 12,
        width: 116,
        height: 32,
        fill: "#eef2e8",
        stroke: "#17211d",
        strokeWidth: 2,
        cornerRadius: 8,
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        x: 878,
        y: 28,
        fill: "#17211d",
        font: "800 12px sans-serif",
        textAlign: "center",
        textBaseline: "middle",
      }}
    >
      RESET VIEW
    </Text>,
  ];
}

function Workspace({ style: _specifiedStyle }: RegionProps): CRCNode {
  const box = useLayoutBox();
  return [
    <Rectangle
      style={{ width: box.width, height: box.height, fill: "#eef2e8" }}
    />,
    <Fragment>
      {EDGES.map((edge) => (
        <Connection key={edge.id} edge={edge} />
      ))}
      {INITIAL_NODES.map((node) => (
        <NodeCard key={node.id} node={node} />
      ))}
    </Fragment>,
  ];
}

function StatusBar({ style: _specifiedStyle }: RegionProps): CRCNode {
  const box = useLayoutBox();
  return [
    <Rectangle
      style={{ width: box.width, height: box.height, fill: "#17211d" }}
    />,
    <Text
      pointerEvents="none"
      style={{ x: 20, y: 21, fill: "#fffdf6", font: "700 12px monospace" }}
    >
      READY · {Math.round(INITIAL_VIEW.zoom * 100)}%
    </Text>,
  ];
}

function DiagramEditor(): CRCNode {
  return (
    <Absolute style={{ width: 960, height: 600 }}>
      <Toolbar style={{ left: 0, top: 0, width: "100%", height: 56 }} />
      <Workspace
        style={{
          left: 0,
          top: WORKSPACE_TOP,
          width: "100%",
          height: WORKSPACE_HEIGHT,
        }}
      />
      <StatusBar style={{ left: 0, top: 568, width: "100%", height: 32 }} />
    </Absolute>
  );
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <DiagramEditor />);
}
