import {
  Flex,
  Rectangle,
  Text,
  signal,
  useCanvasContext,
  useConst,
  useReaction,
} from "@pibbl/core";

let nextStamp = 0;

function createWasmFlexIntrinsicWrapContent(canvas: HTMLCanvasElement) {
  const owner = signal(160);
  const footerPaint = signal("#426b61");
  const footerHits = signal(0);
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

  function State() {
    return (
      <Text style={{ left: 28, top: 320, font: "14px sans-serif", fill: "#475569" }}>
        Owner width: {owner.get()} · footer hits: {footerHits.get()}
      </Text>
    );
  }

  const node = (
    <>
      <Rectangle style={{ width: 760, height: 360, fill: "#f3f0e8" }} />
      <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>
        WASM · intrinsic wrapped row
      </Text>
      <Text style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}>
        A finite wrapped row measures its numeric line height before the green footer is placed.
      </Text>
      <Button
        x={28}
        label="Owner width"
        click={() => owner.update(value => value === 160 ? 90 : 160)}
      />
      <Button
        x={204}
        label="Paint only footer"
        fill="#6e3e79"
        click={() => footerPaint.update(value => value === "#426b61" ? "#a63758" : "#426b61")}
      />
      <Flex
        style={{
          left: 28,
          top: 160,
          width: 200,
          height: 180,
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Flex
          style={{
            width: owner,
            minWidth: 0,
            minHeight: 0,
            flexShrink: 0,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <Rectangle style={{ width: 70, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: "#19375b" }} />
          <Rectangle style={{ width: 70, height: 30, minWidth: 0, minHeight: 0, flexShrink: 0, fill: "#6e3e79" }} />
          <Rectangle style={{ width: 70, height: 20, minWidth: 0, minHeight: 0, flexShrink: 0, fill: "#426b61" }} />
        </Flex>
        <Rectangle
          onClick={() => footerHits.update(value => value + 1)}
          style={{
            width: 80,
            height: 20,
            minWidth: 0,
            minHeight: 0,
            flexShrink: 0,
            fill: footerPaint,
            cursor: "pointer",
          }}
        />
      </Flex>
      <State />
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
      ? `EXPERIMENTAL WASM · ${Object.entries(read()).map(([key, value]) => `${key}: ${value}`).join(" · ")}\nstamp: ${stamp} · owner: ${owner.get()} · footer hits: ${footerHits.get()} · disposed: ${disposed}`
      : "Normal JS build. Start Studio with --mode layout-wasm to inspect the experimental wrapped intrinsic measurement.";
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

export function WasmFlexIntrinsicWrapExample() {
  if (!(globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: unknown }).__PIBBL_LAYOUT_DIAGNOSTICS__) {
    return <Text style={{ left: 28, top: 48, font: "18px sans-serif", fill: "#19375b" }}>Start Studio with --mode layout-wasm to run this experimental wrapped intrinsic example.</Text>;
  }
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const resource = useConst(() => createWasmFlexIntrinsicWrapContent(canvas));
  useReaction(() => resource.dispose, []);
  return resource.node;
}
