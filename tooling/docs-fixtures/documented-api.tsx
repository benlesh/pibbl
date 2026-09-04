import {
  Clip,
  FocusManagement,
  Fragment,
  Grid,
  Group,
  KeyboardNavigation,
  Layer,
  Path,
  Rectangle,
  Text,
  crc,
  crcCanvasContext,
  crcLayoutBox,
  crcState,
  createElement,
  definePrimitive,
  type BoxStyle,
  type CRCController,
  type CRCNode,
  type FillStyle,
  type Percentage,
  type SystemStyle,
} from "@crc/core";

interface PosterProps {
  initialMessage: string;
}

function Poster({ initialMessage }: PosterProps): CRCNode {
  const [message, setMessage] = crcState(initialMessage);
  const clip = new Path2D("M0 0h240v120h-240z");

  return (
    <FocusManagement>
      <KeyboardNavigation mode="directional">
        <Group>
          <Rectangle
            style={{ width: 240, height: 120, fill: "#2563eb" }}
            onClick={() => setMessage("CRC!")}
          />
          <Clip style={{ d: clip }}>
            <Layer style={{ width: 240, height: 120 }}>
              <Text style={{ x: 16, y: 20, fill: "white" }}>
                {message} {0}
              </Text>
            </Layer>
          </Clip>
        </Group>
      </KeyboardNavigation>
    </FocusManagement>
  );
}

interface ResultsProps {
  items: readonly { id: number; label: string }[];
  showFooter: boolean;
}

function* extras(): Iterable<CRCNode> {
  yield (
    <Rectangle
      key="accent"
      style={{
        width: 20,
        height: 20,
        gridColumnStart: 1,
        gridRowStart: 1,
      }}
    />
  );
}

export function Results({ items, showFooter }: ResultsProps): CRCNode {
  return (
    <Grid
      style={{
        width: 300,
        height: 200,
        gridTemplateColumns: [150, 150],
        gridTemplateRows: [50, 50, 50, 50],
      }}
    >
      {extras()}
      {items.slice(0, 4).map((item, index) => (
        <Text
          key={item.id}
          style={{
            gridColumnStart: (index % 2) + 1,
            gridRowStart: Math.floor(index / 2) + 2,
          }}
        >
          {item.label}
        </Text>
      ))}
      {showFooter && (
        <Text
          style={{ gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 4 }}
        >
          Done
        </Text>
      )}
    </Grid>
  );
}

export function groupSections(
  sections: readonly { id: string; elements: CRCNode }[],
): CRCNode {
  return sections.map((section) => (
    <Fragment key={section.id}>{section.elements}</Fragment>
  ));
}

export function mountDocumentedScene(canvas: HTMLCanvasElement): CRCController {
  return crc(canvas, <Poster initialMessage="Hello" />);
}

export const documentedNonJsxTree = createElement(
  Fragment,
  null,
  createElement(Rectangle, {
    style: { width: 20, height: 20, fill: "tomato" },
  }),
  createElement(Text, { style: { x: 24, y: 4 } }, "Ready"),
);

interface SparklineProps {
  points: readonly number[];
  style: BoxStyle & { stroke: string };
}

export function Sparkline({ points, style: _style }: SparklineProps): void {
  const context = crcCanvasContext();
  const box = crcLayoutBox();
  if (points.length === 0) return;

  context.beginPath();
  points.forEach((point, index) => {
    const x =
      points.length === 1 ? 0 : (index / (points.length - 1)) * box.width;
    const y = box.height - point * box.height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = _style.stroke;
  context.stroke();
}

interface GaugeProps {
  value: number;
}

interface GaugeStyle extends SystemStyle {
  width: number | Percentage;
  height?: number;
  fill?: FillStyle;
}

interface NormalizedGaugeStyle extends SystemStyle {
  width: number | Percentage;
  height: number;
  fill: FillStyle;
}

interface ResolvedGaugeStyle extends SystemStyle {
  width: number;
  height: number;
  fill: FillStyle;
}

export const Gauge = definePrimitive<
  GaugeProps,
  GaugeStyle,
  NormalizedGaugeStyle,
  ResolvedGaugeStyle
>(
  function renderGauge({ value }, style, context) {
    context.fillStyle = style.fill;
    context.fillRect(
      0,
      0,
      style.width * Math.max(0, Math.min(1, value)),
      style.height,
    );
  },
  {
    normalizeStyle: (style) => ({
      ...style,
      height: style.height ?? 12,
      fill: style.fill ?? "#2563eb",
    }),
    resolveStyle: (style, resolution) => ({
      ...style,
      width:
        typeof style.width === "number"
          ? style.width
          : (Number.parseFloat(style.width) / 100) *
            resolution.percentageBasis.width,
    }),
    measure: ({ style, constraints }) => {
      if (
        typeof style.width !== "number" &&
        !Number.isFinite(constraints.maxWidth)
      ) {
        return {
          status: "unsupported",
          reason: "percentage width needs a finite maximum width",
        };
      }
      const basis = Number.isFinite(constraints.maxWidth)
        ? constraints.maxWidth
        : 0;
      const width =
        typeof style.width === "number"
          ? style.width
          : (Number.parseFloat(style.width) / 100) * basis;
      return { status: "measured", size: { width, height: style.height } };
    },
  },
);

export const documentedPath = (
  <Path style={{ d: new Path2D("M0 0h10v10z"), fill: "black" }} />
);
