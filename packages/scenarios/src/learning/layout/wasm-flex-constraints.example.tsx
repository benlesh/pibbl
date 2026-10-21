import {
  useConst,
  Flex,
  Rectangle,
  Text,
  useCanvasContext,
  useReaction,
  type PibblNode,
  signal,
  computed,
  useLayoutBox,
  type BoxStyle,
  type FlexItemStyle,
  type PibblResponsiveStyle,
} from "@pibbl/core";

function createWasmFlexConstraintsExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  const shortfall = signal(false);
  const minimum = signal(0);
  const width = computed(() => (shortfall.get() ? 320 : 680));
  const basis = computed(() => (shortfall.get() ? 300 : 100));
  const description = computed(() =>
    shortfall.get()
      ? "Shrink stops at the minimum."
      : "Growth stops at this panel’s maximum. Remaining space flows to its sibling. Click to check the current hit target.",
  );
  const maximum = signal(1000);
  const grow = signal(1);
  const ink = signal("#19375b");
  const selected = signal("none");
  function Button({
    x,
    y = 96,
    label,
    onClick,
  }: {
    x: number;
    y?: number;
    label: string;
    onClick(): void;
  }) {
    return (
      <>
        <Rectangle
          style={{
            left: x,
            top: y,
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
            top: y + 10,
            font: "14px sans-serif",
            fill: "#ffffff",
          }}
        >
          {label}
        </Text>
      </>
    );
  }
  function Panel({
    name,
    style: _specifiedStyle,
  }: {
    name: string;
    style: PibblResponsiveStyle<BoxStyle & FlexItemStyle>;
  }) {
    const box = useLayoutBox();
    return (
      <>
        <Rectangle
          style={{
            width: box.width,
            height: box.height,
            fill: name === "A" ? "#e1dbca" : "#d6e3db",
            cursor: "pointer",
          }}
          onClick={() => selected.set(name)}
        />
        <Text
          pointerEvents="none"
          style={{ left: 12, top: 12, font: "bold 12px sans-serif", fill: ink }}
        >{`Panel ${name} · ${box.width} px`}</Text>
        <Text
          pointerEvents="none"
          style={{
            left: 12,
            top: 44,
            width: box.width - 24,
            wrap: true,
            lineHeight: 24,
            font: "16px sans-serif",
            fill: ink,
          }}
        >
          {description}
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
        WASM · Constrained growth
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        Cap A at 180 px. Remaining space belongs to B. Then change A’s growth.
      </Text>
      <Button
        x={28}
        label="Toggle A cap"
        onClick={() => maximum.update((value) => (value === 1000 ? 180 : 1000))}
      />
      <Button
        x={224}
        label="Toggle A growth"
        onClick={() => grow.update((value) => (value === 1 ? 3 : 1))}
      />
      <Button
        x={420}
        label="Paint only"
        onClick={() =>
          ink.update((value) => (value === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Button
        x={28}
        y={140}
        label="Toggle shortfall"
        onClick={() => shortfall.update((value) => !value)}
      />
      <Button
        x={224}
        y={140}
        label="Toggle A floor"
        onClick={() => minimum.update((value) => (value === 0 ? 180 : 0))}
      />
      <Flex style={{ left: 28, top: 180, width, height: 240, gap: 16 }}>
        <Panel
          name="A"
          style={{
            flexBasis: basis,
            flexGrow: grow,
            flexShrink: 1,
            minWidth: minimum,
            maxWidth: maximum,
            height: 240,
          }}
        />
        <Panel
          name="B"
          style={{
            flexBasis: basis,
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            height: 240,
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
    }\nwidth: ${width.get()} px · basis: ${basis.get()} px · A minimum: ${minimum.get()} px · A maximum: ${maximum.get()} px · A growth: ${grow.get()} · selected: ${selected.get()}`;
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

export function WasmFlexConstraintsExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmFlexConstraintsExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
