import {
  Flex,
  Group,
  Rectangle,
  Text,
  signal,
  useCanvasContext,
  useConst,
  useLayoutBox,
  useReaction,
  type BoxStyle,
  type FlexItemStyle,
  type PibblNode,
  type PibblResponsiveStyle,
} from "@pibbl/core";

type CardStyle = PibblResponsiveStyle<BoxStyle & FlexItemStyle>;

function createWasmFlexPercentPlacementExampleContent(canvas: HTMLCanvasElement) {
  const width = signal(500);
  const relative = signal(true);
  const badgeAnchor = signal<"physical" | "start-ltr" | "start-rtl">("physical");
  const selected = signal("none");
  let rootTransform = new DOMMatrix();
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();

  function capture(name: string) {
    const box = useLayoutBox();
    const transform = rootTransform.inverse().multiply(useCanvasContext().getTransform());
    boxes.set(name, { x: transform.e, y: transform.f, width: box.width, height: box.height });
    return box;
  }
  function RelativeCardContents() {
    const box = capture("relative");
    return <><Rectangle style={{ width: box.width, height: box.height, fill: selected.get() === "relative" ? "#e1dbca" : "#d6e3db", cursor: "pointer" }} onClick={() => selected.set("relative")} /><Text pointerEvents="none" style={{ left: 10, top: 12, width: 100, font: "13px sans-serif", fill: "#19375b", wrap: true }}>Queue: 6 pending</Text></>;
  }
  function Pin({ style: _style }: { style: CardStyle }) {
    const box = capture("pin");
    return <Rectangle pointerEvents="none" style={{ width: box.width, height: box.height, fill: "#d8aa3c" }} />;
  }
  function Badge({ style: _style }: { style: CardStyle }) {
    const box = capture("badge");
    return <><Rectangle style={{ width: box.width, height: box.height, fill: "#a63758", cursor: "pointer" }} onClick={() => selected.set("badge")} /><Text pointerEvents="none" style={{ left: 10, top: 8, font: "bold 12px sans-serif", fill: "#fff" }}>3 live</Text></>;
  }
  function Button({ x, label, onClick }: { x: number; label: string; onClick(): void }) {
    return <><Rectangle style={{ left: x, top: 100, width: 180, height: 36, fill: "#19375b", cursor: "pointer" }} onClick={onClick}/><Text pointerEvents="none" style={{ left: x + 12, top: 110, font: "14px sans-serif", fill: "#fff" }}>{label}</Text></>;
  }

  function render(transform: DOMMatrix): PibblNode {
    rootTransform = transform;
    const textWidth = width.get() === 500 ? 160 : 136;
    return <>
    <Rectangle style={{ width: 760, height: 460, fill: "#f3f0e8" }} />
    <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>WASM · Percent placement and direction</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 62, width: 680, wrap: true, font: "14px sans-serif", fill: "#475569" }}>Responsive cards wrap at 500 → 360 px. The green direct Flex can be a relative containing owner or a static child that passes its pin to the outer padding box; the red badge uses percentage size and bounds.</Text>
    <Button x={28} label="Resize cards" onClick={() => width.update(value => value === 500 ? 360 : 500)} />
    <Button x={224} label="Toggle relative offset" onClick={() => relative.update(value => !value)} />
    <Button x={420} label={`Badge: ${badgeAnchor.get() === "physical" ? "physical" : badgeAnchor.get() === "start-ltr" ? "start LTR" : "start RTL"}`} onClick={() => badgeAnchor.update(value => value === "physical" ? "start-ltr" : value === "start-ltr" ? "start-rtl" : "physical")} />
    <Rectangle pointerEvents="none" style={{ left: 28, top: 164, width, height: 232, fill: "#ede9dd", cornerRadius: 8 }} />
    <Flex style={{ left: 28, top: 164, width, height: 232, boxSizing: "border-box", padding: 16, flexWrap: "wrap", gap: 12, alignItems: "flex-start", alignContent: "flex-start", layoutDirection: badgeAnchor.get() === "start-rtl" ? "rtl" : "ltr" }}>
      <Text key="intro" pointerEvents="none" style={{ width: textWidth, height: "auto", minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, wrap: true, lineHeight: 17, font: "13px sans-serif", fill: "#19375b" }}>Report queue · 6 jobs. Natural Text wraps at the allocated card width.</Text>
      <Flex key="relative" style={{ width: 120, height: 68, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, flexBasis: "auto", flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start", position: relative.get() ? "relative" : "static", left: "10%", right: "15%", top: "20%", bottom: "10%" }}>
        <Group style={{ width: 120, height: 68, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }}><RelativeCardContents /></Group>
        <Pin key="pin" style={{ position: "absolute", width: 24, height: 14, right: 8, bottom: 8, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0 }} />
      </Flex>
      <Text key="summary" pointerEvents="none" style={{ width: textWidth, height: "auto", minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, wrap: true, lineHeight: 17, font: "13px sans-serif", fill: "#19375b" }}>Latency · 24 ms p95. Resize to move this natural-height card onto the next line.</Text>
      <Badge key="badge" style={{ position: "absolute", width: "25%", minWidth: 100, maxWidth: 140, height: "15%", minHeight: 30, maxHeight: 40, right: "10%", top: "75%", insetStart: badgeAnchor.get() === "physical" ? undefined : "20%" }} />
    </Flex>
    <Text pointerEvents="none" style={{ left: 44, top: 414, font: "bold 13px sans-serif", fill: "#19375b" }}>Toggle the green Flex containing owner</Text>
    <Text pointerEvents="none" style={{ left: 44, top: 432, width: 680, wrap: true, lineHeight: 14, font: "13px sans-serif", fill: "#475569" }}>Relative: pin stays inside green. Static: pin uses the outer box. Red badge: percentage size, bounds, and a logical start anchor that flips with direction.</Text>
  </>;
  }
  const panel = document.createElement("pre");
  panel.style.cssText = "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;max-height:112px;overflow:auto;width:100%;min-width:0;overflow-wrap:anywhere;background:#e7e5df";
  canvas.insertAdjacentElement("afterend", panel);
  const refresh = () => panel.textContent = JSON.stringify({ lane: (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: unknown }).__PIBBL_LAYOUT_DIAGNOSTICS__ ? "experimental WASM" : "normal JavaScript", width: width.get(), relative: relative.get(), badgeAnchor: badgeAnchor.get(), selected: selected.get(), boxes: Object.fromEntries(boxes), units: "relative percentages: content width / content height; static direct Flex pin inherits the outer padding box; absolute badge: padding-box width / height" });
  refresh();
  const timer = window.setInterval(refresh, 100);
  return { render, dispose() { window.clearInterval(timer); panel.remove(); } };
}

export function WasmFlexPercentPlacementExample() {
  const context = useCanvasContext();
  const canvas = context.canvas as HTMLCanvasElement;
  const resource = useConst(() => createWasmFlexPercentPlacementExampleContent(canvas));
  useReaction(() => resource.dispose, []);
  return resource.render(context.getTransform());
}
