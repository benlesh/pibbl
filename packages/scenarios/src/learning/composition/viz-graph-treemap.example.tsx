import {
  Group,
  Rectangle,
  Text,
  pibbl,
  useSignal,
  type PibblController,
} from "@pibbl/core";
import { GraphLabel, Treemap } from "@pibbl/core/viz";
type Item = {
  id: string;
  name: string;
  gb: number;
  children?: readonly Item[];
};
const storage: Item = {
  id: "workspace",
  name: "Workspace",
  gb: 0,
  children: [
    {
      id: "apps",
      name: "Applications",
      gb: 0,
      children: [
        { id: "browser", name: "Browser profiles", gb: 18.4 },
        { id: "design", name: "Design tools", gb: 12.8 },
        { id: "dev", name: "Developer tools", gb: 9.6 },
        { id: "plugins", name: "Plugins", gb: 3.1 },
      ],
    },
    {
      id: "projects",
      name: "Projects",
      gb: 0,
      children: [
        { id: "pibbl", name: "Pibbl", gb: 16.2 },
        { id: "client", name: "Client archive", gb: 11.7 },
        { id: "research", name: "Research", gb: 7.4 },
        { id: "exports", name: "Exports", gb: 2.8 },
      ],
    },
    {
      id: "media",
      name: "Media",
      gb: 0,
      children: [
        { id: "recordings", name: "Screen recordings", gb: 14.9 },
        { id: "photos", name: "Photos", gb: 8.3 },
        { id: "audio", name: "Audio", gb: 4.6 },
        { id: "thumbnails", name: "Thumbnails", gb: 1.2 },
      ],
    },
  ],
};
const details: Record<string, string> = {
  workspace: "Workspace · 111.0 GB",
  apps: "Applications · 43.9 GB",
  browser: "Browser profiles · 18.4 GB",
  design: "Design tools · 12.8 GB",
  dev: "Developer tools · 9.6 GB",
  plugins: "Plugins · 3.1 GB",
  projects: "Projects · 38.1 GB",
  pibbl: "Pibbl · 16.2 GB",
  client: "Client archive · 11.7 GB",
  research: "Research · 7.4 GB",
  exports: "Exports · 2.8 GB",
  media: "Media · 29.0 GB",
  recordings: "Screen recordings · 14.9 GB",
  photos: "Photos · 8.3 GB",
  audio: "Audio · 4.6 GB",
  thumbnails: "Thumbnails · 1.2 GB",
};
function Scene() {
  const selected = useSignal<string | number | null>(null);
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
        Storage footprint
      </Text>
      <Text
        style={{ left: 28, top: 67, font: "14px sans-serif", fill: "#58716d" }}
      >
        Illustrative workspace allocation · click a tile to inspect it
      </Text>
      <Text
        style={{ left: 684, top: 67, font: "13px sans-serif", fill: "#0f766e" }}
      >
        Selected: {details[String(selected.get())] ?? "Choose a tile"}
      </Text>
      <Treemap
        root={storage}
        keyBy="id"
        childrenBy="children"
        label="name"
        value="gb"
        unit="GB"
        formatValue={(value) => value.toFixed(1)}
        style={{
          left: 28,
          top: 104,
          width: 944,
          height: 430,
          padding: 7,
          cellGap: 4,
          headerHeight: 22,
        }}
        renderCell={(cell) => {
          const category = cell.depth === 0;
          const { x, y, width, height } = cell.bounds;
          return (
            <Group>
              <Rectangle
                style={{
                  left: x,
                  top: y,
                  width,
                  height,
                  fill:
                    cell.key === selected.get()
                      ? "#b8eadb"
                      : category
                        ? "#9fd6c8"
                        : "#c8e7dd",
                  stroke: cell.key === selected.get() ? "#173b37" : "#fbfaf6",
                  strokeWidth: cell.key === selected.get() ? 3 : 1,
                  cornerRadius: 3,
                }}
              />
              {width >= 48 && height >= 18 && (
                <GraphLabel
                  label={{
                    text: cell.datum.name,
                    bounds: {
                      x: x + 12,
                      y: category ? y + 2 : y + 7,
                      width: Math.max(0, width - 24),
                      height: category ? 18 : 16,
                    },
                    rotationDegrees: 0,
                  }}
                  style={{
                    font: category ? "bold 13px sans-serif" : "13px sans-serif",
                    fill: "#173b37",
                  }}
                />
              )}
              {!category && width >= 80 && height >= 40 && (
                <GraphLabel
                  label={{
                    text: `${cell.value.toFixed(1)} GB`,
                    bounds: {
                      x: x + 12,
                      y: y + 25,
                      width: Math.max(0, width - 24),
                      height: 14,
                    },
                    rotationDegrees: 0,
                  }}
                  style={{ font: "12px sans-serif", fill: "#40615a" }}
                />
              )}
            </Group>
          );
        }}
        cellStyle={(cell) => ({
          stroke: cell.key === selected.get() ? "#173b37" : "#fbfaf6",
          strokeWidth: cell.key === selected.get() ? 3 : 1,
        })}
        onCellClick={(cell) => selected.set(cell.key)}
      />
    </Group>
  );
}
export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <Scene />);
}
