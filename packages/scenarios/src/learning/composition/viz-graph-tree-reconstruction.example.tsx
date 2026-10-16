import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import {
  GraphEdge,
  GraphLabel,
  GraphNode,
  TidyTree,
  layoutTree,
} from "@pibbl/core/viz";
type Role = { id: string; title: string; reports: readonly Role[] };
const org: Role = {
  id: "ceo",
  title: "CEO",
  reports: [
    {
      id: "product",
      title: "Product",
      reports: [
        { id: "design", title: "Design", reports: [] },
        { id: "research", title: "Research", reports: [] },
      ],
    },
    {
      id: "engineering",
      title: "Engineering",
      reports: [{ id: "platform", title: "Platform", reports: [] }],
    },
  ],
};
function Scene() {
  const rebuilt = useSignal(false);
  const selected = useSignal<string | number | null>(null);
  const layout = layoutTree(org, {
    keyBy: "id",
    childrenBy: "reports",
    label: "title",
    bounds: { x: 0, y: 0, width: 840, height: 360 },
    levelGap: 48,
    siblingGap: 24,
  });
  const manual = (
    <Group style={{ translateX: 80, translateY: 140 }}>
      {layout.edges.map((edge) => (
        <GraphEdge key={edge.key} edge={edge} />
      ))}
      {layout.nodes.map((node) => (
        <Group key={node.key}>
          <GraphNode
            node={node}
            onClick={() => selected.set(node.key)}
            style={{
              fill: node.key === selected.get() ? "#d9f3ec" : "#edf5f2",
            }}
          />
          <GraphLabel label={node.label} />
        </Group>
      ))}
    </Group>
  );
  return (
    <Group>
      <Rectangle
        onClick={() => selected.set(null)}
        style={{ width: 1000, height: 570, fill: "#fbfaf6" }}
      />
      <Text
        style={{
          left: 28,
          top: 36,
          font: "bold 24px sans-serif",
          fill: "#173b37",
        }}
      >
        Tidy tree reconstruction
      </Text>
      <Rectangle
        style={{
          left: 780,
          top: 26,
          width: 190,
          height: 36,
          cornerRadius: 5,
          fill: "#d9f3ec",
          cursor: "pointer",
        }}
        onClick={() => rebuilt.set(!rebuilt.get())}
      />
      <Text
        pointerEvents="none"
        style={{
          left: 795,
          top: 48,
          font: "13px sans-serif",
          fill: "#173b37",
          textBaseline: "middle",
        }}
      >
        {rebuilt.get() ? "Using public marks" : "Using TidyTree"}
      </Text>
      {rebuilt.get() ? (
        manual
      ) : (
        <Group style={{ translateX: 80, translateY: 140 }}>
          <TidyTree
            root={org}
            keyBy="id"
            childrenBy="reports"
            label="title"
            style={{ width: 840, height: 360 }}
            onNodeClick={(node) => selected.set(node.key)}
          />
        </Group>
      )}
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(
    canvas,
    <FocusManagement>
      <Scene />
    </FocusManagement>,
  );
}
