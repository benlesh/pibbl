import {
  useConst,
  Flex,
  Rectangle,
  Text,
  useReaction,
  type PibblNode,
  signal,
  useLayoutBox,
  useCanvasContext,
  type BoxStyle,
  type FlexItemStyle,
} from "@pibbl/core";

function createWasmFlexColumnWrapExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  const height = signal(288);
  const selected = signal("none");
  const firstText = "This Text wraps inside the declared card width.";
  const secondText = "Changed Text keeps the same declared card width.";
  const content = signal(firstText);
  const ink = signal("#19375b");
  let rootTransform = new DOMMatrix();
  const boxes = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  function Card({
    name,
    style: _style,
  }: {
    name: string;
    style: BoxStyle & FlexItemStyle;
  }) {
    const box = useLayoutBox();
    const transform = rootTransform
      .inverse()
      .multiply(useCanvasContext().getTransform());
    // Remove the root surface's backing scale and letterbox transform.
    // Round diagnostics to 0.001 logical px; actual placement is unchanged.
    boxes.set(name, {
      x: +transform.e.toFixed(3),
      y: +transform.f.toFixed(3),
      width: box.width,
      height: box.height,
    });
    return (
      <>
        <Rectangle
          style={{
            width: box.width,
            height: box.height,
            fill: selected.get() === name ? "#e1dbca" : "#d6e3db",
            cursor: "pointer",
          }}
          onClick={() => selected.set(name)}
        />
        <Text
          pointerEvents="none"
          style={{ left: 12, top: 10, font: "bold 14px monospace", fill: ink }}
        >{`${name} · ${box.height} px tall`}</Text>
        <Text
          pointerEvents="none"
          style={{
            left: 12,
            top: 34,
            width: Math.max(0, box.width - 24),
            height: Math.max(0, box.height - 40),
            wrap: true,
            font: "13px sans-serif",
            lineHeight: 18,
            fill: ink,
          }}
        >
          {content}
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
            top: 100,
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
            top: 110,
            font: "14px sans-serif",
            fill: "#ffffff",
          }}
        >
          {label}
        </Text>
      </>
    );
  }
  function Workspace() {
    rootTransform = useCanvasContext().getTransform();
    return (
      <Flex
        style={{
          left: 28,
          top: 148,
          width: 440,
          height,
          flexWrap: "wrap",
          flexDirection: "column",
          gap: 12,
          alignContent: "flex-start",
          alignItems: "flex-start",
        }}
      >
        {["A", "B", "C"].map((name) => (
          <Card
            key={name}
            name={name}
            style={{ flexBasis: 84, flexGrow: 1, minHeight: 0, width: 192 }}
          />
        ))}
      </Flex>
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
        WASM · Declared column wrap
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        288 → 184 px high moves C to a second column. Widths stay declared at
        192 px.
      </Text>
      <Button
        x={28}
        label="Resize height"
        onClick={() => height.update((value) => (value === 288 ? 184 : 288))}
      />
      <Button
        x={224}
        label="Change Text"
        onClick={() =>
          content.update((value) =>
            value === firstText ? secondText : firstText,
          )
        }
      />
      <Button
        x={420}
        label="Paint only"
        onClick={() =>
          ink.update((value) => (value === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Workspace />
    </>
  );
  const read = (
    globalThis as typeof globalThis & {
      __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number>;
    }
  ).__PIBBL_LAYOUT_DIAGNOSTICS__;
  const panel = document.createElement("pre");
  panel.style.cssText =
    "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;max-height:112px;overflow:auto;width:100%;min-width:0;overflow-wrap:anywhere;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  const refresh = () => {
    panel.textContent = JSON.stringify({
      lane: read ? "experimental WASM" : "normal JavaScript",
      height: height.get(),
      selected: selected.get(),
      boxes: Object.fromEntries(boxes),
      layout: read?.() ?? {},
      limits:
        "Column wrap requires declared height/flexBasis and width. No intrinsic item or wrapped-container sizing, reverse/RTL or Yoga parity claim.",
    });
  };
  refresh();
  const timer = window.setInterval(refresh, 100);
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

export function WasmFlexColumnWrapExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmFlexColumnWrapExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
