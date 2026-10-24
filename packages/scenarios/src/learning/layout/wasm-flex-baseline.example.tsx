import {
  Flex, Group, Rectangle, Text, FocusManagement, definePrimitive, signal, computed,
  useCanvasContext, useLayoutBox, useConst, useReaction, untracked,
  type Signal, type SystemStyle, type LayoutBox, type PibblNode, type BaselineMeasureInput, type BaselinesResult,
} from "@pibbl/core";

type Name = "A" | "B" | "C" | "MA" | "MB" | "WA" | "WB" | "WC" | "WD";
interface CardProps { id: Name; label: string; font: string; first: number | Signal<number> }
interface CardStyle extends SystemStyle {
  width?: number; height?: number; fill?: string;
  flexBasis?: number; flexGrow?: number; flexShrink?: number;
  minWidth?: number; minHeight?: number; marginLeft?: number | "auto"; marginTop?: number | "auto"; marginBottom?: number | "auto";
}
type ResolvedCardStyle = CardStyle & { width: number; height: number };

function createBaselineContent() {
  const second = signal(30), owner = signal(180), paint = signal("#426b61"), mainAuto = signal(false), layoutDirection = signal<"ltr" | "rtl">("ltr");
  const mainMargin = computed(() => mainAuto.get() ? "auto" as const : 0);
  const mainLabel = computed(() => mainAuto.get() ? "Auto" : "Start");
  const directionLabel = computed(() => layoutDirection.get().toUpperCase());
  const reverse = signal(false), flexDirection = computed(() => reverse.get() ? "row-reverse" as const : "row" as const);
  const reverseLabel = computed(() => reverse.get() ? "Reverse" : "Row");
  const crossMode = signal<"off" | "top" | "bottom" | "both">("off");
  const crossTop = computed(() => crossMode.get() === "top" || crossMode.get() === "both" ? "auto" as const : 0);
  const crossBottom = computed(() => crossMode.get() === "bottom" || crossMode.get() === "both" ? "auto" as const : 0);
  const crossLabel = computed(() => crossMode.get() === "off" ? "Cross" : crossMode.get());
  const textFont = signal("10px monospace");
  const wrappedD = signal(20), wrappedDLabel = computed(() => `D ${wrappedD.get()}`);
  const textWrap = signal(false), textReflow = signal(false);
  const textWords = computed(() => textWrap.get() ? textReflow.get() ? "Ag Ag Ag" : "Ag Ag Ag Ag" : "Ag");
  const textWidth = computed(() => textWrap.get() ? textReflow.get() ? 28 : 40 : 70);
  const textLineHeight = computed(() => textWrap.get() ? textReflow.get() ? 14 : 10 : 13);
  const textPanelHeight = computed(() => textWrap.get() ? textReflow.get() ? 48 : 36 : 36);
  const textWrapLabel = computed(() => textWrap.get() ? textReflow.get() ? "Wrapped Text: three lines — click to restore" : "Wrapped Text: two lines — click to restore" : "Automatic Text first baseline — click to wrap");
  const textReflowLabel = computed(() => textWrap.get() && !textReflow.get() ? "Reflow → three lines" : "Reflow after wrap");
  const textHits: string[] = [];
  const secondLabel = computed(() => String(second.get()));
  const guide = computed(() => 210 + Math.max(0,12,second.get(),24));
  const boxes = new Map<Name, LayoutBox>(), stamps = new Map<Name, number>();
  const allocations = new Map<Name, LayoutBox>(), calls = { A: 0, B: 0 };
  const hits: Name[] = [], focused: Name[] = [];
  let serial = 0, basis = new DOMMatrix();
  const CanvasBasis = definePrimitive<{ children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  function renderCard(props: CardProps, style: Readonly<ResolvedCardStyle>) {
    const box = useLayoutBox(), matrix = useCanvasContext().getTransform();
    const first = typeof props.first === "number" ? props.first : props.first.get();
    const point = basis.inverse().transformPoint({ x: matrix.e, y: matrix.f });
    const stamp = useConst(() => ++serial);
    boxes.set(props.id, { x: point.x, y: point.y, width: box.width, height: box.height });
    stamps.set(props.id, stamp);
    return <>
      <Rectangle keyboardFocusable onFocus={() => focused.push(props.id)} onClick={() => hits.push(props.id)} style={{ width: box.width, height: box.height, fill: style.fill, cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 4, top: first, textBaseline: "alphabetic", font: props.font, fill: "#ffffff" }}>{props.label}</Text>
    </>;
  }
  const resolveStyle = (style: Readonly<CardStyle>, context: { allocation: Readonly<LayoutBox> }): ResolvedCardStyle => ({ ...style, marginLeft: undefined, marginTop: undefined, marginBottom: undefined, width: context.allocation.width, height: context.allocation.height });
  const BaselineCard = definePrimitive<CardProps, CardStyle, CardStyle, ResolvedCardStyle>(renderCard, {
    resolveStyle,
    measureBaselines(input: BaselineMeasureInput<CardProps, CardStyle>): BaselinesResult {
      if (input.props.id === "A" || input.props.id === "B") calls[input.props.id]++;
      allocations.set(input.props.id, { ...input.allocation });
      const first = typeof input.props.first === "number" ? input.props.first : input.props.first.get();
      return { status: "measured", first, last: first };
    },
  });
  const BottomCard = definePrimitive<CardProps, CardStyle, CardStyle, ResolvedCardStyle>(renderCard, { resolveStyle });
  function renderContent() {
    return <>
      <Rectangle style={{ width: 760, height: 540, fill: "#f3f0e8" }} />
      <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>WASM · first baseline</Text>
      <Text style={{ left: 28, top: 62, font: "14px sans-serif", fill: "#475569" }}>Pure providers report baseline offsets from the final allocation.</Text>
      <Rectangle onClick={() => second.update(value => value === 30 ? 34 : 30)} style={{ left: 28, top: 96, width: 200, height: 36, fill: "#19375b", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 40, top: 106, font: "14px sans-serif", fill: "#ffffff" }}>Move B baseline</Text>
      <Rectangle onClick={() => owner.update(value => value === 180 ? 240 : 180)} style={{ left: 244, top: 96, width: 200, height: 36, fill: "#426b61", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 256, top: 106, font: "14px sans-serif", fill: "#ffffff" }}>Resize owner</Text>
      <Rectangle onClick={() => paint.update(value => value === "#426b61" ? "#6e3e79" : "#426b61")} style={{ left: 460, top: 96, width: 200, height: 36, fill: "#6e3e79", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 472, top: 106, font: "14px sans-serif", fill: "#ffffff" }}>Paint indicator</Text>
      <Rectangle pointerEvents="none" style={{ left: 460, top: 144, width: 200, height: 8, fill: paint }} />
      <Rectangle onClick={() => textFont.update(value => value === "10px monospace" ? "16px monospace" : "10px monospace")} style={{ left: 676, top: 96, width: 56, height: 36, fill: "#a63758", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 684, top: 106, font: "12px sans-serif", fill: "#ffffff" }}>Text</Text>
      <Rectangle onClick={() => mainAuto.update(value => !value)} style={{ left: 676, top: 144, width: 56, height: 36, fill: "#426b61", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 682, top: 154, font: "11px sans-serif", fill: "#ffffff" }}>{mainLabel}</Text>
      <Rectangle onClick={() => crossMode.update(value => value === "off" ? "top" : value === "top" ? "bottom" : value === "bottom" ? "both" : "off")} style={{ left: 676, top: 190, width: 56, height: 28, fill: "#426b61", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 679, top: 198, font: "10px sans-serif", fill: "#ffffff" }}>{crossLabel}</Text>
      <Rectangle onClick={() => layoutDirection.update(value => value === "ltr" ? "rtl" : "ltr")} style={{ left: 676, top: 226, width: 56, height: 28, fill: "#19375b", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 682, top: 234, font: "10px sans-serif", fill: "#ffffff" }}>{directionLabel}</Text>
      <Rectangle onClick={() => reverse.update(value => !value)} style={{ left: 676, top: 262, width: 56, height: 28, fill: "#19375b", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 679, top: 270, font: "10px sans-serif", fill: "#ffffff" }}>{reverseLabel}</Text>
      <Rectangle onClick={() => wrappedD.update(value => value === 20 ? 26 : 20)} style={{ left: 676, top: 300, width: 56, height: 36, fill: "#a63758", cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 682, top: 310, font: "10px sans-serif", fill: "#ffffff" }}>{wrappedDLabel}</Text>
      <Text pointerEvents="none" style={{ left: 28, top: 160, font: "14px sans-serif", fill: "#475569" }}>A/B supply offsets. C has no provider and uses its bottom edge.</Text>
      <FocusManagement><Flex style={{ left: 28, top: 210, width: owner, height: 80, flexDirection: "row", flexWrap: "nowrap", alignItems: "first-baseline" }}>
        <BaselineCard key="A" id="A" label="12" font="12px monospace" first={12} style={{ width: 40, height: 20, flexBasis: 40, flexGrow: 1, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#426b61" }} />
        <BaselineCard key="B" id="B" label={secondLabel} font="20px sans-serif" first={second} style={{ width: 40, height: 40, flexBasis: 40, flexGrow: 1, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#19375b" }} />
        <BottomCard key="C" id="C" label="24" font="14px serif" first={24} style={{ width: 40, height: 24, flexBasis: 40, flexGrow: 1, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#a63758" }} />
      </Flex></FocusManagement>
      <Rectangle pointerEvents="none" style={{ left: 28, top: guide, width: owner, height: 1, fill: "#d16642", opacity: .6 }} />
      <Text pointerEvents="none" style={{ left: 460, top: 185, font: "12px sans-serif", fill: "#475569" }}>Cross auto takes over alignment.</Text>
      <Flex style={{ left: 460, top: 210, width: 160, height: 80, flexDirection, flexWrap: "nowrap", layoutDirection, alignItems: "first-baseline" }}>
        <BaselineCard key="MA" id="MA" label="12" font="12px monospace" first={12} style={{ width: 40, height: 20, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, marginLeft: mainMargin, marginTop: crossTop, marginBottom: crossBottom, fill: "#426b61" }} />
        <BaselineCard key="MB" id="MB" label="30" font="20px sans-serif" first={30} style={{ width: 40, height: 40, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#19375b" }} />
      </Flex>
      <Text pointerEvents="none" style={{ left: 28, top: 330, font: "14px sans-serif", fill: "#475569" }}>Click the cards at their new positions. Tab follows A → B → C.</Text>
      <Text pointerEvents="none" style={{ left: 460, top: 440, font: "12px sans-serif", fill: "#475569" }}>Wrapped rows share baselines line by line.</Text>
      <Flex style={{ left: 460, top: 460, width: 100, height: 80, flexDirection, layoutDirection, flexWrap: "wrap", alignItems: "first-baseline", alignContent: "flex-start" }}>
        <BaselineCard key="WA" id="WA" label="12" font="12px monospace" first={12} style={{ width: 60, height: 20, flexBasis: 60, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#8a3248" }} />
        <BaselineCard key="WB" id="WB" label="30" font="20px sans-serif" first={30} style={{ width: 40, height: 40, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#19375b" }} />
        <BaselineCard key="WC" id="WC" label="8" font="12px monospace" first={8} style={{ width: 60, height: 20, flexBasis: 60, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#8a3248" }} />
        <BaselineCard key="WD" id="WD" label={wrappedDLabel} font="14px sans-serif" first={wrappedD} style={{ width: 40, height: 30, flexBasis: 40, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, fill: "#426b61" }} />
      </Flex>
      <Text pointerEvents="none" style={{ left: 28, top: 360, font: "14px sans-serif", fill: "#475569" }}>The Text panel uses live Canvas metrics; it makes no native font-metric claim.</Text>
      <Text onClick={() => { textFont.set("10px monospace"); textReflow.set(false); textWrap.update(value => !value); }} style={{ left: 28, top: 386, font: "13px sans-serif", fill: "#475569", cursor: "pointer" }}>{textWrapLabel}</Text>
      <Text onClick={() => { if (textWrap.get()) textReflow.set(true); }} style={{ left: 340, top: 386, font: "13px sans-serif", fill: "#475569", cursor: "pointer" }}>{textReflowLabel}</Text>
      <Group onClick={(event) => { if (event.target !== event.currentTarget) textHits.push("text"); }}>
        <Flex style={{ left: 28, top: 404, width: 180, height: textPanelHeight, flexDirection: "row", flexWrap: "nowrap", alignItems: "first-baseline" }}>
          <Text key="text-small" style={{ width: 100, height: textPanelHeight, flexBasis: textWidth, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, cursor: "pointer", font: textFont, lineHeight: textLineHeight, textBaseline: "top", wrap: textWrap, fit: "visible", overflow: "visible", fill: "#426b61" }}>{textWords}</Text>
          <Text key="text-large" style={{ width: 90, height: 32, flexBasis: 90, flexGrow: 0, flexShrink: 0, minWidth: 0, minHeight: 0, cursor: "pointer", font: "20px sans-serif", textBaseline: "top", wrap: false, fit: "visible", overflow: "visible", fill: "#a63758" }}>Ag</Text>
        </Flex>
      </Group>
    </>;
  }
  const children = renderContent();
  return {
    node: <CanvasBasis>{children}</CanvasBasis>,
    read: () => JSON.stringify({ owner: owner.get(), first: second.get(), textFont: textFont.get(), textWrap: textWrap.get(), textReflow: textReflow.get(), mainAuto: mainAuto.get(), crossMode: crossMode.get(), reverse: reverse.get(), layoutDirection: layoutDirection.get(), wrappedD: wrappedD.get(), textHits, calls, allocations: Object.fromEntries(allocations), boxes: Object.fromEntries(boxes), stamps: Object.fromEntries(stamps), hits, focused, basis }),
  };
}
export function WasmFlexBaselineExample() {
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const diagnostics = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => unknown }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  if (!diagnostics) return <Text style={{ left: 28, top: 24, font: "18px sans-serif", fill: "#19375b" }}>This example needs the experimental layout build.</Text>;
  const content = useConst(createBaselineContent);
  useReaction(() => {
    const panel = document.createElement("pre"); panel.style.cssText = "font:12px monospace;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0;max-width:100%;box-sizing:border-box;padding:12px;background:#e7e5df;color:#19375b";
    canvas.insertAdjacentElement("afterend", panel);
    const refresh = () => { panel.textContent = untracked(content.read); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.node;
}
