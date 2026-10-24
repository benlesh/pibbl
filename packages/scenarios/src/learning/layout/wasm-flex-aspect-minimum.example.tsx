import {
  Flex,
  Rectangle,
  Text,
  useCanvasContext,
  useConst,
  useReaction,
  useSignal,
} from "@pibbl/core";

type Minimum = undefined | 0 | 240;

function minimumLabel(value: Minimum): string {
  return value === undefined ? "omitted" : String(value);
}

/**
 * Compare Yoga's zero-content aspect-ratio shrink behavior with an explicit
 * numeric floor. The two direct Rectangles deliberately have no children.
 */
export function WasmFlexAspectMinimumExample() {
  const read = (globalThis as typeof globalThis & { __PIBBL_LAYOUT_DIAGNOSTICS__?: () => Record<string, number> }).__PIBBL_LAYOUT_DIAGNOSTICS__;
  if (!read) return <Text style={{ left: 28, top: 48, font: "18px sans-serif", fill: "#19375b" }}>Start Studio with --mode layout-wasm to run the experimental aspect example.</Text>;
  const context = useCanvasContext();
  const canvas = context.canvas as HTMLCanvasElement;
  const owner = useSignal(240);
  const minimum = useSignal<Minimum>(undefined);
  const hits = useSignal<readonly string[]>([]);
  const panel = useConst(() => document.createElement("pre"));

  useReaction(() => {
    panel.style.cssText = "font:12px monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:160px;overflow:auto;flex-shrink:0;min-width:0;max-width:100%;box-sizing:border-box;padding:12px;background:#e7e5df;color:#19375b";
    canvas.insertAdjacentElement("afterend", panel);
    const refresh = () => {
      const main = owner.get() - 60;
      const floor = minimum.get();
      const resolved = floor === undefined || floor === 0 ? main : Math.max(main, floor);
      panel.textContent = JSON.stringify({
        owner: owner.get(),
        min: minimumLabel(floor),
        hits: hits.get(),
        layout: read(),
        expected: {
          rowA: { width: resolved, height: resolved / 1.5 },
          columnA: { width: resolved * 1.5, height: resolved },
          siblingMain: 60,
        },
        note: "Direct empty Rectangle: omitted minimum and explicit 0 both preserve the zero-content shrink path. A numeric 240 floor wins before the aspect cross size is derived.",
      }, null, 2);
    };
    refresh();
    const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, [canvas, panel]);

  const currentOwner = owner.get();
  const currentMinimum = minimum.get();
  const recordHit = (name: string) => hits.update(values => [...values, name]);
  const cycleMinimum = () => minimum.update(value => value === undefined ? 0 : value === 0 ? 240 : undefined);


  return <>
    <Rectangle style={{ width: 760, height: 540, fill: "#f3f0e8" }} />
    <Text style={{ left: 28, top: 24, font: "bold 24px sans-serif", fill: "#19375b" }}>WASM · aspect ratio and zero content minimum</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 60, width: 690, wrap: true, font: "14px sans-serif", fill: "#475569" }}>These direct empty Rectangles have a 270 px basis and shrink beside a fixed 60 px sibling. Yoga has no CSS automatic minimum: omitted and zero minimum both shrink first, then derive the aspect-ratio cross size.</Text>
    <Rectangle onClick={() => owner.update(value => value === 240 ? 300 : 240)} style={{ left: 28, top: 96, width: 180, height: 36, fill: "#19375b", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 40, top: 106, font: "14px sans-serif", fill: "#ffffff" }}>Owner: {currentOwner}</Text>
    <Rectangle onClick={cycleMinimum} style={{ left: 224, top: 96, width: 180, height: 36, fill: "#426b61", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 236, top: 106, font: "14px sans-serif", fill: "#ffffff" }}>Minimum: {minimumLabel(currentMinimum)}</Text>
    <Rectangle onClick={() => hits.set([])} style={{ left: 420, top: 96, width: 180, height: 36, fill: "#6e3e79", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 432, top: 106, font: "14px sans-serif", fill: "#ffffff" }}>Clear hits</Text>

    <Text pointerEvents="none" style={{ left: 28, top: 146, font: "bold 14px sans-serif", fill: "#19375b" }}>Row: main width → cross height</Text>
    <Rectangle pointerEvents="none" style={{ left: 28, top: 170, width: currentOwner, height: 160, fill: "#e7e5df" }} />
    <Flex style={{ left: 28, top: 170, width: currentOwner, height: 160, flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start" }}>
      <Rectangle key="row-aspect" onClick={() => recordHit("row A")} style={{
    width: "auto" as const,
    height: "auto" as const,
    flexBasis: 270,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: currentMinimum,
    minHeight: 0,
    aspectRatio: 1.5,
    fill: "#19375b",
    cursor: "pointer",
  }} />
      <Rectangle key="row-sibling" onClick={() => recordHit("row B")} style={{
    width: 60,
    height: 40,
    flexBasis: 60,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    minHeight: 0,
    fill: "#426b61",
    cursor: "pointer",
  }} />
    </Flex>

    <Text pointerEvents="none" style={{ left: 384, top: 146, font: "bold 14px sans-serif", fill: "#19375b" }}>Column: main height → cross width</Text>
    <Rectangle pointerEvents="none" style={{ left: 384, top: 170, width: 360, height: currentOwner, fill: "#e7e5df" }} />
    <Flex style={{ left: 384, top: 170, width: 360, height: currentOwner, flexDirection: "column", flexWrap: "nowrap", alignItems: "flex-start" }}>
      <Rectangle key="column-aspect" onClick={() => recordHit("column A")} style={{
    width: "auto" as const,
    height: "auto" as const,
    flexBasis: 270,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    minHeight: currentMinimum,
    aspectRatio: 1.5,
    fill: "#19375b",
    cursor: "pointer",
  }} />
      <Rectangle key="column-sibling" onClick={() => recordHit("column B")} style={{
    width: 60,
    height: 40,
    flexBasis: 60,
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 0,
    minHeight: 0,
    fill: "#426b61",
    cursor: "pointer",
  }} />
    </Flex>

    <Text pointerEvents="none" style={{ left: 28, top: 510, width: 700, wrap: true, font: "13px sans-serif", fill: "#475569" }}>Cycle the minimum: omitted → 0 → 240. At owner 240, 240 is an explicit floor; owner 300 reaches that same size through ordinary shrink. Click blue A or green B and inspect the JSON below.</Text>
  </>;
}
