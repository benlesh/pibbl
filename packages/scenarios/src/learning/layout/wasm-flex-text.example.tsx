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
  definePrimitive,
  defineLayoutComponent,
  type FlexStyle,
  type SystemStyle,
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
  const minimumWord = computed(() => paragraph.get() === longText ? "MMMMMMMMMMMMMM" : "MMMM");
  const secondText =
    "Second paragraph: keyed text keeps its own subscription and measurement cache. Remove, update, then restore B.";
  const updatedSecondText =
    "Second paragraph updated: B changed while absent. Restoring attaches its input again without replacing A.";
  const secondaryParagraph = signal(secondText);
  const keys = signal<readonly ("A" | "B")[]>(["A", "B"]);
  const selected = signal("none");
  const frozenProof = signal(false);
  const minimumProof = signal(false);
  const naturalBasis = signal(false);
  const autoCrossProof = signal(false);
  const autoCrossWrap = signal(false);
  const intrinsicLogical = signal(false);
  let autoCrossTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const autoCrossWidth = signal(140);
  const autoCrossHits = signal(0);
  const autoCrossInk = signal("#426b61");
  const boxMargin = signal(5);
  const marginWrap = signal<"nowrap" | "wrap">("nowrap");
  const minimumRowWidth = computed(() => width.get() - 200);
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
  const frozenA = <Text key="frozen-A" onClick={() => selected.set("frozen A")} style={{ flexBasis: 270, minWidth: 0, flexGrow: 1, flexShrink: 1, wrap: true, font: "16px sans-serif", lineHeight: 24, fill: ink, cursor: "pointer" }}>{paragraph}</Text>;
  const frozenB = <Text key="frozen-B" onClick={() => selected.set("frozen B")} style={{ flexBasis: 270, minWidth: 0, flexGrow: 1, flexShrink: 1, wrap: true, font: "16px sans-serif", lineHeight: 24, fill: ink, cursor: "pointer" }}>{secondaryParagraph}</Text>;
  const frozenAStyle = (frozenA.props as Readonly<{ style: object }>).style;
  const frozenBStyle = (frozenB.props as Readonly<{ style: object }>).style;
  Object.freeze(frozenAStyle); Object.freeze(frozenA.props); Object.freeze(frozenA);
  Object.freeze(frozenBStyle); Object.freeze(frozenB.props); Object.freeze(frozenB);
  const frozenChildren = Object.freeze([frozenA, frozenB]);
  const frozenPanel = <Flex style={{ left: 28, top: 260, width, height: 200, gap: 20, alignItems: "flex-start" }}>{frozenChildren}</Flex>;
  const frozenPanelStyle = (frozenPanel.props as Readonly<{ style: object }>).style;
  Object.freeze(frozenPanelStyle); Object.freeze(frozenPanel.props); Object.freeze(frozenPanel);
  const columnWords = signal("jobs jobs jobs");
  const columnHits = signal(0);
  const columnProviderMode = signal<"text" | "wrappedText" | 40 | 80 | "known60" | "known100">("text");
  const columnProviderNatural = signal(40);
  const columnKnownWidth = signal(40);
  type ColumnProviderStyle = FlexStyle & { readonly fill?: string };
  type ResolvedColumnProviderStyle = SystemStyle & { readonly width: number; readonly height: number; readonly fill?: string };
  const ColumnProvider = definePrimitive<{ readonly natural: typeof columnProviderNatural }, ColumnProviderStyle, ColumnProviderStyle, ResolvedColumnProviderStyle>((_props, style) =>
    <Rectangle onClick={() => selected.set("column provider A")} style={{ width: style.width, height: style.height, fill: style.fill, cursor: "pointer" }} />,
  {
    preserveSignalProps: ["natural"],
    resolveStyle: (style, context) => ({ width: context.allocation.width, height: context.allocation.height, fill: style.fill }),
    measureIntrinsic: ({ props }) => ({ status: "measured" as const, minContent: { width: props.natural.get(), height: 20 }, maxContent: { width: props.natural.get(), height: 20 } }),
    measure: ({ props }) => ({ status: "measured" as const, size: { width: props.natural.get(), height: 20 } }),
  });
  const ColumnKnown = defineLayoutComponent(() => <Flex style={{ width: "auto", height: 20, minWidth: 0, minHeight: 0, flexBasis: "auto", flexGrow: 0, flexShrink: 0, marginLeft: "auto", flexDirection: "row", flexWrap: "nowrap", layoutDirection: "ltr", alignItems: "flex-start" }}>
    <Rectangle key="column-known-A" onClick={() => selected.set("column known A")} style={{ width: columnKnownWidth, height: 20, minWidth: 0, minHeight: 0, flexBasis: "auto", flexGrow: 0, flexShrink: 0, fill: "#8a3248", cursor: "pointer" }} />
    <Rectangle key="column-known-C" style={{ width: 20, height: 20, minWidth: 0, minHeight: 0, flexBasis: 20, flexGrow: 0, flexShrink: 0, fill: "#6e3e79" }} />
  </Flex>);
  // Stable descriptors keep the pure-measurement cache conservative on paint.
  const columnAutoPanel = <Flex style={{ left: 420, top: 280, width: 180, height: 80, flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" }}>
    <Text key="column-text" onClick={() => { columnHits.update(value => value + 1); selected.set("column auto text"); }} style={{ width: "auto", height: 20, minHeight: 0, flexGrow: 0, flexShrink: 0, marginLeft: "auto", wrap: false, font: "10px monospace", fill: "#19375b", cursor: "pointer" }}>{columnWords}</Text>
    <Rectangle key="column-sibling" onClick={() => selected.set("column auto sibling")} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: autoCrossInk, cursor: "pointer" }} />
  </Flex>;
  // The same button alternates a short natural run with a longer wrapped run.
  // The experimental column policy caps only the natural advance at the finite
  // owner width; Canvas supplies the actual glyph metrics at render time.
  const columnWrappedWords = computed(() =>
    columnWords.get() === "jobs jobs jobs" ? "jobs jobs" : "jobs jobs jobs jobs jobs jobs jobs",
  );
  const columnWrappedPanel = <Flex style={{ left: 420, top: 280, width: 180, height: 80, flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" }}>
    <Text key="column-wrapped-text" onClick={() => { columnHits.update(value => value + 1); selected.set("column wrapped text"); }} style={{ width: "auto", height: 40, minHeight: 0, flexGrow: 0, flexShrink: 0, marginLeft: "auto", wrap: true, font: "10px monospace", lineHeight: 10, fill: "#19375b", cursor: "pointer" }}>{columnWrappedWords}</Text>
    <Rectangle key="column-wrapped-sibling" onClick={() => selected.set("column wrapped sibling")} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: autoCrossInk, cursor: "pointer" }} />
  </Flex>;
  const columnProviderPanel = <Flex style={{ left: 420, top: 280, width: 180, height: 80, flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" }}>
    <ColumnProvider key="column-provider" natural={columnProviderNatural} style={{ width: "auto", height: 20, minHeight: 0, flexGrow: 0, flexShrink: 0, marginLeft: "auto", fill: "#8a3248" }} />
    <Rectangle key="column-provider-sibling" onClick={() => selected.set("column provider sibling")} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: autoCrossInk, cursor: "pointer" }} />
  </Flex>;
  const columnKnownPanel = <Flex style={{ left: 420, top: 280, width: 180, height: 80, flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" }}>
    <ColumnKnown key="column-known" />
    <Rectangle key="column-known-sibling" onClick={() => selected.set("column known sibling")} style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: autoCrossInk, cursor: "pointer" }} />
  </Flex>;
  function ColumnAutoComparison() {
    const providerMode = columnProviderMode.get();
    const provider = providerMode === 40 || providerMode === 80;
    const known = providerMode === "known60" || providerMode === "known100";
    const wrapped = providerMode === "wrappedText";
    const label = provider ? "Column · paired provider, natural width" : known ? "Column · row content, natural width" : wrapped ? "Column · wrapped Text, natural width" : "Column · natural Text width, automatic left margin";
    return <>
      <Text pointerEvents="none" style={{ left: 420, top: 258, font: "12px sans-serif", fill: "#475569" }}>{label}</Text>
      <Rectangle pointerEvents="none" style={{ left: 420, top: 278, width: 180, height: 82, stroke: "#a63758", strokeWidth: 1 }} />
      {provider ? columnProviderPanel : known ? columnKnownPanel : wrapped ? columnWrappedPanel : columnAutoPanel}
      <Button x={420} y={380} width={240} label="Change column text" onClick={() => columnWords.update(value => value === "jobs jobs jobs" ? "jobs jobs" : "jobs jobs jobs")} />
      <Button x={420} y={416} width={240} label={`Column content: ${providerMode === "text" ? "Text" : providerMode === "wrappedText" ? "wrapped Text" : providerMode === "known60" ? "row 60px" : providerMode === "known100" ? "row 100px" : `${providerMode}px`}`} onClick={() => {
        if (providerMode === "text") { columnProviderNatural.set(40); columnProviderMode.set(40); }
        else if (providerMode === 40) { columnProviderNatural.set(80); columnProviderMode.set(80); }
        else if (providerMode === 80) { columnKnownWidth.set(40); columnProviderMode.set("known60"); }
        else if (providerMode === "known60") { columnKnownWidth.set(80); columnProviderMode.set("known100"); }
        else if (providerMode === "known100") columnProviderMode.set("wrappedText");
        else columnProviderMode.set("text");
      }} />
    </>;
  }
  function IntrinsicAutoMarginComparison() {
    const logical = intrinsicLogical.get();
    return <>
      <Text pointerEvents="none" style={{ left: 28, top: 388, font: "12px sans-serif", fill: "#475569" }}>{logical ? "Shorthand + logical: A has 40px on each main edge." : "40 + 80 content; the 200px owner adds an 80px auto margin."}</Text>
      <Rectangle pointerEvents="none" style={{ left: 28, top: 404, width: 200, height: 24, stroke: "#a63758", strokeWidth: 1 }} />
      <Flex style={{ left: 28, top: 406, width: 200, height: 20, alignItems: "flex-start" }}>
        <Flex style={{ width: "auto", height: 20, minWidth: 200, flexGrow: 0, flexShrink: 0, flexWrap: "nowrap", layoutDirection: "ltr", alignItems: "flex-start" }}>
          <Rectangle style={{ width: 40, height: 20, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, margin: logical ? "auto" : undefined, marginLeft: logical ? 0 : "auto", marginStart: logical ? "auto" : undefined, fill: "#8a3248" }} />
          <Rectangle style={{ width: 80, height: 20, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: "#426b61" }} />
        </Flex>
      </Flex>
      <Rectangle pointerEvents="none" style={{ left: 280, top: 404, width: 120, height: 24, stroke: "#a63758", strokeWidth: 1 }} />
      <Flex style={{ left: 280, top: 406, width: 120, height: 20, alignItems: "flex-start" }}>
        <Flex style={{ width: "auto", height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, flexWrap: "nowrap", layoutDirection: "ltr", alignItems: "flex-start" }}>
          <Rectangle onClick={() => selected.set("intrinsic cross A")} style={{ width: 40, height: 10, minWidth: 0, minHeight: 0, flexBasis: 40, flexGrow: 0, flexShrink: 0, marginTop: "auto", fill: "#8a3248", cursor: "pointer" }} />
          <Rectangle style={{ width: 80, height: 10, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: "#426b61" }} />
        </Flex>
      </Flex>
      <Rectangle onClick={() => intrinsicLogical.update(value => !value)} style={{ left: 28, top: 434, width: 200, height: 20, fill: "#19375b", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 38, top: 437, font: "12px sans-serif", fill: "#ffffff" }}>Toggle shorthand + logical</Text>
      <Text pointerEvents="none" style={{ left: 280, top: 432, font: "12px sans-serif", fill: "#475569" }}>Top auto: A drops 10px</Text>
    </>;
  }
  function AutoCrossComparison() {
    const transform = useCanvasContext().getTransform();
    const wrapped = autoCrossWrap.get();
    const comparisonWidth = autoCrossWidth.get();
    const textWidth = comparisonWidth === 140 ? 80 : 40;
    autoCrossTransform = { a: transform.a, b: transform.b, c: transform.c, d: transform.d, e: transform.e, f: transform.f };
    return <>
      <Text pointerEvents="none" style={{ left: 28, top: 238, font: "12px sans-serif", fill: "#475569" }}>
        {wrapped ? "Wrapped rows settle Text height before the automatic top margin is placed." : "Text starts at its natural width. Narrowing adds a line and reduces the top margin."}
      </Text>
      <ColumnAutoComparison />
      <IntrinsicAutoMarginComparison />
      <Rectangle pointerEvents="none" style={{ left: 28, top: 258, width: wrapped ? 150 : comparisonWidth, height: wrapped ? 122 : 102, stroke: "#a63758", strokeWidth: 1 }} />
      <Flex style={{ left: 28, top: 260, width: wrapped ? 150 : comparisonWidth, height: wrapped ? 120 : 100, flexWrap: wrapped ? "wrap" : undefined, gap: wrapped ? 10 : undefined, alignItems: wrapped ? "flex-start" : undefined, alignContent: wrapped ? "flex-start" : undefined }}>
        <Text
          onClick={() => { autoCrossHits.update(value => value + 1); selected.set("auto cross text"); }}
          style={{ width: wrapped ? textWidth : undefined, minWidth: wrapped ? 0 : undefined, flexShrink: wrapped ? 0 : undefined, wrap: true, font: "10px monospace", lineHeight: 10, marginTop: "auto", fill: "#19375b", cursor: "pointer" }}
        >
          aaaa aaaa aaaa
        </Text>
        <Rectangle
          onClick={() => selected.set("auto cross sibling")}
          style={{ width: wrapped ? 60 : 40, height: 40, minWidth: 0, minHeight: 0, flexShrink: 0, fill: autoCrossInk, cursor: "pointer" }}
        />
        {wrapped ? <Rectangle onClick={() => selected.set("auto cross following")} style={{ width: 60, height: 30, minWidth: 0, minHeight: 0, flexShrink: 0, fill: "#6e3e79", cursor: "pointer" }} /> : null}
      </Flex>
    </>;
  }
  function MinimumComparison() {
    const basis = naturalBasis.get() ? "auto" : 200;
    return <>
      <Text pointerEvents="none" style={{ left: 28, top: 246, font: "12px sans-serif", fill: "#475569" }}>Omitted minWidth: protect the word; narrow rows may overflow their boundary.</Text>
      <Rectangle pointerEvents="none" style={{ left: 28, top: 278, width: minimumRowWidth, height: 48, stroke: "#a63758", strokeWidth: 1 }} />
      <Flex style={{ left: 28, top: 280, width: minimumRowWidth, height: 44, alignItems: "flex-start" }}>
        <Text style={{ flexBasis: basis, flexShrink: 1, wrap: true, font: "20px monospace", lineHeight: 24, fill: ink }}>{minimumWord}</Text>
        <Rectangle onClick={() => selected.set("auto minimum sibling")} style={{ width: 100, height: 40, minWidth: 0, flexShrink: 0, fill: "#426b61", cursor: "pointer" }} />
      </Flex>
      <Text pointerEvents="none" style={{ left: 480, top: 278, font: "12px sans-serif", fill: "#475569" }}>Empty boxes: 80% + 80% → 50 + 50</Text>
      <Flex style={{ left: 500, top: 300, width: 100, height: 40 }}>
        <Rectangle onClick={() => selected.set("empty left")} style={{ width: "80%", height: 40, fill: "#6e3e79", cursor: "pointer" }} />
        <Rectangle onClick={() => selected.set("empty right")} style={{ width: "80%", height: 40, fill: "#426b61", cursor: "pointer" }} />
      </Flex>
      <Text pointerEvents="none" style={{ left: 480, top: 360, font: "12px sans-serif", fill: "#475569" }}>Margins: left ±5, right toggles wrap</Text>
      <Flex style={{ left: 500, top: 390, width: 100, height: 40, flexWrap: marginWrap }}>
        <Rectangle onClick={() => { selected.set("margin left"); boxMargin.update(value => value === 5 ? -5 : 5); }} style={{ width: 80, height: 10, margin: 5, marginLeft: boxMargin, fill: "#6e3e79", cursor: "pointer" }} />
        <Rectangle onClick={() => { selected.set("margin right"); marginWrap.update(value => value === "nowrap" ? "wrap" : "nowrap"); }} style={{ width: 80, height: 10, margin: 5, fill: "#426b61", cursor: "pointer" }} />
      </Flex>
      <Text pointerEvents="none" style={{ left: 28, top: 348, font: "12px sans-serif", fill: "#475569" }}>Explicit minWidth: 0 lets the box shrink. Visible text can overflow its box.</Text>
      <Rectangle pointerEvents="none" style={{ left: 28, top: 388, width: minimumRowWidth, height: 48, stroke: "#a63758", strokeWidth: 1 }} />
      <Flex style={{ left: 28, top: 390, width: minimumRowWidth, height: 44, alignItems: "flex-start" }}>
        <Text style={{ flexBasis: basis, flexShrink: 1, minWidth: 0, wrap: true, font: "20px monospace", lineHeight: 24, fill: ink }}>{minimumWord}</Text>
        <Rectangle onClick={() => selected.set("zero minimum sibling")} style={{ width: 100, height: 40, minWidth: 0, flexShrink: 0, fill: "#426b61", cursor: "pointer" }} />
      </Flex>
    </>;
  }
  function BasisButton() {
    const autoCross = autoCrossProof.get();
    return <Button x={420} y={96} width={280}
      label={autoCross ? "Toggle wrapping" : minimumProof.get() ? "Toggle auto basis" : "Toggle frozen proof"}
      fill="#426b61" onClick={() => {
        if (autoCross) autoCrossWrap.update(value => !value);
        else if (minimumProof.get()) naturalBasis.update(value => !value);
        else frozenProof.update(value => !value);
      }} />;
  }
  function Content() {
    if (autoCrossProof.get()) return <AutoCrossComparison />;
    if (minimumProof.get()) return <MinimumComparison />;
    if (!frozenProof.get()) return <Paragraphs />;
    return <>
      <Text pointerEvents="none" style={{ left: 28, top: 238, font: "12px sans-serif", fill: "#475569" }}>Frozen proof: Paint only reuses allocation. Width and text still invalidate it.</Text>
      {frozenPanel}
    </>;
  }
  function ProofControls() {
    const autoCross = autoCrossProof.get();
    return <>
      <Button
        x={28}
        y={96}
        width={180}
        fill="#19375b"
        label={autoCross ? "Toggle comparison width" : "Toggle width"}
        onClick={() => {
          if (autoCross) autoCrossWidth.update(value => value === 140 ? 100 : 140);
          else activeWidth().set(width.get() === 560 ? 320 : 560);
        }}
      />
      <Button
        x={224}
        y={96}
        width={180}
        fill="#6e3e79"
        label="Paint only"
        onClick={() => {
          if (autoCross) autoCrossInk.update(value => value === "#426b61" ? "#a63758" : "#426b61");
          else ink.update(value => value === "#19375b" ? "#a63758" : "#19375b");
        }}
      />
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
        Resize: Text height follows its final width.
      </Text>
      <Button x={420} y={24} width={280} label="Compare Text minimum" onClick={() => minimumProof.update(value => !value)} />
      <Button x={420} y={60} width={280} label="Compare auto margins" onClick={() => autoCrossProof.update(value => !value)} />
      <ProofControls />
      <BasisButton />
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
      `${autoCrossProof.get() ? "AUTO CROSS COMPARISON" : minimumProof.get() ? "TEXT MINIMUM COMPARISON" : frozenProof.get() ? "FROZEN PROOF (keys controls apply to ordinary mode)" : "ORDINARY MODE"} · comparison width: ${autoCrossWidth.get()} · wrapped: ${autoCrossWrap.get()} · auto cross hits: ${autoCrossHits.get()} · basis: ${naturalBasis.get() ? "auto" : "200px"} · source: ${alternate.get() ? "B" : "A"} · raw width: ${activeWidth().get()} · used width: ${width.get()} · order: ${keys.get().join(",")} · margin wrap: ${marginWrap.get()} · margin left: ${boxMargin.get()} · selected: ${selected.get()} · column words: ${columnWords.get()} · column hits: ${columnHits.get()} · column provider: ${columnProviderMode.get()} · intrinsic logical: ${intrinsicLogical.get()} · intrinsic auto contribution: 120 · final owner: 200 · auto cross transform: ${JSON.stringify(autoCrossTransform)}`,
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
