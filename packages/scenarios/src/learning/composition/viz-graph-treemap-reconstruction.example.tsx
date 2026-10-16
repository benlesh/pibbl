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
  GraphLabel,
  Treemap,
  TreemapCell,
  layoutTreemap,
} from "@pibbl/core/viz";
type Item = {
  id: string;
  name: string;
  gb: number;
  children?: readonly Item[];
};
const storage: Item = {
  id: "root",
  name: "Storage",
  gb: 0,
  children: [
    {
      id: "apps",
      name: "Apps",
      gb: 0,
      children: [
        { id: "assets", name: "Assets", gb: 24 },
        { id: "cache", name: "Cache", gb: 9 },
      ],
    },
    {
      id: "work",
      name: "Projects",
      gb: 0,
      children: [
        { id: "pibbl", name: "Pibbl", gb: 18 },
        { id: "archive", name: "Archive", gb: 8 },
      ],
    },
  ],
};
function Scene() {
  const rebuilt = useSignal(false);
  const selected = useSignal<string | number | null>(null);
  const layout = layoutTreemap(storage, {
    keyBy: "id",
    childrenBy: "children",
    label: "name",
    value: "gb",
    unit: "GB",
    bounds: { x: 0, y: 0, width: 840, height: 370 },
  });
  const manual = (
    <Group style={{ translateX: 80, translateY: 130 }}>
      {layout.cells.map((cell) => (
        <TreemapCell
          key={cell.key}
          cell={cell}
          onClick={() => selected.set(cell.key)}
          style={{
            fill: cell.key === selected.get() ? "#0f766e" : "#bde2d6",
            stroke: "#fff",
          }}
        >
          {cell.label && <GraphLabel label={cell.label} />}
        </TreemapCell>
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
        Treemap reconstruction
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
        {rebuilt.get() ? "Using public marks" : "Using Treemap"}
      </Text>
      {rebuilt.get() ? (
        manual
      ) : (
        <Group style={{ translateX: 80, translateY: 130 }}>
          <Treemap
            root={storage}
            keyBy="id"
            childrenBy="children"
            label="name"
            value="gb"
            unit="GB"
            style={{ width: 840, height: 370 }}
            onCellClick={(cell) => selected.set(cell.key)}
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
