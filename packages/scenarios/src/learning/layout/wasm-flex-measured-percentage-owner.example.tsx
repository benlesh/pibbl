import { definePrimitive, Flex, Rectangle, Text, useCanvasContext, useConst, useLayoutBox, useReaction, useSignal, type FlexStyle, type SystemStyle } from "@pibbl/core";

const MeasuredChip = definePrimitive<{ natural: number; hit: () => void; record: (maximum: number) => void }, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>(
  props => {
    const box = useLayoutBox();
    return <Rectangle onClick={props.hit} style={{ width: box.width, height: box.height, fill: "#b63d3d", cursor: "pointer" }} />;
  },
  {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    measureIntrinsic: ({ props }) => ({ status: "measured", minContent: { width: 0, height: 40 }, maxContent: { width: props.natural, height: 40 } }),
    measure: ({ props, constraints }) => {
      props.record(constraints.maxWidth);
      return { status: "measured", size: { width: props.natural, height: 40 } };
    },
  },
);

/** A measured natural main size participates in two native percentage stages. */
export function WasmFlexMeasuredPercentageOwnerExample() {
  const read = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  if (!read) return <Text style={{ left: 28, top: 48, font: "18px sans-serif", fill: "#19375b" }}>Start Studio with --mode layout-wasm to run the measured percentage example.</Text>;
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const owner = useSignal(200), natural = useSignal(80), hits = useSignal<readonly string[]>([]);
  const queries = useConst<number[]>(() => []), panel = useConst(() => document.createElement("pre"));
  useReaction(() => {
    panel.style.cssText = "font:12px monospace;white-space:pre-wrap;max-height:160px;overflow:auto;flex-shrink:0;padding:12px;background:#e7e5df;color:#19375b";
    canvas.insertAdjacentElement("afterend", panel);
    const refresh = () => { panel.textContent = JSON.stringify({ externalOwner: owner.get(), natural: natural.get(), queries, hits: hits.get(), layout: read(), note: "The provider returns natural width; native sizing constrains it after querying at maximum40. The final cap then uses the line reference." }, null, 2); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, [canvas, panel]);
  const current = owner.get();
  return <>
    <Rectangle style={{ width: 760, height: 540, fill: "#f3f0e8" }} />
    <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>WASM · measured leaves and percentage stages</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 66, width: 690, wrap: true, font: "15px sans-serif", fill: "#475569" }}>Red A reports a natural width. The nested auto-width row has maxWidth 160; A has maxWidth 25%, and green B stays 80 px. Measurement runs before final native placement.</Text>
    <Rectangle onClick={() => owner.update(value => value === 200 ? 160 : value === 160 ? 80 : 200)} style={{ left: 28, top: 120, width: 220, height: 36, fill: "#19375b", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 40, top: 130, font: "14px sans-serif", fill: "white" }}>External owner: {current} px</Text>
    <Rectangle onClick={() => natural.update(value => value === 80 ? 20 : 80)} style={{ left: 264, top: 120, width: 180, height: 36, fill: "#426b61", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 276, top: 130, font: "14px sans-serif", fill: "white" }}>Natural width: {natural.get()}</Text>
    <Rectangle onClick={() => hits.set([])} style={{ left: 460, top: 120, width: 180, height: 36, fill: "#6e3e79", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 472, top: 130, font: "14px sans-serif", fill: "white" }}>Clear hits</Text>
    <Rectangle pointerEvents="none" style={{ left: 28, top: 200, width: current, height: 100, fill: "#e7e5df" }} />
    <Flex style={{ left: 28, top: 200, width: current, height: 100, flexDirection: "column", alignItems: "flex-start" }}>
      <Flex key="row" style={{ width: "auto", height: 40, minWidth: 0, minHeight: 0, maxWidth: 160, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
        <MeasuredChip key="A" natural={natural} record={maximum => { queries.push(maximum); if (queries.length > 16) queries.shift(); }} hit={() => hits.update(values => [...values, "A"])} style={{ width: "auto", height: 40, minWidth: 0, maxWidth: "25%", flexGrow: 0, flexShrink: 0 }} />
        <Rectangle key="B" onClick={() => hits.update(values => [...values, "B"])} style={{ width: 80, height: 40, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0, fill: "#426b61", cursor: "pointer" }} />
      </Flex>
    </Flex>
    <Text pointerEvents="none" style={{ left: 28, top: 330, width: 690, wrap: true, font: "16px sans-serif", fill: "#19375b" }}>Expected at natural80: A30 / row110 for external200 or160; A20 / row100 for external80. Natural20 produces A20 / row100. Every finite query has maximum40 before the later cap.</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 420, width: 690, wrap: true, font: "14px sans-serif", fill: "#475569" }}>The inspector records actual callback maxima, target history and resource counters. Toggle the natural input and click the shared edge to check measurement dependencies.</Text>
  </>;
}
