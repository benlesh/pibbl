import {
  useConst,
  Flex,
  Layer,
  Rectangle,
  Text,
  useCanvasContext,
  useReaction,
  signal,
  computed,
  useLayoutBox,
  defineRenderLayer,
  type PibblNode,
  type BoxStyle,
  type FlexItemStyle,
  type PibblResponsiveStyle,
} from "@pibbl/core";

function createWasmFlexPanelExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  const revision = signal(0);
  const width = computed(() => (revision.get() % 2 === 0 ? 680 : 420));
  const contentInk = signal("#ffffff");
  const background = signal("#f3f0e8");
  const hits = signal(0);
  const rasters: { width: number; revision: number }[] = [];
  let panelTraversals = 0;
  let cleanRasters = 0,
    creates = 0,
    disposes = 0,
    lastHit = -1;
  const resizeWidths: number[] = [];
  const target = {};
  let refresh = () => {};
  const External = defineRenderLayer<
    { stamp: number; ink: string },
    { ctx: OffscreenCanvasRenderingContext2D; stamp: number; ink: string }
  >({
    create(context, props) {
      creates++;
      const ctx = context.canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D renderer unavailable");
      return { ctx, ...props };
    },
    update(resources, props) {
      resources.stamp = props.stamp;
      resources.ink = props.ink;
    },
    resize(_resources, size) {
      resizeWidths.push(size.width);
    },
    render(resources, _frame, context) {
      const { ctx, stamp, ink } = resources,
        size = context.size;
      rasters.push({ width: size.width, revision: stamp });
      ctx.setTransform(size.pixelRatioX, 0, 0, size.pixelRatioY, 0, 0);
      ctx.fillStyle = stamp % 2 ? "#a63758" : "#19375b";
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.fillStyle = ink;
      ctx.font = "18px sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText(`Renderer ${stamp} · ${size.width} px`, 12, 16);
      ctx.font = "14px sans-serif";
      ctx.fillText("Click the outlined right edge.", 12, 64);
      ctx.strokeStyle = "#ffe59d";
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.max(1, size.width - 46), 2, 44, size.height - 4);
    },
    interaction: {
      settle(_resources, props, size) {
        return {
          targets: [
            {
              target,
              cursor: "pointer",
              handlers: {
                onClick() {
                  lastHit = props.stamp;
                  hits.update((value) => value + 1);
                },
              },
              keyboardNavigationBounds: {
                x: Math.max(0, size.width - 48),
                y: 0,
                width: Math.min(48, size.width),
                height: size.height,
              },
            },
          ],
          hitTest: (point) =>
            point.x >= Math.max(0, size.width - 48) &&
            point.x < size.width &&
            point.y >= 0 &&
            point.y < size.height
              ? { kind: "target", target }
              : { kind: "miss" },
        };
      },
    },
    dispose() {
      disposes++;
      refresh();
    },
  });
  // A normal reusable component: Pibbl supplies allocation; the application
  // composes Layer and children through public APIs without exposing structure.
  function Panel({
    children,
    style: _specifiedStyle,
  }: {
    children: PibblNode;
    style: PibblResponsiveStyle<BoxStyle & FlexItemStyle>;
  }) {
    panelTraversals++;
    const box = useLayoutBox();
    return (
      <Layer style={{ width: box.width, height: box.height }}>{children}</Layer>
    );
  }
  function Content() {
    return <External stamp={revision.get()} ink={contentInk.get()} />;
  }
  function CleanContent() {
    cleanRasters++;
    const box = useLayoutBox();
    return (
      <>
        <Rectangle
          style={{ width: box.width, height: box.height, fill: "#426b61" }}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 12,
            top: 16,
            width: box.width - 24,
            wrap: true,
            font: "14px sans-serif",
            fill: "#ffffff",
          }}
        >
          Clean sibling bitmap
        </Text>
      </>
    );
  }
  function Button({
    x,
    label,
    onClick,
  }: {
    x: number;
    label: string;
    onClick(): void;
  }) {
    return (
      <>
        <Rectangle
          style={{
            left: x,
            top: 96,
            width: 180,
            height: 36,
            fill: "#19375b",
            cursor: "pointer",
          }}
          onClick={onClick}
        />
        <Text
          pointerEvents="none"
          style={{
            left: x + 12,
            top: 106,
            font: "14px sans-serif",
            fill: "#ffffff",
          }}
        >
          {label}
        </Text>
      </>
    );
  }
  node = (
    <>
      <Rectangle style={{ width: 760, height: 460, fill: background }} />
      <Text
        style={{
          left: 28,
          top: 24,
          font: "bold 24px sans-serif",
          fill: "#19375b",
        }}
      >
        WASM · Reusable panel
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        An ordinary panel returns a Layer. Allocation flows through it without
        inspection.
      </Text>
      <Button
        x={28}
        label="Resize + content"
        onClick={() => revision.update((value) => value + 1)}
      />
      <Button
        x={224}
        label="Content only"
        onClick={() =>
          contentInk.update((value) =>
            value === "#ffffff" ? "#ffe59d" : "#ffffff",
          )
        }
      />
      <Button
        x={420}
        label="Root paint only"
        onClick={() =>
          background.update((value) =>
            value === "#f3f0e8" ? "#e8e4da" : "#f3f0e8",
          )
        }
      />
      <Flex style={{ left: 28, top: 160, width, height: 220, gap: 16 }}>
        <Panel style={{ flexBasis: 0, flexGrow: 1, minWidth: 0, height: 220 }}>
          <Content />
        </Panel>
        <Layer style={{ width: 120, minWidth: 0, height: 220, flexShrink: 0 }}>
          <CleanContent />
        </Layer>
      </Flex>
    </>
  );
  const read = (
    globalThis as typeof globalThis & {
      __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number>;
    }
  ).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement("pre");
  panel.style.cssText =
    "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  refresh = () => {
    panel.textContent = `${
      read
        ? "EXPERIMENTAL WASM · " +
          Object.entries(read())
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")
        : "Normal JS build"
    }\nparent width: ${width.get()} px · panel traversals: ${panelTraversals} · renderer renders: ${rasters.length} · creates: ${creates} · disposes: ${disposes} · clean rasters: ${cleanRasters} · hits: ${hits.get()} · last hit: ${lastHit}\nresize widths: ${resizeWidths.join(", ")}\nrender sizes: ${rasters
      .slice(-4)
      .map((value) => `${value.revision}@${value.width}px`)
      .join(", ")}`;
  };
  refresh();
  const timer = window.setInterval(refresh, 200);
  return {
    node,
    ...{
      dispose() {
        window.clearInterval(timer);
        refresh();
        panel.remove();
      },
    },
  };
}

export function WasmFlexPanelExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() => createWasmFlexPanelExampleContent(canvas));
  useReaction(() => resource.dispose, []);
  return resource.node;
}
