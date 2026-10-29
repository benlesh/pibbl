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


const StagedNumericMarginRow = defineLayoutComponent((props: { readonly margin: Signal<0 | "auto">; readonly hitA: () => void; readonly hitB: () => void }) =>
  <Flex style={{ width: "auto", height: 40, minWidth: 100, minHeight: 0, maxWidth: 160, flexGrow: 0, flexShrink: 0, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
    <Rectangle key="A" onClick={props.hitA} style={{ width: 80, height: 40, minWidth: 0, minHeight: 0, maxWidth: "25%", flexBasis: 80, flexGrow: 0, flexShrink: 0, marginLeft: props.margin, fill: "#b63d3d", cursor: "pointer" }} />
    <Rectangle key="B" onClick={props.hitB} style={{ width: 80, height: 40, minWidth: 0, minHeight: 0, flexBasis: 80, flexGrow: 0, flexShrink: 0, fill: "#426b61", cursor: "pointer" }} />
  </Flex>,
);

const StagedPairedMarginRow = defineLayoutComponent((props: { readonly margin: Signal<0 | "auto">; readonly natural: Signal<number>; readonly hitA: () => void; readonly hitB: () => void; readonly record: (maximum: number) => void }) =>
  <Flex style={{ width: "auto", height: 40, minWidth: 100, minHeight: 0, maxWidth: 160, flexGrow: 0, flexShrink: 0, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
    <MeasuredChip key="A" natural={props.natural} record={props.record} hit={props.hitA} style={{ width: "auto", height: 40, minWidth: 0, maxWidth: "25%", flexGrow: 0, flexShrink: 0, marginLeft: props.margin }} />
    <Rectangle key="B" onClick={props.hitB} style={{ width: 80, height: 40, flexBasis: 80, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: "#426b61", cursor: "pointer" }} />
  </Flex>,
);

const MeasuredContributionRow = defineLayoutComponent((props: { readonly natural: Signal<number>; readonly record: (maximum: number) => void; readonly hitA: () => void; readonly hitB: () => void }) =>
  <Flex style={{ width: "auto", height: 20, minWidth: 100, minHeight: 0, maxWidth: 160, flexGrow: 0, flexShrink: 0, flexDirection: "row", alignItems: "flex-start" }}>
    <MeasuredChip natural={props.natural} record={props.record} hit={props.hitA} style={{ width: "auto", height: 20, minWidth: 0, maxWidth: "25%", flexGrow: 0, flexShrink: 0 }} />
    <Rectangle onClick={props.hitB} style={{ width: 80, height: 20, flexBasis: 80, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: "#426b61" }} />
  </Flex>,
);

/** A measured natural main size participates in two native percentage stages. */
export function WasmFlexMeasuredPercentageOwnerExample() {
  const read = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  if (!read) return <Text style={{ left: 28, top: 48, font: "18px sans-serif", fill: "#19375b" }}>Start Studio with --mode layout-wasm to run the measured percentage example.</Text>;
  const canvas = useCanvasContext().canvas as HTMLCanvasElement;
  const maximum = useSignal<number | Percentage>(160);
  const owner = useSignal(200), natural = useSignal(80), nestedNatural = useSignal(40), hits = useSignal<readonly string[]>([]);
  const stagedAutoMarginProof = useSignal(false), stagedMargin = useSignal<0 | "auto">(0);
  const queries = useConst<number[]>(() => []), nestedQueries = useConst<number[]>(() => []), contributionQueries = useConst<number[]>(() => []), panel = useConst(() => document.createElement("pre"));
  useReaction(() => {
    panel.style.cssText = "font:12px monospace;white-space:pre-wrap;max-height:160px;overflow:auto;flex-shrink:0;padding:12px;background:#e7e5df;color:#19375b";
    canvas.insertAdjacentElement("afterend", panel);
    const refresh = () => { panel.textContent = JSON.stringify({ externalOwner: owner.get(), maximum: maximum.get(), natural: natural.get(), queries, nestedQueries, contributionQueries, stagedAutoMargin: { enabled: stagedAutoMarginProof.get(), margin: stagedMargin.get() }, hits: hits.get(), layout: read(), note: "The provider returns natural width; its query limit comes from the owner's declared limit. Native placement retains the distinct later line reference." }, null, 2); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, [canvas, panel]);
  const current = owner.get(), currentMaximum = maximum.get(), currentNatural = natural.get();
  if (stagedAutoMarginProof.get()) return <>
    <Rectangle style={{ width: 760, height: 540, fill: "#f3f0e8" }} />
    <Text pointerEvents="none" style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>WASM · staged owner margins</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 66, width: 680, wrap: true, font: "15px sans-serif", fill: "#475569" }}>Both rows retain their final owner and purple continuation. The automatic margin comes from the staged line reference, so numeric A begins at 30 px in a 160 px owner while paired A begins at 10 px in a 120 px owner.</Text>
    <Rectangle onClick={() => stagedAutoMarginProof.set(false)} style={{ left: 620, top: 120, width: 112, height: 36, fill: "#19375b", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 638, top: 130, font: "14px sans-serif", fill: "white" }}>Back</Text>
    <Rectangle onClick={() => stagedMargin.update(value => value === 0 ? "auto" : 0)} style={{ left: 28, top: 120, width: 180, height: 36, fill: "#426b61", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 40, top: 130, font: "14px sans-serif", fill: "white" }}>Margin: {stagedMargin.get()}</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 190, font: "bold 14px sans-serif", fill: "#19375b" }}>Numeric staged row · owner 160</Text>
    <Rectangle pointerEvents="none" style={{ left: 28, top: 216, width: 200, height: 44, stroke: "#a63758", strokeWidth: 1 }} />
    <Flex style={{ left: 28, top: 218, width: 200, height: 40, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
      <StagedNumericMarginRow key="numeric-margin" margin={stagedMargin} hitA={() => hits.update(values => [...values, "numeric-A"])} hitB={() => hits.update(values => [...values, "numeric-B"])} />
      <Rectangle key="numeric-C" onClick={() => hits.update(values => [...values, "numeric-C"])} style={{ width: 20, height: 40, flexBasis: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: "#6e3e79", cursor: "pointer" }} />
    </Flex>
    <Text pointerEvents="none" style={{ left: 28, top: 286, font: "bold 14px sans-serif", fill: "#19375b" }}>Paired measured row · owner 120</Text>
    <Rectangle pointerEvents="none" style={{ left: 28, top: 312, width: 200, height: 44, stroke: "#a63758", strokeWidth: 1 }} />
    <Flex style={{ left: 28, top: 314, width: 200, height: 40, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
      <StagedPairedMarginRow key="paired-margin" margin={stagedMargin} natural={natural} record={maximum => { contributionQueries.push(maximum); if (contributionQueries.length > 16) contributionQueries.shift(); }} hitA={() => hits.update(values => [...values, "paired-A"])} hitB={() => hits.update(values => [...values, "paired-B"])} />
      <Rectangle key="paired-C" onClick={() => hits.update(values => [...values, "paired-C"])} style={{ width: 20, height: 40, flexBasis: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: "#6e3e79", cursor: "pointer" }} />
    </Flex>
    <Text pointerEvents="none" style={{ left: 28, top: 386, width: 680, wrap: true, font: "13px sans-serif", fill: "#475569" }}>Toggle the margin and click red A, green B, or purple C. The inspector keeps the paired query limits beside the exact staged state.</Text>
  </>;
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
    <Rectangle onClick={() => stagedAutoMarginProof.set(true)} style={{ left: 620, top: 168, width: 112, height: 28, fill: "#6e3e79", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 630, top: 176, font: "12px sans-serif", fill: "white" }}>Margins</Text>
    <Rectangle pointerEvents="none" style={{ left: 28, top: 200, width: current, height: 100, fill: "#e7e5df" }} />
    <Flex style={{ left: 28, top: 200, width: current, height: 100, flexDirection: "column", alignItems: "flex-start" }}>
      <MeasuredPercentageRow key="row" maximum={currentMaximum} natural={natural} record={maximum => { queries.push(maximum); if (queries.length > 16) queries.shift(); }} hitA={() => hits.update(values => [...values, "A"])} hitB={() => hits.update(values => [...values, "B"])} style={{ width: "auto", height: 40, minWidth: 0, minHeight: 0, maxWidth: currentMaximum, flexBasis: 40, flexGrow: 0, flexShrink: 0, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }} />
    </Flex>
    <Text pointerEvents="none" style={{ left: 28, top: 330, width: 690, wrap: true, font: "16px sans-serif", fill: "#19375b" }}>At limit160/natural80: A30 / row110 for external200 or160; A20 / row100 for external80. Natural20 produces A20 / row100. At limit75%/external200: A29.375 / row109.375, queried at37.5.</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 414, width: 300, wrap: true, font: "12px sans-serif", fill: "#475569" }}>40 px available → 80 px inner owner → 160 px red leaf. The inspector records two native query limits: 40, then 80.</Text>
    <Text pointerEvents="none" style={{ left: 360, top: 414, width: 370, wrap: true, font: "12px sans-serif", fill: "#475569" }}>Main contribution: {currentNatural === 80 ? 120 : 100} px; full size query: {currentNatural === 80 ? 110 : 100} px. The leaf queries 40 then {currentNatural === 80 ? 30 : 25}. Blue follows at {currentNatural === 80 ? 120 : 100}, leaving a {currentNatural === 80 ? 10 : 0} px gap after green.</Text>
    <Flex style={{ left: 28, top: 472, width: 40, height: 20, flexDirection: "row", alignItems: "flex-start" }}>
      <MeasuredOverflowRow key="overflow" natural={nestedNatural} record={maximum => { nestedQueries.push(maximum); if (nestedQueries.length > 16) nestedQueries.shift(); }} hit={() => hits.update(values => [...values, "overflow"])} />
    </Flex>
    <Flex style={{ left: 360, top: 472, width: 200, height: 20, flexDirection: "row", alignItems: "flex-start" }}>
      <MeasuredContributionRow key="contribution" natural={natural} record={maximum => { contributionQueries.push(maximum); if (contributionQueries.length > 16) contributionQueries.shift(); }} hitA={() => hits.update(values => [...values, "contribution-A"])} hitB={() => hits.update(values => [...values, "contribution-B"])} />
      <Rectangle key="next" onClick={() => hits.update(values => [...values, "next"])} style={{ width: 20, height: 20, flexBasis: 20, minWidth: 0, minHeight: 0, flexGrow: 0, flexShrink: 0, fill: "#355f96", cursor: "pointer" }} />
    </Flex>
  </>;
}
