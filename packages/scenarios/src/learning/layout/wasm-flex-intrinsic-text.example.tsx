import {
  useConst,
  Flex,
  Rectangle,
  Text,
  useCanvasContext,
  useReaction,
  type PibblNode,
  signal,
  useLayoutBox,
  type PibblResponsiveStyle,
  type BoxStyle,
  type FlexItemStyle,
} from "@pibbl/core";

function createWasmFlexIntrinsicTextExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  const width = signal(420);
  const font = signal("16px sans-serif");
  const ink = signal("#19375b");
  const paragraph = signal(
    "This built-in column has no declared height. Its wrapped Text determines the height before the next sibling is placed. Narrow it or change the text.",
  );
  const longText = paragraph.get();
  const footerClicks = signal(0);
  function Footer({
    style: _specifiedStyle,
  }: {
    style: PibblResponsiveStyle<BoxStyle & FlexItemStyle>;
  }) {
    const box = useLayoutBox();
    return (
      <>
        <Rectangle
          style={{
            width: box.width,
            height: box.height,
            fill: "#426b61",
            cursor: "pointer",
          }}
          onClick={() => footerClicks.update((value) => value + 1)}
        />
        <Text
          pointerEvents="none"
          style={{
            left: 12,
            top: 10,
            font: "14px sans-serif",
            fill: "#ffffff",
          }}
        >
          Following sibling · click
        </Text>
      </>
    );
  }
  node = (
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
        WASM · Intrinsic column
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        Only the parent has a width. The inner Flex takes its height from
        wrapped Text.
      </Text>
      <Rectangle
        style={{
          left: 28,
          top: 96,
          width: 180,
          height: 36,
          fill: "#19375b",
          cursor: "pointer",
        }}
        onClick={() => width.update((value) => (value === 420 ? 180 : 420))}
      />
      <Text
        pointerEvents="none"
        style={{ left: 40, top: 106, font: "14px sans-serif", fill: "#ffffff" }}
      >
        Toggle width
      </Text>
      <Rectangle
        style={{
          left: 224,
          top: 96,
          width: 180,
          height: 36,
          fill: "#426b61",
          cursor: "pointer",
        }}
        onClick={() =>
          paragraph.update((value) =>
            value === longText
              ? "Short text sets a shorter intrinsic height."
              : value.endsWith(".")
                ? "Short text sets a shorter intrinsic height!"
                : longText,
          )
        }
      />
      <Text
        pointerEvents="none"
        style={{
          left: 236,
          top: 106,
          font: "14px sans-serif",
          fill: "#ffffff",
        }}
      >
        Change text
      </Text>
      <Rectangle
        style={{
          left: 420,
          top: 96,
          width: 180,
          height: 36,
          fill: "#6e3e79",
          cursor: "pointer",
        }}
        onClick={() =>
          ink.update((value) => (value === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Text
        pointerEvents="none"
        style={{
          left: 432,
          top: 106,
          font: "14px sans-serif",
          fill: "#ffffff",
        }}
      >
        Paint only
      </Text>
      <Rectangle
        style={{
          left: 616,
          top: 96,
          width: 120,
          height: 36,
          fill: "#426b61",
          cursor: "pointer",
        }}
        onClick={() =>
          font.update((value) =>
            value === "16px sans-serif"
              ? "24px sans-serif"
              : value === "24px sans-serif"
                ? "24px PibblDemoFont"
                : "16px sans-serif",
          )
        }
      />
      <Text
        pointerEvents="none"
        style={{
          left: 628,
          top: 106,
          font: "14px sans-serif",
          fill: "#ffffff",
        }}
      >
        Cycle font
      </Text>
      <Flex
        style={{
          left: 28,
          top: 150,
          width,
          height: 280,
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Flex style={{ flexDirection: "column", minHeight: 0, flexShrink: 0 }}>
          <Text
            style={{
              minHeight: 0,
              flexShrink: 0,
              wrap: true,
              font,
              lineHeight: 24,
              fill: ink,
            }}
          >
            {paragraph}
          </Text>
        </Flex>
        <Footer
          style={{ width: 420, height: 36, minHeight: 0, flexShrink: 0 }}
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
  panel.style.cssText =
    "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  const refresh = () => {
    panel.textContent = `${
      read
        ? "EXPERIMENTAL WASM · " +
          Object.entries(read())
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")
        : "Normal JS build"
    }\nparent width: ${width.get()} px · font: ${font.get()} · footer hits: ${footerClicks.get()}`;
  };
  refresh();
  const timer = window.setInterval(refresh, 200);
  return {
    node,
    ...{
      dispose() {
        window.clearInterval(timer);
        panel.remove();
      },
    },
  };
}

export function WasmFlexIntrinsicTextExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmFlexIntrinsicTextExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
