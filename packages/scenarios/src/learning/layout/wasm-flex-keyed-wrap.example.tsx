import {
  Flex,
  FocusManagement,
  Group,
  Layer,
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
import { opacity } from "@pibbl/core/filters";

function createWasmFlexKeyedWrapExampleContent(canvas: HTMLCanvasElement) {
  let node: PibblNode;
  const keys = signal(["A", "B", "C"]);
  const selected = signal("none");
  const ink = signal("#19375b");
  const layoutDirection = signal<"ltr" | "rtl">("ltr");
  const logicalMargin = signal<number | "10%">(0);
  const reverseAxes = signal(false);
  const reverseLines = signal(false);
  const crossEdge = signal<"flex-start" | "start" | "end">("flex-start");
  const compositionMode = signal(false);
  const bTargets = signal(true);
  const bFill = signal("#a63758");
  const compositionFocus = signal("none");
  const compositionHits = signal<string[]>([]);
  const wrapDirection = computed(() => reverseLines.get() ? "wrap-reverse" : "wrap");
  const rowDirection = computed(() => reverseAxes.get() ? "row-reverse" : "row");
  const columnDirection = computed(() => reverseAxes.get() ? "column-reverse" : "column");
  let serial = 0,
    hits = 0;
  let rootTransform = new DOMMatrix();
  let rootBasis = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
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
  function CompositionPanel({
    name,
    style: _style,
  }: {
    name: "A" | "B";
    style: BoxStyle & FlexItemStyle;
  }) {
    const stamp = useConst(() => ++serial);
    const box = useLayoutBox();
    const transform = rootTransform
      .inverse()
      .multiply(useCanvasContext().getTransform());
    const id = `composition:${name}`;
    boxes.set(id, {
      x: +(transform.e + 2).toFixed(3),
      y: +transform.f.toFixed(3),
      width: box.width,
      height: box.height,
      stamp,
    });
    const content = (
      <Rectangle
        keyboardFocusable
        pointerEvents={name === "B" && !bTargets.get() ? "none" : "auto"}
        style={{
          width: box.width,
          height: box.height,
          fill: name === "A" ? "#19375b" : bFill.get(),
          cursor: "pointer",
        }}
        onFocus={() => compositionFocus.set(name)}
        onClick={() => {
          compositionHits.update((value) => [...value, name]);
          selected.set(id);
        }}
      />
    );
    return (
      <Group style={{ translateX: 2 }}>
        {name === "B" ? (
          <Layer style={{ width: box.width, height: box.height }}>
            <Group style={{ filter: opacity({ amount: 0.5 }) }}>{content}</Group>
          </Layer>
        ) : content}
      </Group>
    );
  }
  function CompositionOrder() {
    rootTransform = useCanvasContext().getTransform();
    rootBasis = {
      a: rootTransform.a,
      b: rootTransform.b,
      c: rootTransform.c,
      d: rootTransform.d,
      e: rootTransform.e,
      f: rootTransform.f,
    };
    boxes.clear();
    return (
      <>
      <Text pointerEvents="none" style={{left:28,top:200,font:"14px sans-serif",fill:"#475569"}}>Click the overlap. Switch off B's target to reach A underneath.</Text>
      <FocusManagement>
        <Flex
          style={{
            left: 28,
            top: 230,
            width: 100,
            height: 30,
            layoutDirection,
            flexDirection: rowDirection,
            alignItems: "flex-start",
          }}
        >
          <CompositionPanel
            key="composition:A"
            name="A"
            style={{ width: 60, height: 30, minWidth: 0, flexShrink: 0 }}
          />
          <CompositionPanel
            key="composition:B"
            name="B"
            style={{
              width: 60,
              height: 30,
              minWidth: 0,
              flexShrink: 0,
              marginStart: -20,
              marginEnd: -20,
            }}
          />
        </Flex>
      </FocusManagement>
      <Text pointerEvents="none" style={{left:28,top:280,font:"14px sans-serif",fill:"#475569"}}>A is blue. B is translucent and paints after A.</Text>
      </>
    );
  }
  function Collections() {
    if (compositionMode.get()) return <CompositionOrder />;
    rootTransform = useCanvasContext().getTransform();
    rootBasis = {
      a: rootTransform.a,
      b: rootTransform.b,
      c: rootTransform.c,
      d: rootTransform.d,
      e: rootTransform.e,
      f: rootTransform.f,
    };
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
            layoutDirection,
            flexDirection: rowDirection,
            flexWrap: wrapDirection,
            gap: 12,
            alignContent: crossEdge,
            alignItems: crossEdge,
          }}
        >
          {order.map((name) => (
            <Card
              key={name}
              name={name}
              zone="row"
              style={{ flexBasis: 160, flexGrow: 1, minWidth: 0, height: 80, marginStart: logicalMargin.get() === 0 ? undefined : logicalMargin.get() }}
            />
          ))}
        </Flex>
        <Flex
          style={{
            left: 440,
            top: 180,
            width: 292,
            height: 180,
            layoutDirection,
            flexDirection: columnDirection,
            flexWrap: wrapDirection,
            gap: 12,
            alignContent: crossEdge,
            alignItems: crossEdge,
          }}
        >
          {order.map((name) => (
            <Card
              key={name}
              name={name}
              zone="column"
              style={{ flexBasis: 72, flexGrow: 1, minHeight: 0, width: 130, marginStart: logicalMargin.get() === 0 ? undefined : logicalMargin.get() }}
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
    y = 100,
  }: {
    x: number;
    label: string;
    onClick(): void;
    width?: number;
    y?: number;
  }) {
    return (
      <>
        <Rectangle
          style={{
            left: x,
            top: y,
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
  function Caption() {
    return (
      <Text
        pointerEvents="none"
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        {compositionMode.get()
          ? "Later B stays on top as positions reverse."
          : "Reverse positions; keyed cards keep their identity."}
      </Text>
    );
  }
  function CompositionControls() {
    return (
      <>
        <Button
          x={440}
          y={60}
          width={140}
          label="Composition order"
          onClick={() => compositionMode.update((value) => !value)}
        />
        <Button
          x={592}
          y={60}
          width={140}
          label={`B target: ${bTargets.get() ? "on" : "off"}`}
          onClick={() => bTargets.update((value) => !value)}
        />
      </>
    );
  }
  function LogicalCrossLabel() {
    return (
      <Text
        pointerEvents="none"
        style={{ left: 258, top: 149, font: "13px sans-serif", fill: "#ffffff" }}
      >
        Logical cross: {crossEdge.get()}
      </Text>
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
      <Caption />
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
        onClick={() => {
          if (compositionMode.get()) {
            bFill.update((value) => value === "#a63758" ? "#426b61" : "#a63758");
          } else {
            ink.update((value) => value === "#19375b" ? "#a63758" : "#19375b");
          }
        }}
      />
      <CompositionControls />
      <Button x={636} width={96} label="Flip axes" onClick={() => reverseAxes.update(value => !value)} />
      <Rectangle
        style={{
          left: 248,
          top: 142,
          width: 180,
          height: 28,
          fill: "#6e3e79",
          cursor: "pointer",
        }}
        onClick={() =>
          crossEdge.update((value) =>
            value === "flex-start" ? "start" : value === "start" ? "end" : "flex-start",
          )
        }
      />
      <LogicalCrossLabel />
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
      <Text style={{ left: 648, top: 150, cursor: "pointer", font: "bold 14px sans-serif", fill: "#19375b" }} onClick={() => layoutDirection.update(value => value === "ltr" ? "rtl" : "ltr")}>
        {layoutDirection.get().toUpperCase()} ⇄
      </Text>
      <Text style={{ left: 28, top: 420, cursor: "pointer", font: "bold 14px sans-serif", fill: "#19375b" }} onClick={() => logicalMargin.update(value => value === 0 ? "10%" : 0)}>
        Logical start margin: {logicalMargin.get()} · click to toggle
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
      logicalMargin: logicalMargin.get(),
      layoutDirection: layoutDirection.get(),
      reverseAxes: reverseAxes.get(),
      reverseLines: reverseLines.get(),
      crossEdge: crossEdge.get(),
      composition: {
        mode: compositionMode.get(),
        targets: bTargets.get(),
        boxes: Object.fromEntries(boxes),
        focus: compositionFocus.get(),
        hits: compositionHits.get(),
        bFill: bFill.get(),
        rootBasis,
      },
      selected: selected.get(),
      hits,
      boxes: Object.fromEntries(boxes),
      layout: read?.() ?? {},
      limits:
        "Finite wrapping examples. Direction changes move boxes without reordering source paint or keyboard traversal. Composition mode covers Group, Layer, filters and pointer opt-out.",
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
