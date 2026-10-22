import {
  Flex,
  Rectangle,
  Text,
  useReaction,
  type PibblNode,
  signal,
  computed,
  useConst,
  useLayoutBox,
  useCanvasContext,
  type BoxStyle,
  type FlexItemStyle,
} from "@pibbl/core";

function createWasmFlexKeyedWrapExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  const keys = signal(["A", "B", "C"]);
  const selected = signal("none");
  const ink = signal("#19375b");
  const reverseAxes = signal(false);
  const reverseLines = signal(false);
  const wrapDirection = computed(() => reverseLines.get() ? "wrap-reverse" : "wrap");
  const rowDirection = computed(() => reverseAxes.get() ? "row-reverse" : "row");
  const columnDirection = computed(() => reverseAxes.get() ? "column-reverse" : "column");
  let serial = 0,
    hits = 0;
  let rootTransform = new DOMMatrix();
  const boxes = new Map<
    string,
    { x: number; y: number; width: number; height: number; stamp: number }
  >();
  function Card({
    name,
    zone,
    style: _style,
  }: {
    name: string;
    zone: string;
    style: BoxStyle & FlexItemStyle;
  }) {
    const stamp = useConst(() => ++serial);
    const box = useLayoutBox();
    const transform = rootTransform
      .inverse()
      .multiply(useCanvasContext().getTransform());
    const id = `${zone}:${name}`;
    // Display-only rounding; rendering and targeting retain original geometry.
    boxes.set(id, {
      x: +transform.e.toFixed(3),
      y: +transform.f.toFixed(3),
      width: box.width,
      height: box.height,
      stamp,
    });
    return (
      <>
        <Rectangle
          style={{
            width: box.width,
            height: box.height,
            fill: selected.get() === id ? "#e1dbca" : "#d6e3db",
            cursor: "pointer",
          }}
          onClick={() => {
            hits++;
            selected.set(id);
          }}
        />
        <Text
          pointerEvents="none"
          style={{ left: 8, top: 8, font: "bold 14px monospace", fill: ink }}
        >{`${name} · mount ${stamp}`}</Text>
        <Text
          pointerEvents="none"
          style={{
            left: 8,
            top: 30,
            width: box.width - 16,
            wrap: true,
            font: "12px sans-serif",
            fill: ink,
          }}
        >{`${box.width} × ${box.height} px`}</Text>
        <Text
          pointerEvents="none"
          style={{
            left: 8,
            top: 52,
            width: box.width - 16,
            wrap: true,
            font: "12px sans-serif",
            fill: ink,
          }}
        >
          Click this card.
        </Text>
      </>
    );
  }
  function Collections() {
    rootTransform = useCanvasContext().getTransform();
    boxes.clear();
    const order = keys.get();
    return (
      <>
        <Flex
          style={{
            left: 28,
            top: 180,
            width: 360,
            height: 220,
            flexDirection: rowDirection,
            flexWrap: wrapDirection,
            gap: 12,
            alignContent: "flex-start",
            alignItems: "flex-start",
          }}
        >
          {order.map((name) => (
            <Card
              key={name}
              name={name}
              zone="row"
              style={{ flexBasis: 160, flexGrow: 1, minWidth: 0, height: 80 }}
            />
          ))}
        </Flex>
        <Flex
          style={{
            left: 440,
            top: 180,
            width: 292,
            height: 180,
            flexDirection: columnDirection,
            flexWrap: wrapDirection,
            gap: 12,
            alignContent: "flex-start",
            alignItems: "flex-start",
          }}
        >
          {order.map((name) => (
            <Card
              key={name}
              name={name}
              zone="column"
              style={{ flexBasis: 72, flexGrow: 1, minHeight: 0, width: 130 }}
            />
          ))}
        </Flex>
      </>
    );
  }
  function Button({
    x,
    label,
    onClick,
    width: buttonWidth = 140,
  }: {
    x: number;
    label: string;
    onClick(): void;
    width?: number;
  }) {
    return (
      <>
        <Rectangle
          style={{
            left: x,
            top: 100,
            width: buttonWidth,
            height: 36,
            fill: "#19375b",
            cursor: "pointer",
          }}
          onClick={onClick}
        />
        <Text
          pointerEvents="none"
          style={{
            left: x + 10,
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
        WASM · Keyed wrapped collections
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        Reorder keeps mount stamps. Remove releases B; restore appends a fresh
        B.
      </Text>
      <Button
        x={28}
        label="Reverse order"
        onClick={() => keys.update((value) => [...value].reverse())}
      />
      <Button
        x={180}
        label="Remove B"
        onClick={() =>
          keys.update((value) => value.filter((key) => key !== "B"))
        }
      />
      <Button
        x={332}
        label="Restore B"
        onClick={() =>
          keys.update((value) =>
            value.includes("B") ? value : [...value, "B"],
          )
        }
      />
      <Button
        x={484}
        label="Paint only"
        onClick={() =>
          ink.update((value) => (value === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Button x={636} width={96} label="Flip axes" onClick={() => reverseAxes.update(value => !value)} />
      <Text
        style={{
          left: 28,
          top: 150,
          cursor: "pointer",
          font: "bold 14px sans-serif",
          fill: "#19375b",
        }}
        onClick={() => reverseLines.update(value => !value)}
      >
        Rows · click to flip lines
      </Text>
      <Text
        style={{
          left: 440,
          top: 150,
          cursor: "pointer",
          font: "bold 14px sans-serif",
          fill: "#19375b",
        }}
        onClick={() => reverseLines.update(value => !value)}
      >
        Columns · click to flip lines
      </Text>
      <Collections />
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
      keys: keys.get(),
      reverseAxes: reverseAxes.get(),
      reverseLines: reverseLines.get(),
      selected: selected.get(),
      hits,
      boxes: Object.fromEntries(boxes),
      layout: read?.() ?? {},
      limits:
        "Finite row/declared-column wrap only; no intrinsic wrapped-container sizing, RTL or Yoga parity claim. Reversing data preserves source paint order.",
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

export function WasmFlexKeyedWrapExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() =>
    createWasmFlexKeyedWrapExampleContent(canvas),
  );
  useReaction(() => resource.dispose, []);
  return resource.node;
}
