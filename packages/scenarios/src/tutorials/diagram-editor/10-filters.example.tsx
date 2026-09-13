import {
  Absolute,
  Clip,
  crc,
  crcLayoutBox,
  crcRef,
  crcState,
  Fragment,
  Group,
  Layer,
  Path,
  Rectangle,
  Text,
  type BoxStyle,
  type CRCController,
  type CRCNode,
  type CRCPointerEvent,
  type CRCWheelEvent,
  type LayoutItemStyle,
} from "@crc/core";

type NodeId = "idea" | "sketch" | "build" | "ship";
interface Node {
  readonly id: NodeId;
  readonly title: string;
  readonly subtitle: string;
  readonly color: string;
  readonly x: number;
  readonly y: number;
}
interface Edge {
  readonly id: string;
  readonly from: NodeId;
  readonly to: NodeId;
}
interface View {
  readonly panX: number;
  readonly panY: number;
  readonly zoom: number;
}
interface RegionProps {
  readonly style: BoxStyle & LayoutItemStyle;
}
interface Drag {
  readonly kind: "node";
  readonly pointerId: number;
  readonly nodeId: NodeId;
  readonly pointerStart: Point;
  readonly nodeStart: Point;
}
interface Pan {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly pointerStart: Point;
  readonly viewStart: View;
}
interface Point {
  readonly x: number;
  readonly y: number;
}
type Gesture = Drag | Pan;
interface NodeHandlers {
  readonly down: (node: Node, event: CRCPointerEvent) => void;
  readonly move: (event: CRCPointerEvent) => void;
  readonly up: (event: CRCPointerEvent) => void;
  readonly clear: (event: CRCPointerEvent) => void;
}
interface WorkspaceProps extends RegionProps {
  readonly nodes: readonly Node[];
  readonly selected: NodeId | null;
  readonly view: View;
  readonly clearSelection: () => void;
  readonly onWheel: (event: CRCWheelEvent) => void;
  readonly handlers: NodeHandlers;
  readonly panDown: (event: CRCPointerEvent) => void;
  readonly panMove: (event: CRCPointerEvent) => void;
  readonly panUp: (event: CRCPointerEvent) => void;
  readonly panClear: (event: CRCPointerEvent) => void;
}

const NODES: readonly Node[] = [
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
const EDGES: readonly Edge[] = [
  { id: "idea-sketch", from: "idea", to: "sketch" },
  { id: "sketch-build", from: "sketch", to: "build" },
  { id: "sketch-ship", from: "sketch", to: "ship" },
  { id: "build-ship", from: "build", to: "ship" },
] as const;
const INITIAL_VIEW: View = { panX: 0, panY: 0, zoom: 1 };
const WORKSPACE_TOP = 56;
const WIDTH = 168;
const HEIGHT = 84;
function createGridPath(): Path2D {
  const path = new Path2D();
  for (let y = 20; y < 900; y += 24)
    for (let x = 20; x < 1400; x += 24) path.rect(x, y, 2, 2);
  return path;
}
let gridDots: Path2D | undefined;
let workspaceClip: Path2D | undefined;
function getGridDots(): Path2D {
  return (gridDots ??= createGridPath());
}
function getWorkspaceClip(): Path2D {
  if (!workspaceClip) {
    workspaceClip = new Path2D();
    workspaceClip.rect(0, 0, 960, 512);
  }
  return workspaceClip;
}

function toWorkspace(point: Point, view: View): Point {
  return {
    x: (point.x - view.panX) / view.zoom,
    y: (point.y - WORKSPACE_TOP - view.panY) / view.zoom,
  };
}
function zoomAround(view: View, point: Point, deltaY: number): View {
  const anchor = toWorkspace(point, view);
  const zoom = Math.min(
    1.8,
    Math.max(0.6, view.zoom * Math.exp(-deltaY * 0.001)),
  );
  return {
    zoom,
    panX: point.x - anchor.x * zoom,
    panY: point.y - WORKSPACE_TOP - anchor.y * zoom,
  };
}
function curve(from: Point, to: Point): Path2D {
  const path = new Path2D();
  const bend = Math.max(56, Math.abs(to.x - from.x) * 0.5);
  path.moveTo(from.x, from.y);
  path.bezierCurveTo(from.x + bend, from.y, to.x - bend, to.y, to.x, to.y);
  return path;
}
function arrow(point: Point): Path2D {
  const path = new Path2D();
  path.moveTo(point.x, point.y);
  path.lineTo(point.x - 14, point.y - 7);
  path.lineTo(point.x - 14, point.y + 7);
  path.closePath();
  return path;
}

function Card({
  node,
  selected,
  handlers,
}: Readonly<{
  node: Node;
  selected: boolean;
  handlers: NodeHandlers;
}>): CRCNode {
  const cardPaint = (
    <Fragment>
      <Rectangle
        onPointerDown={(event) => handlers.down(node, event)}
        onPointerMove={handlers.move}
        onPointerUp={handlers.up}
        onPointerCancel={handlers.clear}
        onLostPointerCapture={handlers.clear}
        style={{
          width: WIDTH,
          height: HEIGHT,
          fill: node.color,
          stroke: "#17211d",
          strokeWidth: selected ? 5 : 3,
          cornerRadius: 16,
          cursor: "pointer",
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
    </Fragment>
  );
  return (
    <Group
      style={{
        translateX: node.x,
        translateY: node.y,
        filter: selected
          ? {
              type: "dropShadow",
              offsetX: 6,
              offsetY: 8,
              blurRadius: 10,
              color: "rgb(23 33 29 / 35%)",
            }
          : [],
      }}
    >
      {cardPaint}
    </Group>
  );
}
function Connection({
  edge,
  nodes,
}: Readonly<{ edge: Edge; nodes: readonly Node[] }>): CRCNode {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) throw new Error(`Unknown node in edge "${edge.id}".`);
  const start = { x: from.x + WIDTH, y: from.y + HEIGHT / 2 };
  const end = { x: to.x, y: to.y + HEIGHT / 2 };
  return (
    <Fragment>
      <Path
        pointerEvents="none"
        style={{ d: curve(start, end), stroke: "#17211d", strokeWidth: 4 }}
      />
      <Path pointerEvents="none" style={{ d: arrow(end), fill: "#17211d" }} />
    </Fragment>
  );
}
function Toolbar({
  style: _style,
  reset,
}: RegionProps & Readonly<{ reset: () => void }>): CRCNode {
  const box = crcLayoutBox();
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
      Drag to pan · Wheel to zoom
    </Text>,
    <Rectangle
      onClick={reset}
      onPointerDown={reset}
      style={{
        x: 820,
        y: 12,
        width: 116,
        height: 32,
        fill: "#eef2e8",
        stroke: "#17211d",
        strokeWidth: 2,
        cornerRadius: 8,
        cursor: "pointer",
      }}
    />,
    <Text
      pointerEvents="none"
      style={{
        x: 878,
        y: 33,
        fill: "#17211d",
        font: "800 12px sans-serif",
        textAlign: "center",
      }}
    >
      RESET VIEW
    </Text>,
  ];
}
function Workspace({
  style: _style,
  nodes,
  selected,
  view,
  clearSelection,
  onWheel,
  handlers,
  panDown,
  panMove,
  panUp,
  panClear,
}: WorkspaceProps): CRCNode {
  const box = crcLayoutBox();
  return (
    <Clip
      style={{ d: getWorkspaceClip(), width: 960, height: 512 }}
      onWheel={onWheel}
    >
      <Rectangle
        onClick={clearSelection}
        onPointerDown={panDown}
        onPointerMove={panMove}
        onPointerUp={panUp}
        onPointerCancel={panClear}
        onLostPointerCapture={panClear}
        style={{
          width: box.width,
          height: box.height,
          fill: "#eef2e8",
          cursor: "grab",
        }}
      />
      <Group
        style={{
          translateX: view.panX / view.zoom,
          translateY: view.panY / view.zoom,
          scaleX: view.zoom,
          scaleY: view.zoom,
        }}
      >
        <Layer style={{ width: 1400, height: 900 }}>
          <Path
            pointerEvents="none"
            style={{ d: getGridDots(), fill: "#c8d2c6" }}
          />
        </Layer>
        {EDGES.map((edge) => (
          <Connection key={edge.id} edge={edge} nodes={nodes} />
        ))}
        {nodes.map((node) => (
          <Card
            key={node.id}
            node={node}
            selected={node.id === selected}
            handlers={handlers}
          />
        ))}
      </Group>
    </Clip>
  );
}
function Status({
  style: _style,
  selected,
  view,
}: RegionProps &
  Readonly<{ selected: Node | undefined; view: View }>): CRCNode {
  const box = crcLayoutBox();
  const message = selected ? `SELECTED · ${selected.title}` : "NO SELECTION";
  return [
    <Rectangle
      style={{ width: box.width, height: box.height, fill: "#17211d" }}
    />,
    <Text
      pointerEvents="none"
      style={{ x: 20, y: 21, fill: "#fffdf6", font: "700 12px monospace" }}
    >
      {message}
    </Text>,
    <Text
      pointerEvents="none"
      style={{
        x: 940,
        y: 21,
        fill: "#fffdf6",
        font: "700 12px monospace",
        textAlign: "right",
      }}
    >
      ZOOM · {Math.round(view.zoom * 100)}%
    </Text>,
  ];
}
function Editor(): CRCNode {
  const [nodes, setNodes] = crcState<readonly Node[]>(NODES);
  const [selected, setSelected] = crcState<NodeId | null>("sketch");
  const [view, setView] = crcState<View>(INITIAL_VIEW);
  const gesture = crcRef<Gesture | null>(null);
  const clear = (event: CRCPointerEvent): void => {
    if (gesture.current?.pointerId === event.pointerId) gesture.current = null;
  };
  const handlers: NodeHandlers = {
    down(node, event) {
      const pointerStart = toWorkspace(event, view);
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        kind: "node",
        pointerId: event.pointerId,
        nodeId: node.id,
        pointerStart,
        nodeStart: { x: node.x, y: node.y },
      };
      setSelected(node.id);
    },
    move(event) {
      const session = gesture.current;
      if (
        !session ||
        session.kind !== "node" ||
        session.pointerId !== event.pointerId
      )
        return;
      const point = toWorkspace(event, view);
      setNodes((current) =>
        current.map((node) =>
          node.id === session.nodeId
            ? {
                ...node,
                x: session.nodeStart.x + point.x - session.pointerStart.x,
                y: session.nodeStart.y + point.y - session.pointerStart.y,
              }
            : node,
        ),
      );
    },
    up(event) {
      if (gesture.current?.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
      gesture.current = null;
    },
    clear,
  };
  const panDown = (event: CRCPointerEvent): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      kind: "pan",
      pointerId: event.pointerId,
      pointerStart: { x: event.x, y: event.y },
      viewStart: view,
    };
  };
  const panMove = (event: CRCPointerEvent): void => {
    const session = gesture.current;
    if (
      !session ||
      session.kind !== "pan" ||
      session.pointerId !== event.pointerId
    )
      return;
    setView({
      ...session.viewStart,
      panX: session.viewStart.panX + event.x - session.pointerStart.x,
      panY: session.viewStart.panY + event.y - session.pointerStart.y,
    });
  };
  const panUp = (event: CRCPointerEvent): void => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current = null;
  };
  const selectedNode = nodes.find((node) => node.id === selected);
  return (
    <Absolute style={{ width: 960, height: 600 }}>
      <Toolbar
        style={{ left: 0, top: 0, width: "100%", height: 56 }}
        reset={() => setView(INITIAL_VIEW)}
      />
      <Workspace
        style={{ left: 0, top: 56, width: "100%", height: 512 }}
        nodes={nodes}
        selected={selected}
        view={view}
        clearSelection={() => setSelected(null)}
        onWheel={(event) => {
          event.preventDefault();
          setView((current) => zoomAround(current, event, event.deltaY));
        }}
        handlers={handlers}
        panDown={panDown}
        panMove={panMove}
        panUp={panUp}
        panClear={clear}
      />
      <Status
        style={{ left: 0, top: 568, width: "100%", height: 32 }}
        selected={selectedNode}
        view={view}
      />
    </Absolute>
  );
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Editor />);
}
