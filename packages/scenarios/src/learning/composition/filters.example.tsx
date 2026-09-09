import {
  Circle,
  crc,
  crcState,
  Group,
  Rectangle,
  Text,
  type CRCController,
  type CRCFilter,
} from "@crc/core";

const CHAINS = [
  [
    {
      type: "dropShadow",
      offsetX: 12,
      offsetY: 10,
      blurRadius: 5,
      color: "rgb(17 24 39 / 55%)",
    },
  ],
  [
    { type: "grayscale", amount: 1 },
    {
      type: "dropShadow",
      offsetX: 12,
      offsetY: 10,
      blurRadius: 5,
      color: "rgb(17 24 39 / 55%)",
    },
  ],
  [
    {
      type: "dropShadow",
      offsetX: 12,
      offsetY: 10,
      blurRadius: 5,
      color: "rgb(17 24 39 / 55%)",
    },
    { type: "grayscale", amount: 1 },
  ],
] satisfies readonly (readonly CRCFilter[])[];

function FilterStudy() {
  const [chainIndex, setChainIndex] = crcState(0);
  const chain = CHAINS[chainIndex]!;

  return [
    <Rectangle
      style={{ x: 0, y: 0, width: 720, height: 420, fill: "#f7f0df" }}
    />,
    <Text
      style={{
        x: 360,
        y: 66,
        fill: "#17211d",
        font: "900 32px sans-serif",
        textAlign: "center",
      }}
    >
      FILTERED AS ONE SILHOUETTE
    </Text>,
    <Text
      style={{
        x: 360,
        y: 96,
        fill: "#475569",
        font: "600 15px sans-serif",
        textAlign: "center",
      }}
    >
      {`CHAIN ${chainIndex + 1} · CLICK THE CARD`}
    </Text>,
    <Group style={{ filter: chain }}>
      <Rectangle
        style={{
          x: 186,
          y: 144,
          width: 330,
          height: 172,
          fill: "#2563eb",
          stroke: "#17211d",
          strokeWidth: 6,
          cursor: "pointer",
        }}
        onClick={() => setChainIndex((index) => (index + 1) % CHAINS.length)}
      />
      <Circle
        style={{
          cx: 258,
          cy: 220,
          radius: 62,
          fill: "#f7c948",
          stroke: "#17211d",
          strokeWidth: 5,
        }}
      />
      <Text
        style={{
          x: 376,
          y: 216,
          fill: "#ffffff",
          font: "900 31px sans-serif",
          textAlign: "center",
        }}
      >
        ONE GROUP
      </Text>
      <Text
        style={{
          x: 376,
          y: 248,
          fill: "#dbeafe",
          font: "700 14px monospace",
          textAlign: "center",
        }}
      >
        RECT · CIRCLE · TEXT
      </Text>
    </Group>,
    <Text
      style={{
        x: 360,
        y: 366,
        fill: "#475569",
        font: "600 14px sans-serif",
        textAlign: "center",
      }}
    >
      LIST ORDER CHANGES WHICH PIXELS THE NEXT FILTER RECEIVES
    </Text>,
  ];
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <FilterStudy />);
}
