import {
  useConst,
  Flex,
  Layer,
  Rectangle,
  Text,
  useReaction,
  type PibblNode,
  signal,
  useLayoutBox,
  useCanvasContext,
  defineRenderLayer,
  type BoxStyle,
  type FlexItemStyle,
} from "@pibbl/core";

function createWasmBuiltLifecycleExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  const width = signal(420);
  const shortText = "A constrained paragraph.";
  const longText =
    "A constrained paragraph wraps at the final panel width. Changing this signal moves the renderer below it while its edge target follows the same committed geometry.";
  const text = signal(shortText);
  const read = (
    globalThis as typeof globalThis & {
      __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number>;
    }
  ).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const baseline = read?.() ?? {};
  const mounted = signal(true);
  let rendererCreates = 0,
    rendererDisposes = 0,
    rendererWidth = 0,
    rendererY = 0,
    hits = 0;
  const target = {};
  const Edge = defineRenderLayer<object, OffscreenCanvasRenderingContext2D>({
    create(context) {
      const ctx = context.canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D renderer unavailable");
      rendererCreates++;
      return ctx;
    },
    render(ctx, _frame, context) {
      rendererWidth = context.size.width;
      ctx.setTransform(
        context.size.pixelRatioX,
        0,
        0,
        context.size.pixelRatioY,
        0,
        0,
      );
      ctx.fillStyle = "#426b61";
      ctx.fillRect(0, 0, context.size.width, context.size.height);
      ctx.strokeStyle = "#ffe59d";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        Math.max(1, context.size.width - 32),
        2,
        30,
        context.size.height - 4,
      );
    },
    interaction: {
      settle(_ctx, _props, size) {
        return {
          targets: [
            {
              target,
              cursor: "pointer",
              handlers: {
                onClick() {
                  hits++;
                },
              },
            },
          ],
          hitTest: (point) =>
            point.x >= Math.max(0, size.width - 32) &&
            point.x < size.width &&
            point.y >= 0 &&
            point.y < size.height
              ? { kind: "target", target }
              : { kind: "miss" },
        };
      },
    },
    dispose() {
      rendererDisposes++;
    },
  });
  function EdgeRow({ style: _style }: { style: BoxStyle & FlexItemStyle }) {
    const box = useLayoutBox();
    const transform = useCanvasContext().getTransform();
    rendererY = transform.f / transform.d; // Layer-local origin in this unrotated scenario.
    return <Edge style={{ width: box.width, height: box.height }} />;
  }
  function Panel({ style: _style }: { style: BoxStyle & FlexItemStyle }) {
    const box = useLayoutBox();
    return (
      <Layer style={{ width: box.width, height: box.height }}>
        <Flex
          style={{
            width: box.width,
            height: box.height,
            flexDirection: "column",
            gap: 8,
            alignItems: "stretch",
          }}
        >
          <Text
            pointerEvents="none"
            style={{
              wrap: true,
              font: "16px sans-serif",
              lineHeight: 22,
              fill: "#19375b",
              minHeight: 0,
              flexShrink: 0,
            }}
          >
            {text}
          </Text>
          <EdgeRow style={{ height: 36, minHeight: 0, flexShrink: 0 }} />
        </Flex>
      </Layer>
    );
  }
  function Content() {
    return mounted.get() ? (
      <>
        <Rectangle style={{ width: 760, height: 460, fill: "#f3f0e8" }} />
        <Text
          style={{
            left: 28,
            top: 24,
            font: "bold 24px sans-serif",
            fill: "#19375b",
          }}
        >
          WASM · Built consumer lifecycle
        </Text>
        <Text
          style={{
            left: 28,
            top: 66,
            width: 700,
            wrap: true,
            font: "14px sans-serif",
            fill: "#475569",
          }}
        >
          Resize, change Text, then click the outlined right edge. Remove and
          remount the content with the controls below the canvas.
        </Text>
        <Flex style={{ left: 28, top: 148, width, height: 280, gap: 16 }}>
          <Panel
            style={{ flexBasis: 0, flexGrow: 1, minWidth: 0, height: 280 }}
          />
          <Rectangle
            style={{
              width: 80,
              height: 280,
              minWidth: 0,
              flexShrink: 0,
              fill: "#d6e3db",
            }}
          />
        </Flex>
      </>
    ) : null;
  }
  function start() {
    mounted.set(true);
  }
  function stop() {
    mounted.set(false);
    mounted.set(false);
  } // Repeated removal is harmless.
  node = <Content />;
  const controls = document.createElement("div");
  const status = document.createElement("pre");
  controls.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;padding:12px";
  status.style.cssText =
    "font:12px monospace;white-space:pre-wrap;padding:12px;max-height:112px;overflow:auto;width:100%;min-width:0;overflow-wrap:anywhere;background:#e7e5df;color:#19375b";
  const refresh = () => {
    status.textContent = JSON.stringify(
      {
        mounted: mounted.get(),
        width: width.get(),
        rendererWidth,
        rendererY,
        rendererCreates,
        rendererDisposes,
        hits,
        baseline,
        layout: read?.() ?? {},
        lane: read ? "experimental WASM" : "normal JavaScript",
      },
      null,
      2,
    );
  };
  const button = (label: string, action: () => void) => {
    const element = document.createElement("button");
    element.textContent = label;
    element.onclick = () => {
      action();
      refresh();
    };
    controls.append(element);
  };
  button("Resize", () => width.update((value) => (value === 420 ? 240 : 420)));
  button("Change text", () =>
    text.update((value) => (value === shortText ? longText : shortText)),
  );
  button("Dispose mount", stop);
  button("Mount", start);
  canvas.insertAdjacentElement("afterend", controls);
  controls.insertAdjacentElement("afterend", status);
  refresh();
  const timer = window.setInterval(refresh, 100);
  return {
    node,
    ...{
      dispose() {
        window.clearInterval(timer);
        controls.remove();
        status.remove();
      },
    },
  };
}

export function WasmBuiltLifecycleExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmBuiltLifecycleExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
