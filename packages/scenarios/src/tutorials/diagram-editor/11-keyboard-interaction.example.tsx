import {
  Absolute,
  Clip,
  crc,
  crcEventListener,
  crcEventTarget,
  crcLayoutBox,
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
interface DragGesture {
  readonly kind: "node";
  readonly pointerId: number;
  readonly nodeId: NodeId;
  readonly pointerStart: Point;
  readonly nodeStart: Point;
}
interface PanGesture {
  readonly kind: "pan";
  readonly pointerId: number;
  readonly pointerStart: Point;
  readonly viewStart: ViewTransform;
}
type Gesture = DragGesture | PanGesture;

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
    y: 92,
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
const NODE_WIDTH = 168;
const NODE_HEIGHT = 84;

function createGridPath(): Path2D {
  const path = new Path2D();
  for (let y = 20; y < 900; y += 24)
    for (let x = 20; x < 1400; x += 24) path.rect(x, y, 2, 2);
  return path;
}
function createWorkspaceClip(): Path2D {
  const path = new Path2D();
  path.rect(0, 0, 960, 512);
  return path;
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
function connectionPath(from: Point, to: Point): Path2D {
  const path = new Path2D();
  const bend = Math.max(56, Math.abs(to.x - from.x) * 0.5);
  path.moveTo(from.x, from.y);
  path.bezierCurveTo(from.x + bend, from.y, to.x - bend, to.y, to.x, to.y);
  return path;
}
function arrowPath(point: Point): Path2D {
  const path = new Path2D();
  path.moveTo(point.x, point.y);
  path.lineTo(point.x - 14, point.y - 7);
  path.lineTo(point.x - 14, point.y + 7);
  path.closePath();
  return path;
}

interface NodeHandlers {
  readonly down: (node: DiagramNode, event: CRCPointerEvent) => void;
  readonly move: (event: CRCPointerEvent) => void;
  readonly up: (event: CRCPointerEvent) => void;
  readonly finish: (event: CRCPointerEvent) => void;
}
function NodeCard({
  node,
  selected,
  dragActive,
  handlers,
  onSelect,
}: Readonly<{
  node: DiagramNode;
  selected: boolean;
  dragActive: boolean;
  handlers: NodeHandlers;
  onSelect: () => void;
}>): CRCNode {
  return (
    <Group style={{ translateX: node.x, translateY: node.y }}>
      <NodePaint node={node} selected={selected} />
      <NodeTarget
        node={node}
        dragActive={dragActive}
        handlers={handlers}
        onSelect={onSelect}
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
function FocusVisual({ visible }: Readonly<{ visible: boolean }>): CRCNode {
  return visible ? (
    <Fragment>
      <Rectangle
        pointerEvents="none"
        style={{
          x: -7,
          y: -7,
          width: NODE_WIDTH + 14,
          height: NODE_HEIGHT + 14,
          stroke: "#fffdf6",
          strokeWidth: 3,
          cornerRadius: 21,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          x: -3,
          y: -3,
          width: NODE_WIDTH + 6,
          height: NODE_HEIGHT + 6,
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 19,
        }}
      />
    </Fragment>
  ) : (
    <Fragment />
  );
}
function NodeTarget({
  node,
  dragActive,
  handlers,
  onSelect,
}: Readonly<{
  node: DiagramNode;
  dragActive: boolean;
  handlers: NodeHandlers;
  onSelect: () => void;
}>): CRCNode {
  const targetPath = crcRectPath(0, 0, NODE_WIDTH, NODE_HEIGHT, {
    cornerRadius: 16,
  });
  const focus = crcEventTarget(
    {
      onClick: onSelect,
      onPointerDown: (event) => handlers.down(node, event),
      onPointerMove: handlers.move,
      onPointerUp: handlers.up,
      onPointerCancel: handlers.finish,
      onLostPointerCapture: handlers.finish,
    },
    {
      path: targetPath,
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
  return <FocusVisual visible={focus.isFocusVisible} />;
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
        style={{ d: arrowPath(end), fill: "#17211d" }}
      />
    </Fragment>
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
    <Fragment>
      <Rectangle
        pointerEvents="none"
        style={{
          x: -4,
          y: -4,
          width: 124,
          height: 40,
          stroke: "#fffdf6",
          strokeWidth: 3,
          cornerRadius: 12,
        }}
      />
      <Rectangle
        pointerEvents="none"
        style={{
          x: -2,
          y: -2,
          width: 120,
          height: 36,
          stroke: "#17211d",
          strokeWidth: 2,
          cornerRadius: 10,
        }}
      />
    </Fragment>
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
  selected,
  draggingNodeId,
  view,
  onSelect,
  onWheel,
  handlers,
  panDown,
  panMove,
  panUp,
  finish,
}: RegionProps &
  Readonly<{
    nodes: readonly DiagramNode[];
    selected: NodeId | null;
    draggingNodeId: NodeId | null;
    view: ViewTransform;
    onSelect: (id: NodeId | null) => void;
    onWheel: (event: CRCWheelEvent) => void;
    handlers: NodeHandlers;
    panDown: (event: CRCPointerEvent) => void;
    panMove: (event: CRCPointerEvent) => void;
    panUp: (event: CRCPointerEvent) => void;
    finish: (event: CRCPointerEvent) => void;
  }>): CRCNode {
  const box = crcLayoutBox();
  return (
    <WheelScope onWheel={onWheel}>
      <Clip style={{ d: createWorkspaceClip(), width: 960, height: 512 }}>
        <Rectangle
          keyboardFocusable={false}
          onClick={() => onSelect(null)}
          onPointerDown={panDown}
          onPointerMove={panMove}
          onPointerUp={panUp}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
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
              style={{ d: createGridPath(), fill: "#c8d2c6" }}
            />
          </Layer>
          {EDGES.map((edge) => (
            <Connection key={edge.id} edge={edge} nodes={nodes} />
          ))}
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              selected={node.id === selected}
              dragActive={node.id === draggingNodeId}
              handlers={handlers}
              onSelect={() => onSelect(node.id)}
            />
          ))}
        </Group>
      </Clip>
    </WheelScope>
  );
}
function WheelScope({
  onWheel,
  children,
}: Readonly<{
  onWheel: (event: CRCWheelEvent) => void;
  children: CRCNode;
}>): CRCNode {
  crcEventListener({ onWheel });
  return children;
}
function Status({
  style: _style,
  selected,
  view,
}: RegionProps &
  Readonly<{
    selected: DiagramNode | undefined;
    view: ViewTransform;
  }>): CRCNode {
  const box = crcLayoutBox();
  const message = selected ? `SELECTED · ${selected.title}` : "NO SELECTION";
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
        {message}
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
  const [draggingNodeId, setDraggingNodeId] = crcState<NodeId | null>(null);
  const [view, setView] = crcState<ViewTransform>(INITIAL_VIEW);
  const gesture = crcRef<Gesture | null>(null);
  const finishGesture = (pointerId: number): void => {
    if (gesture.current?.pointerId === pointerId) {
      gesture.current = null;
      setDraggingNodeId(null);
    }
  };
  const handlers: NodeHandlers = {
    down(node, event) {
      const pointerStart = rootToWorkspace(event, view);
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = {
        kind: "node",
        pointerId: event.pointerId,
        nodeId: node.id,
        pointerStart,
        nodeStart: { x: node.x, y: node.y },
      };
      setDraggingNodeId(node.id);
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
      const point = rootToWorkspace(event, view);
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
      finishGesture(event.pointerId);
    },
    finish(event) {
      finishGesture(event.pointerId);
    },
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
    finishGesture(event.pointerId);
  };
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
        draggingNodeId={draggingNodeId}
        view={view}
        onSelect={setSelected}
        onWheel={(event) => {
          event.preventDefault();
          setView((current) => zoomAroundPoint(current, event, event.deltaY));
        }}
        handlers={handlers}
        panDown={panDown}
        panMove={panMove}
        panUp={panUp}
        finish={(event) => finishGesture(event.pointerId)}
      />
      <Status
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
