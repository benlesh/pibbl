import {
  Absolute,
  crc,
  crcLayoutBox,
  crcRef,
  crcState,
  Fragment,
  Group,
  Path,
  Rectangle,
  Text,
  type BoxStyle,
  type CRCController,
  type CRCNode,
  type CRCPointerEvent,
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

interface RegionProps {
  readonly style: BoxStyle & LayoutItemStyle;
}

interface NodeDragSession {
  readonly kind: "node";
  readonly pointerId: number;
  readonly nodeId: NodeId;
  readonly pointerStart: { readonly x: number; readonly y: number };
  readonly nodeStart: { readonly x: number; readonly y: number };
}

interface NodePointerHandlers {
  readonly onPointerDown: (node: DiagramNode, event: CRCPointerEvent) => void;
  readonly onPointerMove: (event: CRCPointerEvent) => void;
  readonly onPointerUp: (event: CRCPointerEvent) => void;
  readonly onPointerCancel: (event: CRCPointerEvent) => void;
  readonly onLostPointerCapture: (event: CRCPointerEvent) => void;
}

interface NodeCardProps {
  readonly node: DiagramNode;
  readonly selected: boolean;
  readonly pointerHandlers: NodePointerHandlers;
}

interface WorkspaceProps extends RegionProps {
  readonly nodes: readonly DiagramNode[];
  readonly selectedNodeId: NodeId | null;
  readonly onClearSelection: () => void;
  readonly pointerHandlers: NodePointerHandlers;
}

const INITIAL_NODES: readonly DiagramNode[] = [
  { id: "idea", title: "IDEA", subtitle: "Find the spark", color: "#ff6b57", x: 92, y: 180 },
  { id: "sketch", title: "SKETCH", subtitle: "Shape the flow", color: "#f7c948", x: 326, y: 92 },
  { id: "build", title: "BUILD", subtitle: "Make it real", color: "#74d3ae", x: 392, y: 318 },
  { id: "ship", title: "SHIP", subtitle: "Share the work", color: "#1f4bd8", x: 696, y: 210 },
] as const;

const EDGES: readonly DiagramEdge[] = [
  { id: "idea-sketch", from: "idea", to: "sketch" },
  { id: "sketch-build", from: "sketch", to: "build" },
  { id: "sketch-ship", from: "sketch", to: "ship" },
  { id: "build-ship", from: "build", to: "ship" },
] as const;

const WORKSPACE_TOP = 56;
const NODE_WIDTH = 168;
const NODE_HEIGHT = 84;

function rootToWorkspace(point: Readonly<{ x: number; y: number }>): { x: number; y: number } {
  return { x: point.x, y: point.y - WORKSPACE_TOP };
}

function connectionPath(from: Readonly<{ x: number; y: number }>, to: Readonly<{ x: number; y: number }>): Path2D {
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

function NodeCard({ node, selected, pointerHandlers }: NodeCardProps): CRCNode {
  return <Group style={{ translateX: node.x, translateY: node.y }}>
    <Rectangle
      onPointerDown={(event) => pointerHandlers.onPointerDown(node, event)}
      onPointerMove={pointerHandlers.onPointerMove}
      onPointerUp={pointerHandlers.onPointerUp}
      onPointerCancel={pointerHandlers.onPointerCancel}
      onLostPointerCapture={pointerHandlers.onLostPointerCapture}
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT, fill: node.color, stroke: "#17211d", strokeWidth: selected ? 5 : 3, cornerRadius: 16, cursor: "pointer" }}
    />
    <Rectangle pointerEvents="none" style={{ x: -5, y: 37, width: 10, height: 10, fill: "#17211d", cornerRadius: 5 }} />
    <Rectangle pointerEvents="none" style={{ x: 163, y: 37, width: 10, height: 10, fill: "#17211d", cornerRadius: 5 }} />
    <Text pointerEvents="none" style={{ x: 84, y: 34, fill: "#17211d", font: "900 16px sans-serif", textAlign: "center" }}>{node.title}</Text>
    <Text pointerEvents="none" style={{ x: 84, y: 59, fill: "#17211d", font: "600 13px sans-serif", textAlign: "center" }}>{node.subtitle}</Text>
  </Group>;
}

function Connection({ edge, nodes }: Readonly<{ edge: DiagramEdge; nodes: readonly DiagramNode[] }>): CRCNode {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) throw new Error(`Unknown node in edge "${edge.id}".`);
  const fromPort = { x: from.x + NODE_WIDTH, y: from.y + NODE_HEIGHT / 2 };
  const toPort = { x: to.x, y: to.y + NODE_HEIGHT / 2 };
  return <Fragment>
    <Path pointerEvents="none" style={{ d: connectionPath(fromPort, toPort), stroke: "#17211d", strokeWidth: 4 }} />
    <Path pointerEvents="none" style={{ d: arrowheadPath(toPort), fill: "#17211d" }} />
  </Fragment>;
}

function Toolbar({ style: _specifiedStyle }: RegionProps): CRCNode {
  const box = crcLayoutBox();
  return [
    <Rectangle style={{ width: box.width, height: box.height, fill: "#fffdf6" }} />,
    <Text pointerEvents="none" style={{ x: 24, y: 34, fill: "#17211d", font: "900 22px sans-serif" }}>WORKFLOW MAP</Text>,
    <Text pointerEvents="none" style={{ x: 250, y: 32, fill: "#667066", font: "600 13px sans-serif" }}>Drag a card to rearrange it</Text>,
    <Rectangle pointerEvents="none" style={{ x: 820, y: 12, width: 116, height: 32, fill: "#eef2e8", stroke: "#17211d", strokeWidth: 2, cornerRadius: 8 }} />,
    <Text pointerEvents="none" style={{ x: 878, y: 33, fill: "#17211d", font: "800 12px sans-serif", textAlign: "center" }}>RESET VIEW</Text>,
  ];
}

function Workspace({ style: _specifiedStyle, nodes, selectedNodeId, onClearSelection, pointerHandlers }: WorkspaceProps): CRCNode {
  const box = crcLayoutBox();
  return [
    <Rectangle onClick={onClearSelection} style={{ width: box.width, height: box.height, fill: "#eef2e8" }} />,
    <Fragment>
      {EDGES.map((edge) => <Connection key={edge.id} edge={edge} nodes={nodes} />)}
      {nodes.map((node) => <NodeCard key={node.id} node={node} selected={node.id === selectedNodeId} pointerHandlers={pointerHandlers} />)}
    </Fragment>,
  ];
}

function StatusBar({ style: _specifiedStyle, selectedNode }: RegionProps & Readonly<{ selectedNode: DiagramNode | undefined }>): CRCNode {
  const box = crcLayoutBox();
  const status = selectedNode ? `SELECTED · ${selectedNode.title}` : "NO SELECTION";
  return [
    <Rectangle style={{ width: box.width, height: box.height, fill: "#17211d" }} />,
    <Text pointerEvents="none" style={{ x: 20, y: 21, fill: "#fffdf6", font: "700 12px monospace" }}>{status}</Text>,
    <Text pointerEvents="none" style={{ x: 940, y: 21, fill: "#fffdf6", font: "700 12px monospace", textAlign: "right" }}>ZOOM · 100%</Text>,
  ];
}

function DiagramEditor(): CRCNode {
  const [nodes, setNodes] = crcState<readonly DiagramNode[]>(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = crcState<NodeId | null>("sketch");
  const dragSession = crcRef<NodeDragSession | null>(null);
  const clearSession = (event: CRCPointerEvent): void => {
    if (dragSession.current?.pointerId === event.pointerId) dragSession.current = null;
  };
  const pointerHandlers: NodePointerHandlers = {
    onPointerDown(node, event) {
      const point = rootToWorkspace(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      dragSession.current = { kind: "node", pointerId: event.pointerId, nodeId: node.id, pointerStart: point, nodeStart: { x: node.x, y: node.y } };
      setSelectedNodeId(node.id);
    },
    onPointerMove(event) {
      const session = dragSession.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const point = rootToWorkspace(event);
      setNodes((current) => current.map((candidate) => candidate.id === session.nodeId ? { ...candidate, x: session.nodeStart.x + point.x - session.pointerStart.x, y: session.nodeStart.y + point.y - session.pointerStart.y } : candidate));
    },
    onPointerUp(event) {
      if (dragSession.current?.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      dragSession.current = null;
    },
    onPointerCancel: clearSession,
    onLostPointerCapture: clearSession,
  };
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  return <Absolute style={{ width: 960, height: 600 }}>
    <Toolbar style={{ left: 0, top: 0, width: "100%", height: 56 }} />
    <Workspace style={{ left: 0, top: 56, width: "100%", height: 512 }} nodes={nodes} selectedNodeId={selectedNodeId} onClearSelection={() => setSelectedNodeId(null)} pointerHandlers={pointerHandlers} />
    <StatusBar style={{ left: 0, top: 568, width: "100%", height: 32 }} selectedNode={selectedNode} />
  </Absolute>;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <DiagramEditor />);
}
