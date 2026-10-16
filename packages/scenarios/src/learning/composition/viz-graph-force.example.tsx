import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  useRef,
  type PibblController,
  type PibblPointerEvent,
} from "@pibbl/core";
import {
  GraphView,
  GraphNode,
  GraphLabel,
  useForceNetwork,
  type VizKey,
} from "@pibbl/core/viz";
// Deterministic illustrative delivery dependencies; links do not encode team size or performance.
const collaboration = {
  nodes: [
    { id: "platform", name: "Platform", team: "Infrastructure" },
    { id: "identity", name: "Identity", team: "Infrastructure" },
    { id: "data", name: "Data platform", team: "Infrastructure" },
    { id: "checkout", name: "Checkout", team: "Commerce" },
    { id: "payments", name: "Payments", team: "Commerce" },
    { id: "orders", name: "Order lifecycle", team: "Commerce" },
    { id: "search", name: "Search", team: "Experience" },
    { id: "catalog", name: "Catalog", team: "Experience" },
    { id: "web", name: "Storefront", team: "Experience" },
    { id: "risk", name: "Risk", team: "Operations" },
    { id: "support", name: "Customer care", team: "Operations" },
    { id: "analytics", name: "Analytics", team: "Operations" },
  ],
  edges: [
    ["platform", "identity"],
    ["platform", "data"],
    ["platform", "checkout"],
    ["identity", "checkout"],
    ["data", "analytics"],
    ["checkout", "payments"],
    ["checkout", "orders"],
    ["checkout", "web"],
    ["payments", "risk"],
    ["orders", "support"],
    ["orders", "catalog"],
    ["search", "catalog"],
    ["search", "web"],
    ["catalog", "web"],
    ["analytics", "risk"],
    ["analytics", "support"],
  ].map(([from, to], index) => ({ id: `dependency-${index}`, from, to })),
};
const colors: Record<string, string> = {
  Infrastructure: "#427aab",
  Commerce: "#188574",
  Experience: "#b47c30",
  Operations: "#8d62a6",
};
function Button({
  x,
  width,
  label,
  onClick,
}: {
  x: number;
  width: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <Group onClick={onClick}>
      <Rectangle
        keyboardFocusable
        style={{
          left: x,
          top: 532,
          width,
          height: 40,
          cornerRadius: 6,
          fill: "#214d43",
          cursor: "pointer",
        }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: x + width / 2,
          top: 552,
          fill: "white",
          font: "600 13px sans-serif",
          textAlign: "center",
          textBaseline: "middle",
        }}
      >
        {label}
      </Text>
    </Group>
  );
}
function Scene() {
  const selected = useSignal<VizKey | null>("checkout"),
    paused = useSignal(false);
  const pinned = useSignal<readonly VizKey[]>([]),
    dragging = useSignal<VizKey | null>(null);
  const drag = useRef<{
    key: VizKey;
    pointerId: number;
    dx: number;
    dy: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const network = useForceNetwork(collaboration, {
    nodeKey: "id",
    edgeKey: "id",
    source: "from",
    target: "to",
    label: "name",
    directed: false,
    nodeSize: { width: 42, height: 42 },
    bounds: { x: 55, y: 28, width: 920, height: 275 },
    simulation: {
      seed: 14,
      linkDistance: 180,
      nodeGap: 65,
      maxIterations: 360,
    },
  });
  const selectedTeam = collaboration.nodes.find(
    (team) => team.id === selected.get(),
  );
  const neighbors = collaboration.edges.filter(
    (edge) => edge.from === selected.get() || edge.to === selected.get(),
  );
  const stop = (event: PibblPointerEvent) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    dragging.set(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <Group>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{ width: 1100, height: 620, fill: "#f5f7f4" }}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 32,
          top: 27,
          font: "700 26px sans-serif",
          fill: "#173c36",
        }}
      >
        Where teams depend on one another
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 32, top: 65, font: "14px sans-serif", fill: "#526b62" }}
      >
        12 teams · 16 shared delivery dependencies · drag a team to pin its
        position
      </Text>
      {Object.entries(colors).map(([team, fill], i) => (
        <Group key={team}>
          <Rectangle
            onClick={() => selected.set(null)}
            style={{
              left: 35 + i * 212,
              top: 100,
              width: 10,
              height: 10,
              cornerRadius: 5,
              fill,
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              left: 52 + i * 212,
              top: 98,
              font: "12px sans-serif",
              fill: "#465d54",
            }}
          >
            {team}
          </Text>
        </Group>
      ))}
      <Rectangle
        onClick={() => selected.set(null)}
        style={{
          left: 25,
          top: 126,
          width: 1050,
          height: 365,
          fill: "#fff",
          stroke: "#dbe4dd",
          cornerRadius: 10,
        }}
      />
      <Group style={{ translateX: 35, translateY: 140 }}>
        <GraphView
          layout={network.layout}
          onEdgeClick={() => selected.set(null)}
          edgeStyle={(edge) => {
            if (selected.get() === null)
              return { stroke: "#aabdb3", strokeWidth: 1.25, opacity: 1 };
            const connected =
              edge.sourceKey === selected.get() ||
              edge.targetKey === selected.get();
            return {
              stroke: connected ? "#4b7467" : "#cbd7d0",
              strokeWidth: connected ? 2 : 1,
              opacity: connected ? 1 : 0.65,
            };
          }}
          renderNode={(node) => (
            <Group>
              <GraphNode
                node={node}
                style={{
                  fill: colors[node.datum.team],
                  stroke: node.key === selected.get() ? "#133c31" : "#fff",
                  strokeWidth: node.key === selected.get() ? 3 : 2,
                  cornerRadius: 30,
                  cursor: dragging.get() === node.key ? "grabbing" : "grab",
                }}
                onClick={() => selected.set(node.key)}
                onPointerDown={(event) => {
                  if (event.button !== 0 || drag.current) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  if (!event.currentTarget.hasPointerCapture(event.pointerId))
                    return;
                  const center = {
                    x: node.bounds.x + 21,
                    y: node.bounds.y + 21,
                  };
                  drag.current = {
                    key: node.key,
                    pointerId: event.pointerId,
                    dx: event.x - 35 - center.x,
                    dy: event.y - 140 - center.y,
                    startX: event.x,
                    startY: event.y,
                    moved: false,
                  };
                  selected.set(node.key);
                }}
                onPointerMove={(event) => {
                  const active = drag.current;
                  if (
                    !active ||
                    active.key !== node.key ||
                    active.pointerId !== event.pointerId
                  )
                    return;
                  if (!active.moved) {
                    if (
                      Math.hypot(
                        event.x - active.startX,
                        event.y - active.startY,
                      ) < 4
                    )
                      return;
                    active.moved = true;
                    dragging.set(node.key);
                    pinned.update((keys) =>
                      keys.includes(node.key) ? keys : [...keys, node.key],
                    );
                  }
                  network.pin(node.key, {
                    x: Math.max(76, Math.min(954, event.x - 35 - active.dx)),
                    y: Math.max(49, Math.min(282, event.y - 140 - active.dy)),
                  });
                }}
                onPointerUp={stop}
                onPointerCancel={stop}
                onLostPointerCapture={() => {
                  drag.current = null;
                  dragging.set(null);
                }}
              />
              <GraphLabel
                label={node.label}
                style={{
                  font: "12px sans-serif",
                  fill: "#203f34",
                  textAlign: "center",
                  textBaseline: "middle",
                }}
              />
              {pinned.get().includes(node.key) && (
                <Text
                  pointerEvents="none"
                  style={{
                    left: node.bounds.x + 21,
                    top: node.bounds.y + 21,
                    font: "700 11px sans-serif",
                    fill: "white",
                    textAlign: "center",
                    textBaseline: "middle",
                  }}
                >
                  ●
                </Text>
              )}
            </Group>
          )}
        />
      </Group>
      <Text
        pointerEvents="none"
        style={{
          left: 34,
          top: 514,
          font: "700 16px sans-serif",
          fill: "#214d43",
        }}
      >
        {selectedTeam
          ? `${selectedTeam.name} · ${neighbors.length} connected teams`
          : "Select a team"}
      </Text>
      <Text
        pointerEvents="none"
        style={{ left: 34, top: 543, font: "13px sans-serif", fill: "#526b62" }}
      >
        {selectedTeam && pinned.get().includes(selectedTeam.id)
          ? "Pinned in place. Release it to rejoin the layout."
          : "Select a team to emphasize its direct dependencies."}
      </Text>
      <Button
        x={646}
        width={126}
        label={paused.get() ? "Resume layout" : "Pause layout"}
        onClick={() => {
          paused.set(!paused.get());
          if (paused.get()) network.pause();
          else network.restart();
        }}
      />
      <Button
        x={784}
        width={135}
        label="Release pins"
        onClick={() => {
          for (const key of pinned.get()) network.release(key);
          pinned.set([]);
          if (!paused.get()) network.restart();
        }}
      />
      <Button
        x={931}
        width={140}
        label="Reset positions"
        onClick={() => {
          pinned.set([]);
          paused.set(false);
          network.reset();
        }}
      />
      <Text
        pointerEvents="none"
        style={{ left: 34, top: 592, font: "12px sans-serif", fill: "#657b70" }}
      >
        Illustrative organization. Colors show working groups; distance does not
        encode strength, headcount, or performance.
      </Text>
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  let disposed = false;
  const app = pibbl(
    canvas,
    <FocusManagement>
      <Scene />
    </FocusManagement>,
  );
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      app.dispose();
      canvas.style.touchAction = previousTouchAction;
    },
  };
}
