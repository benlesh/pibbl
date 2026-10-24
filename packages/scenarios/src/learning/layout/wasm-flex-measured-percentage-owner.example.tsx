import { defineLayoutComponent, definePrimitive, Flex, Rectangle, Text, useCanvasContext, useConst, useLayoutBox, useReaction, useSignal, type FlexStyle, type Percentage, type Signal, type SystemStyle } from "@pibbl/core";

const MeasuredChip = definePrimitive<{ natural: Signal<number>; hit: () => void; record: (maximum: number) => void }, FlexStyle, FlexStyle, SystemStyle & { width: number; height: number }>(
  props => {
    const box = useLayoutBox();
    return <Rectangle onClick={props.hit} style={{ width: box.width, height: box.height, fill: "#b63d3d", cursor: "pointer" }} />;
  },
  {
    resolveStyle: (_style, context) => ({ width: context.allocation.width, height: context.allocation.height }),
    preserveSignalProps: ["natural"],
    measureIntrinsic: ({ props }) => ({ status: "measured", minContent: { width: 0, height: 40 }, maxContent: { width: props.natural.get(), height: 40 } }),
    measure: ({ props, constraints }) => {
      props.record(constraints.maxWidth);
      return { status: "measured", size: { width: props.natural.get(), height: 40 } };
    },
  },
);

const MeasuredPercentageRow = defineLayoutComponent((props: { readonly natural: Signal<number>; readonly hitA: () => void; readonly hitB: () => void; readonly record: (maximum: number) => void; readonly maximum: number | Percentage; readonly style: FlexStyle }) =>
  <Flex style={{ width: "auto", height: 40, minWidth: 0, minHeight: 0, maxWidth: props.maximum, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
    <MeasuredChip key="A" natural={props.natural} record={props.record} hit={props.hitA} style={{ width: "auto", height: 40, minWidth: 0, maxWidth: "25%", flexGrow: 0, flexShrink: 0 }} />
    <Rectangle key="B" onClick={props.hitB} style={{ width: 80, height: 40, flexBasis: 80, minWidth: 0, flexGrow: 0, flexShrink: 0, fill: "#426b61", cursor: "pointer" }} />
  </Flex>,
);

const MeasuredOverflowRow = defineLayoutComponent((props: { readonly natural: Signal<number>; readonly record: (maximum: number) => void; readonly hit: () => void }) =>
  <Flex style={{ width: "auto", height: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, flexDirection: "row", alignItems: "flex-start" }}>
    <MeasuredChip natural={props.natural} record={props.record} hit={props.hit} style={{ width: "auto", height: 20, minWidth: "200%", flexGrow: 0, flexShrink: 0 }} />
  </Flex>,
);

/** A measured natural main size participates in two native percentage stages. */
export function WasmFlexMeasuredPercentageOwnerExample() {
  const read = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  if (!read) return <Text style={{ left: 28, top: 48, font: "18px sans-serif", fill: "#19375b" }}>Start Studio with --mode layout-wasm to run the measured percentage example.</Text>;
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const maximum = useSignal<number | Percentage>(160);
  const owner = useSignal(200), natural = useSignal(80), nestedNatural = useSignal(40), hits = useSignal<readonly string[]>([]);
  const queries = useConst<number[]>(() => []), nestedQueries = useConst<number[]>(() => []), panel = useConst(() => document.createElement("pre"));
  useReaction(() => {
    panel.style.cssText = "font:12px monospace;white-space:pre-wrap;max-height:160px;overflow:auto;flex-shrink:0;padding:12px;background:#e7e5df;color:#19375b";
    canvas.insertAdjacentElement("afterend", panel);
    const refresh = () => { panel.textContent = JSON.stringify({ externalOwner: owner.get(), maximum: maximum.get(), natural: natural.get(), queries, nestedQueries, hits: hits.get(), layout: read(), note: "The provider returns natural width; its query limit comes from the owner's declared limit. Native placement retains the distinct later line reference." }, null, 2); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, [canvas, panel]);
  const current = owner.get(), currentMaximum = maximum.get();
  return <>
    <Rectangle style={{ width: 760, height: 540, fill: "#f3f0e8" }} />
    <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>WASM · measured leaves and percentage stages</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 66, width: 690, wrap: true, font: "15px sans-serif", fill: "#475569" }}>Red A reports a natural width. Its auto-width row owns the limit; A caps at 25% and green B stays 80 px. The limit button switches the owner from 160 px to 75% of available space.</Text>
    <Rectangle onClick={() => owner.update(value => value === 200 ? 160 : value === 160 ? 80 : 200)} style={{ left: 28, top: 120, width: 220, height: 36, fill: "#19375b", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 40, top: 130, font: "14px sans-serif", fill: "white" }}>External owner: {current} px</Text>
    <Rectangle onClick={() => natural.update(value => value === 80 ? 20 : 80)} style={{ left: 264, top: 120, width: 180, height: 36, fill: "#426b61", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 276, top: 130, font: "14px sans-serif", fill: "white" }}>Natural width: {natural.get()}</Text>
    <Rectangle onClick={() => hits.set([])} style={{ left: 460, top: 120, width: 144, height: 36, fill: "#6e3e79", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 472, top: 130, font: "14px sans-serif", fill: "white" }}>Clear hits</Text>
    <Rectangle onClick={() => maximum.update(value => value === 160 ? "75%" : 160)} style={{ left: 620, top: 120, width: 112, height: 36, fill: "#19375b", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 630, top: 131, font: "12px sans-serif", fill: "white" }}>Limit: {typeof currentMaximum === "number" ? `${currentMaximum} px` : currentMaximum}</Text>
    <Rectangle pointerEvents="none" style={{ left: 28, top: 200, width: current, height: 100, fill: "#e7e5df" }} />
    <Flex style={{ left: 28, top: 200, width: current, height: 100, flexDirection: "column", alignItems: "flex-start" }}>
      <MeasuredPercentageRow key="row" maximum={currentMaximum} natural={natural} record={maximum => { queries.push(maximum); if (queries.length > 16) queries.shift(); }} hitA={() => hits.update(values => [...values, "A"])} hitB={() => hits.update(values => [...values, "B"])} style={{ width: "auto", height: 40, minWidth: 0, minHeight: 0, maxWidth: currentMaximum, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }} />
    </Flex>
    <Text pointerEvents="none" style={{ left: 28, top: 330, width: 690, wrap: true, font: "16px sans-serif", fill: "#19375b" }}>At limit160/natural80: A30 / row110 for external200 or160; A20 / row100 for external80. Natural20 produces A20 / row100. At limit75%/external200: A29.375 / row109.375, queried at37.5.</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 420, width: 690, wrap: true, font: "14px sans-serif", fill: "#475569" }}>Below: 40 px available → 80 px inner owner → 160 px red leaf. The 200% minimum uses two finite native passes; the inspector records query limits 40, then 80.</Text>
    <Flex style={{ left: 28, top: 472, width: 40, height: 20, flexDirection: "row", alignItems: "flex-start" }}>
      <MeasuredOverflowRow key="overflow" natural={nestedNatural} record={maximum => { nestedQueries.push(maximum); if (nestedQueries.length > 16) nestedQueries.shift(); }} hit={() => hits.update(values => [...values, "overflow"])} />
    </Flex>
  </>;
}
