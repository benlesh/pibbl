import { Flex, Rectangle, Text, useCanvasContext, useConst, useReaction, useSignal } from "@pibbl/core";

/** Numeric children expose staged percentage caps without a final-size feedback loop. */
export function WasmFlexPercentageOwnerExample() {
  const read = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  if (!read) return <Text style={{ left: 28, top: 48, font: "18px sans-serif", fill: "#19375b" }}>Start Studio with --mode layout-wasm to run the experimental percentage example.</Text>;
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const owner = useSignal(200);
  const hits = useSignal<readonly string[]>([]);
  const panel = useConst(() => document.createElement("pre"));
  useReaction(() => {
    panel.style.cssText = "font:12px monospace;white-space:pre-wrap;max-height:160px;overflow:auto;flex-shrink:0;padding:12px;background:#e7e5df;color:#19375b";
    canvas.insertAdjacentElement("afterend", panel);
    const refresh = () => { panel.textContent = JSON.stringify({ externalOwner: owner.get(), hits: hits.get(), layout: read(), note: "Red A has an 80 px basis and maxWidth 25%. The nested row has maxWidth 160. Percentage caps use staged references, rather than 25% of the final row." }, null, 2); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, [canvas, panel]);
  const current = owner.get();
  return <>
    <Rectangle style={{ width: 760, height: 540, fill: "#f3f0e8" }} />
    <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>WASM · percentage bounds through sizing stages</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 66, width: 690, wrap: true, font: "15px sans-serif", fill: "#475569" }}>The outer column supplies availability. The nested row chooses its width, up to 160 px. Red A has maxWidth 25%; green B stays 80 px. Click around their shared edge after resizing.</Text>
    <Rectangle onClick={() => owner.update(value => value === 200 ? 160 : value === 160 ? 80 : 200)} style={{ left: 28, top: 120, width: 220, height: 36, fill: "#19375b", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 40, top: 130, font: "14px sans-serif", fill: "white" }}>External owner: {current} px</Text>
    <Rectangle onClick={() => hits.set([])} style={{ left: 264, top: 120, width: 180, height: 36, fill: "#426b61", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 276, top: 130, font: "14px sans-serif", fill: "white" }}>Clear hits</Text>
    <Rectangle pointerEvents="none" style={{ left: 28, top: 200, width: current, height: 100, fill: "#e7e5df" }} />
    <Flex style={{ left: 28, top: 200, width: current, height: 100, flexDirection: "column", alignItems: "flex-start" }}>
      <Flex key="row" style={{ width: "auto", height: 40, minWidth: 0, minHeight: 0, maxWidth: 160, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
        <Rectangle key="A" onClick={() => hits.update(values => [...values, "A"])} style={{ width: 80, height: 40, flexBasis: 80, minWidth: 0, maxWidth: "25%", flexGrow: 0, flexShrink: 0, fill: "#b63d3d", cursor: "pointer" }} />
        <Rectangle key="B" onClick={() => hits.update(values => [...values, "B"])} style={{ width: 80, height: 40, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0, fill: "#426b61", cursor: "pointer" }} />
      </Flex>
    </Flex>
    <Text pointerEvents="none" style={{ left: 28, top: 330, width: 690, wrap: true, font: "16px sans-serif", fill: "#19375b" }}>Expected at external 200: A 32.5 px, row 112.5 px. At 160: A 30 px, row 110 px. At 80: A 20 px, row 100 px, overflowing the outer owner.</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 420, width: 690, wrap: true, font: "14px sans-serif", fill: "#475569" }}>This bounded numeric example preserves source paint order and hit geometry. It does not define general intrinsic Text, custom measured leaves, wrapping or CSS sizing compatibility.</Text>
  </>;
}
