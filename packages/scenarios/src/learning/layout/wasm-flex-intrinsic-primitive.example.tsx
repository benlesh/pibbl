import {
  Flex,
  computed,
  Rectangle,
  Text,
  definePrimitive,
  signal,
  type Signal,
  type SystemStyle,
  useCanvasContext,
  useConst,
  useLayoutBox,
  useReaction,
} from "@pibbl/core";

interface IntrinsicChipStyle extends SystemStyle {
  readonly height?: number;
  readonly flexBasis?: number;
  readonly flexShrink?: number;
  readonly minWidth?: number;
}

let providerCalls = 0;

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
  const stamp = ++nextStamp;
  let disposed = false;

  function Button({
    x,
    label,
    click,
    fill = "#19375b",
  }: {
    x: number;
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
            top: 96,
            width: 160,
            height: 36,
            fill,
            cursor: "pointer",
          }}
        />
        <Text
          pointerEvents="none"
          style={{ left: x + 12, top: 106, font: "14px sans-serif", fill: "#ffffff" }}
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
        WASM · custom intrinsic leaf
      </Text>
      <Text style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}>
        One custom primitive declares both content contributions. The blue follower keeps its paint and hit box aligned.
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
      <Text style={{ left: 28, top: 204, font: "14px sans-serif", fill: "#475569" }}>
        Preferred: 100 × 20 · intrinsic minimum: {minimum} · owner: {owner} · explicit minWidth: {escapeLabel}
      </Text>
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
      ? `EXPERIMENTAL WASM · ${Object.entries(read()).map(([key, value]) => `${key}: ${value}`).join(" · ")}\nprovider calls: ${providerCalls} · stamp: ${stamp} · follower hits: ${followerHits.get()} · minimum: ${minimum.get()} · owner: ${owner.get()} · escape: ${escaped.get()} · disposed: ${disposed}`
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
