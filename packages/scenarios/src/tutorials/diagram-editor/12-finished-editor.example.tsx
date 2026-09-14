import {
  Absolute,
  Clip,
  crc,
  crcEventTarget,
  crcLayoutBox,
  crcMemo,
  crcRectPath,
  crcRef,
  crcState,
  FocusManagement,
  Fragment,
  Group,
  KeyboardNavigation,
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
interface Point {
  readonly x: number;
  readonly y: number;
}
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
interface NodeDragSession {
  readonly kind: "node";
  readonly pointerId: number;
  readonly nodeId: NodeId;
  readonly pointerStart: Point;
  readonly nodeStart: Point;
}
interface PanSession {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly pointerStart: Point;
  readonly viewStart: ViewTransform;
}

function rootToWorkspace(point: Point, view: ViewTransform): Point {
  return {
    x: (point.x - view.panX) / view.zoom,
    y: (point.y - WORKSPACE_TOP - view.panY) / view.zoom,
  };
}
function zoomAroundPoint(
  view: ViewTransform,
  point: Point,
  deltaY: number,
): ViewTransform {
  const anchor = rootToWorkspace(point, view);
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
function updateNodePosition(
  nodes: readonly DiagramNode[],
  id: NodeId,
  point: Readonly<{ x: number; y: number }>,
): readonly DiagramNode[] {
  return nodes.map((node) =>
    node.id === id ? { ...node, x: point.x, y: point.y } : node,
  );
}
function createGridPath(): Path2D {
  const path = new Path2D();
  for (let y = 20; y < 900; y += 24)
    for (let x = 20; x < 1400; x += 24) path.rect(x, y, 2, 2);
  return path;
}
function createWorkspaceClip(): Path2D {
  const path = new Path2D();
  path.rect(0, 0, 960, WORKSPACE_HEIGHT);
  return path;
}
function connectionPath(from: Point, to: Point): Path2D {
  const path = new Path2D();
  const bend = Math.max(56, Math.abs(to.x - from.x) * 0.5);
  path.moveTo(from.x, from.y);
  path.bezierCurveTo(from.x + bend, from.y, to.x - bend, to.y, to.x, to.y);
  return path;
}
function arrowheadPath(point: Point): Path2D {
  const path = new Path2D();
  path.moveTo(point.x, point.y);
  path.lineTo(point.x - 14, point.y - 7);
  path.lineTo(point.x - 14, point.y + 7);
  path.closePath();
  return path;
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
];
const EDGES: readonly DiagramEdge[] = [
  { id: "idea-sketch", from: "idea", to: "sketch" },
  { id: "sketch-build", from: "sketch", to: "build" },
  { id: "sketch-ship", from: "sketch", to: "ship" },
  { id: "build-ship", from: "build", to: "ship" },
];
const INITIAL_VIEW: ViewTransform = { panX: 0, panY: 0, zoom: 1 };
const WORKSPACE_TOP = 56;
const WORKSPACE_HEIGHT = 512;
const NODE_WIDTH = 168;
const NODE_HEIGHT = 84;

function FocusRing({
  width,
  height,
  x = 0,
  y = 0,
}: Readonly<{
  width: number;
  height: number;
  x?: number;
  y?: number;
}>): CRCNode {
  return (
    <Fragment>
      <Rectangle
        pointerEvents="none"
        style={{
          x: x - 7,
          y: y - 7,
          width: width + 14,
          height: height + 14,
          stroke: "#fffdf6",
          strokeWidth: 3,
          cornerRadius: 21,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          x: x - 3,
          y: y - 3,
          width: width + 6,
          height: height + 6,
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 19,
        }}
      />
    </Fragment>
  );
}
function FocusVisual({ visible }: Readonly<{ visible: boolean }>): CRCNode {
  return visible ? (
    <FocusRing width={NODE_WIDTH} height={NODE_HEIGHT} />
  ) : (
    <Fragment />
  );
}
function NodeCard({
  node,
  selected,
  onSelect,
  onMove,
  view,
}: Readonly<{
  node: DiagramNode;
  selected: boolean;
  onSelect: () => void;
  onMove: (id: NodeId, point: Point) => void;
  view: ViewTransform;
}>): CRCNode {
  const dragSession = crcRef<NodeDragSession | null>(null);
  const [dragActive, setDragActive] = crcState(false);
  const finishDrag = (event: CRCPointerEvent): void => {
    if (dragSession.current?.pointerId !== event.pointerId) return;
    dragSession.current = null;
    setDragActive(false);
  };
  const onPointerDown = (event: CRCPointerEvent): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSession.current = {
      kind: "node",
      pointerId: event.pointerId,
      nodeId: node.id,
      pointerStart: rootToWorkspace(event, view),
      nodeStart: { x: node.x, y: node.y },
    };
    setDragActive(true);
    onSelect();
  };
  const onPointerMove = (event: CRCPointerEvent): void => {
    const session = dragSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const point = rootToWorkspace(event, view);
    onMove(session.nodeId, {
      x: session.nodeStart.x + point.x - session.pointerStart.x,
      y: session.nodeStart.y + point.y - session.pointerStart.y,
    });
  };
  const onPointerUp = (event: CRCPointerEvent): void => {
    if (dragSession.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag(event);
  };
  return (
    <Group style={{ translateX: node.x, translateY: node.y }}>
      <NodePaint node={node} selected={selected} />
      <NodeTarget
        dragActive={dragActive}
        onClick={onSelect}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
      />
    </Group>
  );
}
function NodePaint({
  node,
  selected,
}: Readonly<{ node: DiagramNode; selected: boolean }>): CRCNode {
  return (
    <Group
      style={{
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
      <Rectangle
        pointerEvents="none"
        style={{
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          fill: node.color,
          stroke: "#17211d",
          strokeWidth: selected ? 5 : 3,
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
function NodeTarget({
  dragActive,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
}: Readonly<{
  dragActive: boolean;
  onClick: () => void;
  onPointerDown: (event: CRCPointerEvent) => void;
  onPointerMove: (event: CRCPointerEvent) => void;
  onPointerUp: (event: CRCPointerEvent) => void;
  onPointerCancel: (event: CRCPointerEvent) => void;
  onLostPointerCapture: (event: CRCPointerEvent) => void;
}>): CRCNode {
  const target = crcEventTarget(
    {
      onClick,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
    },
    {
      path: crcRectPath(0, 0, NODE_WIDTH, NODE_HEIGHT, { cornerRadius: 16 }),
      fill: true,
      cursor: dragActive ? "grabbing" : "grab",
      keyboardNavigationBounds: {
        x: 0,
        y: 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
    },
  );
  return <FocusVisual visible={target.isFocusVisible} />;
}
function Connection({
  edge,
  nodes,
}: Readonly<{ edge: DiagramEdge; nodes: readonly DiagramNode[] }>): CRCNode {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) throw new Error(`Unknown node in edge "${edge.id}".`);
  const start = { x: from.x + NODE_WIDTH, y: from.y + NODE_HEIGHT / 2 };
  const end = { x: to.x, y: to.y + NODE_HEIGHT / 2 };
  return (
    <Fragment>
      <Path
        pointerEvents="none"
        style={{
          d: connectionPath(start, end),
          stroke: "#17211d",
          strokeWidth: 4,
        }}
      />
      <Path
        pointerEvents="none"
        style={{ d: arrowheadPath(end), fill: "#17211d" }}
      />
    </Fragment>
  );
}
function GridLayer(): CRCNode {
  const dots = crcMemo(() => createGridPath(), []);
  return (
    <Layer style={{ width: 1400, height: 900 }}>
      <Path pointerEvents="none" style={{ d: dots, fill: "#c8d2c6" }} />
    </Layer>
  );
}
function ResetPaint(): CRCNode {
  return (
    <Fragment>
      <Rectangle
        pointerEvents="none"
        style={{
          width: 116,
          height: 32,
          fill: "#eef2e8",
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 8,
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          x: 58,
          y: 21,
          fill: "#17211d",
          font: "800 12px sans-serif",
          textAlign: "center",
        }}
      >
        RESET VIEW
      </Text>
    </Fragment>
  );
}
function ResetTarget({ reset }: Readonly<{ reset: () => void }>): CRCNode {
  const target = crcEventTarget(
    { onClick: reset },
    {
      path: crcRectPath(0, 0, 116, 32, { cornerRadius: 8 }),
      fill: true,
      cursor: "pointer",
      keyboardNavigationBounds: { x: 0, y: 0, width: 116, height: 32 },
    },
  );
  return target.isFocusVisible ? (
    <FocusRing width={116} height={32} />
  ) : (
    <Fragment />
  );
}
function ResetView({ reset }: Readonly<{ reset: () => void }>): CRCNode {
  return (
    <Group style={{ translateX: 820, translateY: 12 }}>
      <ResetPaint />
      <ResetTarget reset={reset} />
    </Group>
  );
}
function Toolbar({
  style: _style,
  reset,
}: RegionProps & Readonly<{ reset: () => void }>): CRCNode {
  const box = crcLayoutBox();
  return (
    <Fragment>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#fffdf6" }}
      />
      <Text
        pointerEvents="none"
        style={{ x: 24, y: 34, fill: "#17211d", font: "900 22px sans-serif" }}
      >
        WORKFLOW MAP
      </Text>
      <Text
        pointerEvents="none"
        style={{ x: 250, y: 32, fill: "#667066", font: "600 13px sans-serif" }}
      >
        DRAG NODES · DRAG SPACE · WHEEL TO ZOOM
      </Text>
      <ResetView reset={reset} />
    </Fragment>
  );
}
function Workspace({
  style: _style,
  nodes,
  selectedNodeId,
  view,
  onSelect,
  onMove,
  onViewChange,
  onWheel,
}: RegionProps &
  Readonly<{
    nodes: readonly DiagramNode[];
    selectedNodeId: NodeId | null;
    view: ViewTransform;
    onSelect: (id: NodeId | null) => void;
    onMove: (id: NodeId, point: Point) => void;
    onViewChange: (view: ViewTransform) => void;
    onWheel: (event: CRCWheelEvent) => void;
  }>): CRCNode {
  const box = crcLayoutBox();
  const panSession = crcRef<PanSession | null>(null);
  const [panning, setPanning] = crcState(false);
  const finishPan = (event: CRCPointerEvent): void => {
    if (panSession.current?.pointerId !== event.pointerId) return;
    panSession.current = null;
    setPanning(false);
  };
  const onPointerDown = (event: CRCPointerEvent): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    panSession.current = {
      kind: "pan",
      pointerId: event.pointerId,
      pointerStart: { x: event.x, y: event.y },
      viewStart: view,
    };
    setPanning(true);
  };
  const onPointerMove = (event: CRCPointerEvent): void => {
    const session = panSession.current;
    if (!session || session.pointerId !== event.pointerId) return;
    onViewChange({
      ...session.viewStart,
      panX: session.viewStart.panX + event.x - session.pointerStart.x,
      panY: session.viewStart.panY + event.y - session.pointerStart.y,
    });
  };
  const onPointerUp = (event: CRCPointerEvent): void => {
    if (panSession.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishPan(event);
  };
  return (
    <Clip
      onWheel={onWheel}
      style={{
        d: createWorkspaceClip(),
        width: 960,
        height: WORKSPACE_HEIGHT,
      }}
    >
      <Rectangle
        keyboardFocusable={false}
        onClick={() => onSelect(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={finishPan}
        onLostPointerCapture={finishPan}
        style={{
          width: box.width,
          height: box.height,
          fill: "#eef2e8",
          cursor: panning ? "grabbing" : "grab",
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
        <GridLayer />
        {EDGES.map((edge) => (
          <Connection key={edge.id} edge={edge} nodes={nodes} />
        ))}
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            selected={node.id === selectedNodeId}
            onSelect={() => onSelect(node.id)}
            onMove={onMove}
            view={view}
          />
        ))}
      </Group>
    </Clip>
  );
}
function StatusBar({
  style: _style,
  selected,
  view,
}: RegionProps &
  Readonly<{
    selected: DiagramNode | undefined;
    view: ViewTransform;
  }>): CRCNode {
  const box = crcLayoutBox();
  return (
    <Fragment>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#17211d" }}
      />
      <Text
        pointerEvents="none"
        style={{ x: 20, y: 21, fill: "#fffdf6", font: "700 12px monospace" }}
      >
        {selected ? `SELECTED · ${selected.title}` : "NO SELECTION"}
      </Text>
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
      </Text>
    </Fragment>
  );
}
function DiagramEditor(): CRCNode {
  const [nodes, setNodes] = crcState<readonly DiagramNode[]>(INITIAL_NODES);
  const [selected, setSelected] = crcState<NodeId | null>("sketch");
  const [view, setView] = crcState<ViewTransform>(INITIAL_VIEW);
  const moveNode = (id: NodeId, point: Point): void => {
    setNodes((current) => updateNodePosition(current, id, point));
  };
  return (
    <Absolute style={{ width: 960, height: 600 }}>
      <Toolbar
        style={{ left: 0, top: 0, width: "100%", height: 56 }}
        reset={() => setView(INITIAL_VIEW)}
      />
      <Workspace
        style={{
          left: 0,
          top: WORKSPACE_TOP,
          width: "100%",
          height: WORKSPACE_HEIGHT,
        }}
        nodes={nodes}
        selectedNodeId={selected}
        view={view}
        onSelect={setSelected}
        onMove={moveNode}
        onViewChange={setView}
        onWheel={(event) => {
          event.preventDefault();
          setView((current) => zoomAroundPoint(current, event, event.deltaY));
        }}
      />
      <StatusBar
        style={{ left: 0, top: 568, width: "100%", height: 32 }}
        selected={nodes.find((node) => node.id === selected)}
        view={view}
      />
    </Absolute>
  );
}
export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(
    canvas,
    <FocusManagement>
      <KeyboardNavigation mode="directional">
        <DiagramEditor />
      </KeyboardNavigation>
    </FocusManagement>,
  );
}
