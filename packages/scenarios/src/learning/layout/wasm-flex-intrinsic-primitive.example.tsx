import {
  Flex,
  computed,
  Rectangle,
  Text,
  definePrimitive,
  signal,
  type Signal,
  type WritableSignal,
  type SystemStyle,
  type MeasureResult,
  type BoxStyle,
  type FlexItemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
  useReaction,
} from "@pibbl/core";

interface IntrinsicChipStyle extends SystemStyle {
  readonly width?: number;
  readonly height?: number;
  readonly flexBasis?: number;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
}

let providerCalls = 0;
let columnMeasureCalls = 0;
let adaptiveFiniteCalls = 0;
const IntrinsicChip = definePrimitive<{ minimum: Signal<number> }, IntrinsicChipStyle>(
  function renderIntrinsicChip(_props, _style, context) {
    const box = useLayoutBox();
    context.fillStyle = "#6e3e79";
    context.fillRect(0, 0, box.width, box.height);
  },
  {
    preserveSignalProps: ["minimum"],
    measureIntrinsic: ({ props }) => {
      providerCalls++;
      return ({
        status: "measured" as const,
        minContent: { width: props.minimum.get(), height: 20 },
        maxContent: { width: 100, height: 20 },
      });
    },
    measure: ({ props, constraints }) => {
      columnMeasureCalls++;
      return {
        status: "measured" as const,
        size: {
          width: constraints.maxWidth,
          height: props.minimum.get(),
        },
      };
    },
  },
);

interface ExactCapStyle extends SystemStyle {
  readonly position?: "absolute";
  readonly left?: number;
  readonly top?: number;
  readonly width?: number | "auto";
  readonly height?: number | "auto";
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly flexGrow?: number;
  readonly flexShrink?: number;
}

type ExactCapAxis = "row" | "column";
type ExactCapName = "A" | "B";


const AdaptiveIntrinsicChip = definePrimitive<{ hits: WritableSignal<number> }, IntrinsicChipStyle>(
  function renderAdaptiveIntrinsicChip(props) {
    const box = useLayoutBox();
    return (
      <Rectangle
        onClick={() => props.hits.update(value => value + 1)}
        style={{
          width: box.width,
          height: box.height,
          fill: "#6e3e79",
          cursor: "pointer",
        }}
      />
    );
  },
  {
    preserveSignalProps: ["hits"],
    measureIntrinsic: () => ({
      status: "measured" as const,
      minContent: { width: 0, height: 20 },
      maxContent: { width: 100, height: 20 },
    }),
    measure: ({ constraints }) => {
      adaptiveFiniteCalls++;
      return {
        status: "measured" as const,
        size: {
          width: Math.min(100, constraints.maxWidth),
          height: constraints.maxWidth >= 100 ? 20 : 40,
        },
      };
    },
  },
);

function createWasmFlexIntrinsicPrimitiveContent(canvas: HTMLCanvasElement) {
  const minimum = signal(40);
  const owner = signal(80);
  const escaped = signal(false);
  const minimumOverride = computed(() => escaped.get() ? 0 : undefined);
  const escapeLabel = computed(() => escaped.get() ? "0" : "none");
  const paint = signal("#426b61");
  const followerHits = signal(0);
  const columnFollowerHits = signal(0);
  const exactCapHits = signal(0);
  const adaptiveOwner = signal(140);
  const adaptivePaint = signal("#426b61");
  const adaptiveHits = signal(0);
  const stamp = ++nextStamp;
  let disposed = false;

  let exactCapMeasureCalls = 0;
  let exactCapStamp = 0;
  const exactCapBases: Partial<Record<ExactCapAxis, DOMMatrix>> = {};
  const exactCapBoxes: Partial<Record<ExactCapAxis, Record<ExactCapName, { x: number; y: number; width: number; height: number; stamp: number }>>> = {};
  function ExactCapCell({ axis, name, hits, style: _style }: { axis: ExactCapAxis; name: ExactCapName; hits: WritableSignal<number>; style: BoxStyle & FlexItemStyle }) {
    const box = useLayoutBox();
    const matrix = useCanvasContext().getTransform();
    const basis = exactCapBases[axis]!;
    const point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    const stamp = useConst(() => ++exactCapStamp);
    (exactCapBoxes[axis] ??= {} as Record<ExactCapName, { x: number; y: number; width: number; height: number; stamp: number }>)[name] = { x: point.x, y: point.y, width: box.width, height: box.height, stamp };
    return <Rectangle
      onClick={name === "B" ? () => hits.update(value => value + 1) : undefined}
      style={{ width: box.width, height: box.height, fill: name === "A" ? "#6e3e79" : "#426b61", cursor: name === "B" ? "pointer" : undefined }}
    />;
  }

  const ExactPercentageCap = definePrimitive<{ axis: ExactCapAxis; hits: WritableSignal<number> }, ExactCapStyle, ExactCapStyle, SystemStyle & { width: number; height: number }>(
    function renderExactPercentageCap(props) {
      const box = useLayoutBox();
      exactCapBases[props.axis] = useCanvasContext().getTransform();
      const row = props.axis === "row";
      const firstStyle = row ?
        { width: 40, height: 20, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, maxWidth: "25%" as const } :
        { width: 20, height: 40, flexBasis: 40, flexGrow: 0, flexShrink: 0, minHeight: 0, maxHeight: "25%" as const };
      const secondStyle = row ?
        { width: 20, height: 20, flexBasis: 20, flexGrow: 0, flexShrink: 0, minWidth: 0 } :
        { width: 20, height: 20, flexBasis: 20, flexGrow: 0, flexShrink: 0, minHeight: 0 };
      return (
        <Flex style={{ width: box.width, height: box.height, flexDirection: props.axis, alignItems: "flex-start" }}>
          <ExactCapCell key="A" axis={props.axis} name="A" hits={props.hits} style={firstStyle} />
          <ExactCapCell key="B" axis={props.axis} name="B" hits={props.hits} style={secondStyle} />
        </Flex>
      );
    },
    {
      preserveSignalProps: ["hits"],
      resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
      measureIntrinsic: () => ({
        status: "unsupported" as const,
        reason: "Percentage main bounds require an exact main-axis owner.",
      }),
      measure: ({ props, constraints, measureElement }): MeasureResult => {
        exactCapMeasureCalls++;
        const row = props.axis === "row";
        return measureElement(
          <Flex style={{ flexDirection: props.axis, flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Rectangle style={{ width: row ? 40 : 20, height: row ? 20 : 40, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: row ? 0 : undefined, minHeight: row ? undefined : 0, maxWidth: row ? "25%" : undefined, maxHeight: row ? undefined : "25%" }} />
            <Rectangle style={{ width: 20, height: 20, flexBasis: 20, flexGrow: 0, flexShrink: 0, minWidth: row ? 0 : undefined, minHeight: row ? undefined : 0 }} />
          </Flex>,
          row ?
            { minWidth: constraints.minWidth, maxWidth: constraints.maxWidth, minHeight: 0, maxHeight: Number.POSITIVE_INFINITY } :
            { minWidth: 0, maxWidth: Number.POSITIVE_INFINITY, minHeight: constraints.minHeight, maxHeight: constraints.maxHeight },
        );
      },
    },
  );


  function Button({
    x,
    y = 96,
    label,
    click,
    fill = "#19375b",
  }: {
    x: number;
    y?: number;
    label: string;
    click(): void;
    fill?: string;
  }) {
    return (
      <>
        <Rectangle
          onClick={click}
          style={{
            left: x,
            top: y,
            width: 160,
            height: 36,
            fill,
            cursor: "pointer",
          }}
        />
        <Text
          pointerEvents="none"
          style={{ left: x + 12, top: y + 10, font: "14px sans-serif", fill: "#ffffff" }}
        >
          {label}
        </Text>
      </>
    );
  }

  const node = (
    <>
      <Rectangle style={{ width: 760, height: 360, fill: "#f3f0e8" }} />
      <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>
        WASM · custom intrinsic leaves
      </Text>
      <Text style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}>
        Custom primitives declare content sizes. Blue targets follow measured allocations and percentage bounds.
      </Text>
      <Button
        x={28}
        label="Minimum"
        click={() => minimum.update(value => value === 40 ? 70 : 40)}
      />
      <Button
        x={204}
        label="Owner"
        click={() => owner.update(value => value === 80 ? 40 : 80)}
        fill="#426b61"
      />
      <Button
        x={380}
        label="Minimum escape"
        click={() => escaped.update(value => !value)}
        fill="#6e3e79"
      />
      <Button
        x={556}
        label="Paint only"
        click={() => paint.update(value => value === "#426b61" ? "#a63758" : "#426b61")}
      />
      <Flex
        style={{
          left: 28,
          top: 164,
          width: owner,
          height: 20,
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        <IntrinsicChip
          minimum={minimum}
          style={{
            height: 20,
            flexShrink: 1,
            minWidth: minimumOverride,
          }}
        />
        <Rectangle
          onClick={() => followerHits.update(value => value + 1)}
          style={{
            width: 20,
            height: 20,
            minWidth: 0,
            flexShrink: 0,
            fill: paint,
            cursor: "pointer",
          }}
        />
      </Flex>
      <Text style={{ left: 380, top: 140, font: "bold 14px sans-serif", fill: "#19375b" }}>
        Final-width adaptive leaf
      </Text>
      <Flex
        style={{
          left: 380,
          top: 164,
          width: adaptiveOwner,
          height: 60,
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        <AdaptiveIntrinsicChip
          hits={adaptiveHits}
          style={{ flexBasis: 100, flexShrink: 1, minWidth: 0 }}
        />
        <Rectangle
          style={{
            width: 40,
            height: 20,
            minWidth: 0,
            flexShrink: 0,
            fill: adaptivePaint,
          }}
        />
      </Flex>
      <Button
        x={380}
        y={250}
        label="Adaptive owner"
        click={() => adaptiveOwner.update(value => value === 140 ? 100 : 140)}
        fill="#6e3e79"
      />
      <Button
        x={556}
        y={250}
        label="Adaptive paint"
        click={() => adaptivePaint.update(value => value === "#426b61" ? "#a63758" : "#426b61")}
        fill="#426b61"
      />
      <Text style={{ left: 72, top: 268, font: "bold 12px sans-serif", fill: "#19375b" }}>
        Row · 25% cap + 20 px
      </Text>
      <Flex style={{ left: 72, top: 288, width: owner, height: 20, flexDirection: "column", alignItems: "flex-start" }}>
        <ExactPercentageCap axis="row" hits={exactCapHits} style={{ width: owner, height: "auto", minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
      </Flex>
      <Text style={{ left: 330, top: 234, font: "bold 12px sans-serif", fill: "#19375b" }}>
        Column · 25% cap + 20 px
      </Text>
      <Flex style={{ left: 330, top: 250, width: 20, height: owner, flexDirection: "row", alignItems: "flex-start" }}>
        <ExactPercentageCap axis="column" hits={exactCapHits} style={{ position: "absolute", left: 0, top: 0, width: "auto", height: owner, minWidth: 0, flexGrow: 0, flexShrink: 0 }} />
      </Flex>
      <Text style={{ left: 28, top: 220, font: "14px sans-serif", fill: "#475569" }}>
        Preferred: 100 × 20 · intrinsic minimum: {minimum} · owner: {owner} · explicit minWidth: {escapeLabel}
      </Text>
      <Text style={{ left: 72, top: 234, font: "bold 12px sans-serif", fill: "#19375b" }}>
        Exact-width column minimum
      </Text>
      <Flex
        style={{
          left: 28,
          top: 250,
          width: 20,
          height: 40,
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <IntrinsicChip
          minimum={minimum}
          style={{
            width: 20,
            flexBasis: 100,
            flexGrow: 0,
            flexShrink: 1,
            minHeight: minimumOverride,
          }}
        />
        <Rectangle
          onClick={() => columnFollowerHits.update(value => value + 1)}
          style={{
            width: 20,
            height: 20,
            minHeight: 0,
            flexShrink: 0,
            fill: paint,
            cursor: "pointer",
          }}
        />
      </Flex>
    </>
  );
  const read = (
    globalThis as typeof globalThis & {
      __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number>;
    }
  ).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement("pre");
  panel.style.cssText = "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  const refresh = () => {
    panel.textContent = read
      ? `EXPERIMENTAL WASM · ${Object.entries(read()).map(([key, value]) => `${key}: ${value}`).join(" · ")}\nprovider calls: ${providerCalls} · column measure calls: ${columnMeasureCalls} · exact cap measure calls: ${exactCapMeasureCalls} · stamp: ${stamp} · follower hits: ${followerHits.get()} · column follower hits: ${columnFollowerHits.get()} · exact cap hits: ${exactCapHits.get()} · minimum: ${minimum.get()} · owner: ${owner.get()} · escape: ${escaped.get()}\nadaptive owner: ${adaptiveOwner.get()} · adaptive hits: ${adaptiveHits.get()} · adaptive finite calls: ${adaptiveFiniteCalls} · adaptive paint: ${adaptivePaint.get()} · disposed: ${disposed}\nexact cap state: ${JSON.stringify({ boxes: exactCapBoxes, bases: exactCapBases })}`
      : "Normal JS build. Start Studio with --mode layout-wasm to inspect the experimental intrinsic provider.";
  };
  refresh();
  const timer = window.setInterval(refresh, 200);
  return {
    node,
    dispose() {
      disposed = true;
      window.clearInterval(timer);
      panel.remove();
    },
  };
}

let nextStamp = 0;

export function WasmFlexIntrinsicPrimitiveExample() {
  if (!(globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: unknown }).__PIBBL_LAYOUT_DIAGNOSTICS__) {
    return <Text style={{ left: 28, top: 48, font: "18px sans-serif", fill: "#19375b" }}>Start Studio with --mode layout-wasm to run this experimental intrinsic-provider example.</Text>;
  }
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() => createWasmFlexIntrinsicPrimitiveContent(canvas));
  useReaction(() => resource.dispose, []);
  return resource.node;
}
