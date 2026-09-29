import {
  Circle,
  crc,
  Group,
  Rectangle,
  SvgPath,
  Text,
  type CRCController,
  type CRCFilter,
} from "@crc/core";

const SAMPLE_WIDTH = 160;

const FILTER_SAMPLES = [
  { label: "BLUR", detail: "4px", filter: { type: "blur", radius: 4 } },
  {
    label: "BRIGHTNESS",
    detail: "135%",
    filter: { type: "brightness", amount: 1.35 },
  },
  {
    label: "CONTRAST",
    detail: "150%",
    filter: { type: "contrast", amount: 1.5 },
  },
  {
    label: "DROP SHADOW",
    detail: "8px 7px 4px",
    filter: {
      type: "dropShadow",
      offsetX: 8,
      offsetY: 7,
      blurRadius: 4,
      color: "rgb(15 23 42)",
    },
  },
  {
    label: "GRAYSCALE",
    detail: "100%",
    filter: { type: "grayscale", amount: 1 },
  },
  {
    label: "HUE ROTATE",
    detail: "120deg",
    filter: { type: "hueRotate", degrees: 120 },
  },
  {
    label: "INVERT",
    detail: "100%",
    filter: { type: "invert", amount: 1 },
  },
  {
    label: "OPACITY",
    detail: "55%",
    filter: { type: "opacity", amount: 0.55 },
  },
  {
    label: "SATURATE",
    detail: "200%",
    filter: { type: "saturate", amount: 2 },
  },
  {
    label: "SEPIA",
    detail: "100%",
    filter: { type: "sepia", amount: 1 },
  },
] satisfies readonly {
  label: string;
  detail: string;
  filter: CRCFilter;
}[];

const ORDERED_FILTERS = [
  { type: "grayscale", amount: 0.35 },
  { type: "contrast", amount: 1.4 },
  {
    type: "dropShadow",
    offsetX: 7,
    offsetY: 6,
    blurRadius: 3,
    color: "rgb(15 23 42)",
  },
] satisfies readonly CRCFilter[];

const NESTED_SHADOW = {
  type: "dropShadow",
  offsetX: 7,
  offsetY: 6,
  blurRadius: 3,
  color: "rgb(15 23 42)",
} satisfies CRCFilter;

interface GradientArtworkProps {
  gradient: CanvasGradient;
  composite?: boolean;
}

function GradientArtwork({
  gradient,
  composite = false,
}: GradientArtworkProps) {
  if (!composite) {
    return (
      <Rectangle
        style={{
          width: SAMPLE_WIDTH,
          height: 78,
          fill: gradient,
          stroke: "#17211d",
          strokeWidth: 3,
        }}
      />
    );
  }

  return (
    <Group>
      <SvgPath
        style={{
          d: `M 12 0 H ${SAMPLE_WIDTH} V 78 H 12 Z`,
          fill: gradient,
          stroke: "#17211d",
          strokeWidth: 3,
        }}
      />
      <Circle
        style={{
          cx: 24,
          cy: 39,
          radius: 28,
          fill: "rgb(255 255 255 / 72%)",
          stroke: "#17211d",
          strokeWidth: 3,
        }}
      />
      <Text
        style={{
          left: 108,
          top: 48,
          fill: "#ffffff",
          font: "900 20px sans-serif",
          textAlign: "center",
        }}
      >
        ONE GROUP
      </Text>
    </Group>
  );
}

interface TileHeadingProps {
  label: string;
  detail: string;
}

function TileHeading({ label, detail }: TileHeadingProps) {
  return (
    <Group>
      <Text
        style={{
          left: 90,
          top: 18,
          fill: "#17211d",
          font: "800 13px monospace",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          left: 90,
          top: 37,
          fill: "#64748b",
          font: "600 10px monospace",
          textAlign: "center",
        }}
      >
        {detail}
      </Text>
    </Group>
  );
}

interface FilterTileProps extends TileHeadingProps {
  filter?: CRCFilter;
  gradient: CanvasGradient;
  x: number;
  y: number;
}

function FilterTile({
  filter,
  gradient,
  label,
  detail,
  x,
  y,
}: FilterTileProps) {
  return (
    <Group style={{ translateX: x, translateY: y }}>
      <TileHeading label={label} detail={detail} />
      <Group style={{ filter, translateX: 10, translateY: 52 }}>
        <GradientArtwork gradient={gradient} />
      </Group>
    </Group>
  );
}

interface CompositeTileProps extends TileHeadingProps {
  gradient: CanvasGradient;
  mode: "array" | "nested";
  x: number;
  y: number;
}

function CompositeTile({
  gradient,
  mode,
  label,
  detail,
  x,
  y,
}: CompositeTileProps) {
  const artwork = <GradientArtwork gradient={gradient} composite />;
  const filteredArtwork =
    mode === "array" ? (
      <Group style={{ filter: ORDERED_FILTERS }}>{artwork}</Group>
    ) : (
      <Group style={{ filter: { type: "blur", radius: 1.5 } }}>
        <Group style={{ filter: NESTED_SHADOW }}>
          <Group style={{ filter: { type: "hueRotate", degrees: 155 } }}>
            {artwork}
          </Group>
        </Group>
      </Group>
    );

  return (
    <Group style={{ translateX: x, translateY: y }}>
      <TileHeading label={label} detail={detail} />
      <Group style={{ translateX: 10, translateY: 52 }}>
        {filteredArtwork}
      </Group>
    </Group>
  );
}

function tilePosition(index: number): { x: number; y: number } {
  const column = index < 10 ? index % 5 : index - 9;
  return {
    x: 5 + column * 190,
    y: 92 + Math.floor(index / 5) * 178,
  };
}

function FilterGallery({ gradient }: { gradient: CanvasGradient }) {
  const normalPosition = tilePosition(0);
  const orderedPosition = tilePosition(11);
  const nestedPosition = tilePosition(12);

  return [
    <Rectangle
      style={{ left: 0, top: 0, width: 960, height: 660, fill: "#f7f0df" }}
    />,
    <Text
      style={{
        left: 480,
        top: 42,
        fill: "#17211d",
        font: "900 28px sans-serif",
        textAlign: "center",
      }}
    >
      FILTER GALLERY
    </Text>,
    <Text
      style={{
        left: 480,
        top: 68,
        fill: "#64748b",
        font: "600 12px monospace",
        textAlign: "center",
      }}
    >
      SAME GRADIENT · ONE FRAME · EVERY FILTER
    </Text>,
    <FilterTile
      gradient={gradient}
      label="NORMAL"
      detail="unfiltered"
      x={normalPosition.x}
      y={normalPosition.y}
    />,
    ...FILTER_SAMPLES.map((sample, index) => {
      const position = tilePosition(index + 1);
      return (
        <FilterTile
          key={sample.label}
          filter={sample.filter}
          gradient={gradient}
          label={sample.label}
          detail={sample.detail}
          x={position.x}
          y={position.y}
        />
      );
    }),
    <CompositeTile
      gradient={gradient}
      mode="array"
      label="ORDERED ARRAY"
      detail="gray → contrast → shadow"
      x={orderedPosition.x}
      y={orderedPosition.y}
    />,
    <CompositeTile
      gradient={gradient}
      mode="nested"
      label="NESTED"
      detail="hue → shadow → blur"
      x={nestedPosition.x}
      y={nestedPosition.y}
    />,
    <Text
      style={{
        left: 480,
        top: 642,
        fill: "#475569",
        font: "700 11px monospace",
        textAlign: "center",
      }}
    >
      LISTS RUN LEFT TO RIGHT · NESTED BOUNDARIES RUN INSIDE OUT
    </Text>,
  ];
}

function createSharedGradient(canvas: HTMLCanvasElement): CanvasGradient {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The Filters example requires a 2D context.");

  const gradient = context.createLinearGradient(0, 0, SAMPLE_WIDTH, 0);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(0.14, "#ef4444");
  gradient.addColorStop(0.3, "#facc15");
  gradient.addColorStop(0.48, "#f8fafc");
  gradient.addColorStop(0.64, "#10b981");
  gradient.addColorStop(0.82, "#2563eb");
  gradient.addColorStop(1, "#7c3aed");
  return gradient;
}

export default function mount(canvas: HTMLCanvasElement): CRCController {
  const gradient = createSharedGradient(canvas);
  return crc(canvas, <FilterGallery gradient={gradient} />);
}
