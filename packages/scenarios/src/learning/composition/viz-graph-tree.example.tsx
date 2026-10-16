import {
  FocusManagement,
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { TidyTree } from "@pibbl/core/viz";

type Role = {
  id: string;
  title: string;
  person: string;
  people: number;
  reports: readonly Role[];
};
const organization: Role = {
  id: "maya",
  title: "CEO",
  person: "Maya Chen",
  people: 63,
  reports: [
    {
      id: "elijah",
      title: "VP Product",
      person: "Elijah Brooks",
      people: 23,
      reports: [
        {
          id: "sofia",
          title: "Product Design",
          person: "Sofia Martin",
          people: 14,
          reports: [
            {
              id: "taylor",
              title: "UX Research",
              person: "Taylor Kim",
              people: 3,
              reports: [],
            },
            {
              id: "jordan",
              title: "Product UI",
              person: "Jordan Reese",
              people: 5,
              reports: [],
            },
          ],
        },
      ],
    },
    {
      id: "priya",
      title: "VP Engineering",
      person: "Priya Shah",
      people: 40,
      reports: [
        {
          id: "dana",
          title: "Applications",
          person: "Dana Cole",
          people: 18,
          reports: [],
        },
      ],
    },
  ],
};
function Scene() {
  const selected = useSignal<string | number | null>(null);
  const collapsed = useSignal<ReadonlySet<string | number>>(
    new Set<string | number>(),
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
          font: "bold 26px sans-serif",
          fill: "#173b37",
        }}
      >
        Product organization
      </Text>
      <Text
        style={{ left: 28, top: 67, font: "14px sans-serif", fill: "#58716d" }}
      >
        Synthetic roles · click a manager card to collapse or expand its reports
      </Text>
      <TidyTree
        root={organization}
        keyBy="id"
        childrenBy="reports"
        label="title"
        detail={(role) => `${role.person} · ${role.people} people`}
        collapsed={(role) => collapsed.get().has(role.id)}
        nodeSize={() => ({ width: 172, height: 58 })}
        style={{
          left: 26,
          top: 105,
          width: 940,
          height: 430,
          levelGap: 48,
          siblingGap: 24,
        }}
        nodeStyle={(node) => ({
          fill: node.key === selected.get() ? "#d9f3ec" : "#f8fffc",
          stroke: node.key === selected.get() ? "#0f766e" : "#9bbeb4",
          strokeWidth: node.key === selected.get() ? 2 : 1,
        })}
        onNodeClick={(node) => {
          selected.set(node.key);
          if (node.hiddenChildren || node.datum.reports.length) {
            const next = new Set(collapsed.get());
            next.has(node.key) ? next.delete(node.key) : next.add(node.key);
            collapsed.set(next);
          }
        }}
      />
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
