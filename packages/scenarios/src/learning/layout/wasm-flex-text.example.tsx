import {
  Flex,
  Rectangle,
  Text,
  useConst,
  useReaction,
  untracked,
  useCanvasContext,
  signal,
  computed,
} from "@pibbl/core";

// Application authoring stays unchanged. This experiment is selected by the
// Studio build (--mode layout-wasm), never by a per-component engine option.
function createWasmFlexTextContent() {
  const primaryWidth = signal(560);
  const alternateWidth = signal(560);
  const alternate = signal(false);
  const activeWidth = () => (alternate.get() ? alternateWidth : primaryWidth);
  const width = computed(() =>
    Math.max(240, Math.min(640, Math.floor(activeWidth().get() / 40) * 40)),
  );
  const ink = signal("#19375b");
  const longText =
    "Pibbl measures this paragraph at its final allocated width. Narrow the workspace and each paragraph gains lines as the text wraps.";
  const shortText = "Pibbl keeps text reactive.";
  const alternateText = "Pibbl keeps text dynamic.";
  const paragraph = signal(longText);
  const secondText =
    "Second paragraph: keyed text keeps its own subscription and measurement cache. Remove, update, then restore B.";
  const updatedSecondText =
    "Second paragraph updated: B changed while absent. Restoring attaches its input again without replacing A.";
  const secondaryParagraph = signal(secondText);
  const keys = signal<readonly ("A" | "B")[]>(["A", "B"]);
  const selected = signal("none");
  const frozenProof = signal(false);
  function Button({
    x,
    y,
    label,
    onClick,
    width: buttonWidth = 160,
    fill = "#426b61",
  }: {
    x: number;
    y: number;
    label: string;
    onClick(): void;
    width?: number;
    fill?: string;
  }) {
    return (
      <>
        <Rectangle
          style={{
            left: x,
            top: y,
            width: buttonWidth,
            height: 36,
            fill,
            cursor: "pointer",
          }}
          onClick={onClick}
        />
        <Text
          pointerEvents="none"
          style={{
            left: x + 12,
            top: y + 10,
            fill: "#ffffff",
            font: "14px sans-serif",
          }}
        >
          {label}
        </Text>
      </>
    );
  }
  function Paragraphs() {
    return (
      <Flex
        style={{
          left: 28,
          top: 260,
          width,
          height: 200,
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Flex
          style={{
            width: "100%",
            height: 200,
            minHeight: 0,
            flexShrink: 0,
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          {keys.get().map((key) => (
            <Text
              key={key}
              onClick={() => selected.set(key)}
              style={{
                flexBasis: 270,
                minWidth: 0,
                flexGrow: 1,
                flexShrink: 1,
                wrap: true,
                font: "16px sans-serif",
                lineHeight: 24,
                fill: ink,
                cursor: "pointer",
              }}
            >
              {key === "A" ? paragraph : secondaryParagraph}
            </Text>
          ))}
        </Flex>
      </Flex>
    );
  }
  // Existing Object.freeze authoring opts this small static subtree into the
  // experimental proof. The ordinary paragraphs keep the conservative path.
  const frozenA = <Text key="frozen-A" onClick={() => selected.set("frozen A")} style={Object.freeze({ flexBasis: 270, minWidth: 0, flexGrow: 1, flexShrink: 1, wrap: true, font: "16px sans-serif", lineHeight: 24, fill: ink, cursor: "pointer" })}>{paragraph}</Text>;
  const frozenB = <Text key="frozen-B" onClick={() => selected.set("frozen B")} style={Object.freeze({ flexBasis: 270, minWidth: 0, flexGrow: 1, flexShrink: 1, wrap: true, font: "16px sans-serif", lineHeight: 24, fill: ink, cursor: "pointer" })}>{secondaryParagraph}</Text>;
  Object.freeze(frozenA.props); Object.freeze(frozenA);
  Object.freeze(frozenB.props); Object.freeze(frozenB);
  const frozenChildren = Object.freeze([frozenA, frozenB]);
  const frozenPanel = <Flex style={Object.freeze({ left: 28, top: 260, width, height: 200, gap: 20, alignItems: "flex-start" })}>{frozenChildren}</Flex>;
  Object.freeze(frozenPanel.props); Object.freeze(frozenPanel);
  function Content() {
    if (!frozenProof.get()) return <Paragraphs />;
    return <>
      <Text pointerEvents="none" style={{ left: 28, top: 238, font: "12px sans-serif", fill: "#475569" }}>Frozen proof: Paint only reuses allocation. Width and text still invalidate it.</Text>
      {frozenPanel}
    </>;
  }
  const node = (
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
        WASM · Flex + Text
      </Text>
      <Text
        style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}
      >
        Resize the workspace. Text height follows its final width.
      </Text>
      <Button
        x={28}
        y={96}
        width={180}
        fill="#19375b"
        label="Toggle width"
        onClick={() => activeWidth().set(width.get() === 560 ? 320 : 560)}
      />
      <Button
        x={224}
        y={96}
        width={180}
        fill="#6e3e79"
        label="Paint only"
        onClick={() =>
          ink.update((c) => (c === "#19375b" ? "#a63758" : "#19375b"))
        }
      />
      <Button x={420} y={96} width={280} label="Toggle frozen proof" fill="#426b61" onClick={() => frozenProof.update(value => !value)} />
      {[
        {
          x: 28,
          label: "Change text",
          click: () =>
            paragraph.update((value) =>
              value === longText
                ? shortText
                : value === shortText
                  ? alternateText
                  : longText,
            ),
        },
        {
          x: 200,
          label: "Nudge width",
          click: () => activeWidth().update((value) => value + 1),
        },
        {
          x: 372,
          label: "Switch source",
          click: () => alternate.update((value) => !value),
        },
        {
          x: 544,
          label: "Bump inactive",
          click: () =>
            (alternate.get() ? primaryWidth : alternateWidth).update(
              (value) => value + 40,
            ),
        },
      ].map((button) => (
        <Button
          key={button.label}
          x={button.x}
          y={144}
          label={button.label}
          onClick={button.click}
        />
      ))}
      {[
        {
          x: 28,
          label: "Reverse keys",
          click: () => keys.update((value) => [...value].reverse()),
        },
        {
          x: 264,
          label: "Remove / restore B",
          click: () =>
            keys.update((value) =>
              value.includes("B")
                ? value.filter((key) => key !== "B")
                : [...value, "B"],
            ),
        },
        {
          x: 500,
          label: "Update B",
          click: () =>
            secondaryParagraph.update((value) =>
              value === secondText ? updatedSecondText : secondText,
            ),
        },
      ].map((button) => (
        <Button
          key={button.label}
          x={button.x}
          y={192}
          width={216}
          label={button.label}
          onClick={button.click}
        />
      ))}
      <Content />
    </>
  );
  return {
    node,
    readInputs: () =>
      `${frozenProof.get() ? "FROZEN PROOF (keys controls apply to ordinary mode)" : "ORDINARY MODE"} · source: ${alternate.get() ? "B" : "A"} · raw width: ${activeWidth().get()} · used width: ${width.get()} · order: ${keys.get().join(",")} · selected: ${selected.get()}`,
  };
}

export function WasmFlexTextExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const { node, readInputs } = useConst(createWasmFlexTextContent);
  useReaction(() => {
    // Build-only inspector: reads counters without creating signals or frames.
    // This global is deliberately absent from the supported @pibbl/core surface.
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
      panel.textContent = read
        ? `EXPERIMENTAL WASM · ${Object.entries(read())
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}\n${readInputs()}`
        : "Normal JS build. Start Studio with --mode layout-wasm to inspect the WASM experiment.";
    };
    untracked(refresh);
    const timer = window.setInterval(refresh, 200);
    return () => {
      window.clearInterval(timer);
      panel.remove();
    };
  }, []);
  return node;
}
