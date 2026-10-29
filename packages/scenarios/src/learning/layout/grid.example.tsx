import {
  Grid, Rectangle, Text, FocusManagement, useConst, useReaction, useCanvasContext, useLayoutBox,
  signal, untracked, definePrimitive, type PibblNode, type PibblResponsiveStyle, type BoxStyle, type GridItemStyle,
} from "@pibbl/core";

function createGridStudyContent() {
  let basis = new DOMMatrix();
  const CanvasBasis = definePrimitive<{ children: PibblNode }>((props, _style, context) => { basis = context.getTransform(); return props.children; });
  const width = signal(560), ink = signal("#ff6b57");
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  const stamps = new Map<string, number>(), hits: string[] = [], focused: string[] = [];
  let serial = 0, selected = "none";
  function Cell({ id, fill, style: _style }: {
    id: string; fill: string | typeof ink;
    style: PibblResponsiveStyle<BoxStyle & GridItemStyle>;
  }) {
    const box = useLayoutBox(), context = useCanvasContext();
    const stamp = useConst(() => ++serial);
    const point = basis.inverse().transformPoint(context.getTransform().transformPoint({ x: 0, y: 0 }));
    boxes.set(id, { x: point.x, y: point.y, width: box.width, height: box.height });
    stamps.set(id, stamp);
    return <>
      <Rectangle keyboardFocusable onFocus={() => focused.push(id)} onClick={() => { selected = id; hits.push(id); }} style={{ width: box.width, height: box.height, fill, cursor: "pointer" }} />
      <Text pointerEvents="none" style={{ left: 10, top: 10, font: "bold 14px sans-serif", fill: id === "C" ? "#ffffff" : "#17211d" }}>{id}</Text>
    </>;
  }
  const node = <CanvasBasis>
    <Rectangle style={{ width: 720, height: 420, fill: "#f7f0df" }} />
    <Rectangle onClick={() => width.update(value => value === 560 ? 700 : 560)} style={{ left: 28, top: 24, width: 160, height: 36, fill: "#17211d", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 40, top: 34, font: "14px sans-serif", fill: "#ffffff" }}>Resize grid</Text>
    <Rectangle onClick={() => ink.update(value => value === "#ff6b57" ? "#74d3ae" : "#ff6b57")} style={{ left: 204, top: 24, width: 160, height: 36, fill: "#426b61", cursor: "pointer" }} />
    <Text pointerEvents="none" style={{ left: 216, top: 34, font: "14px sans-serif", fill: "#ffffff" }}>Paint only</Text>
    <FocusManagement><Grid style={{ width, height: 320, boxSizing: "border-box", padding: 80, gridTemplateColumns: [150, "25%", "1fr"], gridTemplateRows: [100, "1fr"], gap: 14 }}>
      <Cell key="A" id="A" fill="#f7c948" style={{ width: "auto", height: "auto", gridColumnStart: 1, gridRowStart: 1 }} />
      <Cell key="B" id="B" fill={ink} style={{ width: "auto", height: "auto", gridColumnStart: 2, gridColumnSpan: 2, gridRowStart: 1, gridRowSpan: 2 }} />
      <Cell key="C" id="C" fill="#1f4bd8" style={{ width: "auto", height: "auto", gridColumnStart: 1, gridColumnSpan: 2, gridRowStart: 2 }} />
      <Cell key="D" id="D" fill="#74d3ae" style={{ width: "auto", height: "auto", gridColumnStart: 3, gridRowStart: 2 }} />
    </Grid></FocusManagement>
    <Text pointerEvents="none" style={{ left: 28, top: 344, font: "bold 16px sans-serif", fill: "#17211d" }}>150 px · 25% · remaining 1fr</Text>
    <Text pointerEvents="none" style={{ left: 28, top: 374, font: "14px sans-serif", fill: "#17211d" }}>B spans two rows and columns. Later C/D paint and receive clicks above B.</Text>
  </CanvasBasis>;
  return { node, read: () => `grid width: ${width.get()}\ngrid state: ${JSON.stringify({ width: width.get(), basis: { a: basis.a, b: basis.b, c: basis.c, d: basis.d, e: basis.e, f: basis.f }, focused, boxes: Object.fromEntries(boxes), stamps: Object.fromEntries(stamps), selected, hits })}` };
}

export function GridStudy() {
  const context = useCanvasContext(), canvas = context.canvas as HTMLCanvasElement;
  const content = useConst(createGridStudyContent);
  useReaction(() => {
    const panel = document.createElement("pre");
    panel.style.cssText = "font:12px monospace;white-space:pre-wrap;color:#19375b;padding:12px;background:#e7e5df";
    canvas.insertAdjacentElement("afterend", panel);
    const refresh = () => { panel.textContent = untracked(content.read); };
    refresh(); const timer = window.setInterval(refresh, 100);
    return () => { window.clearInterval(timer); panel.remove(); };
  }, []);
  return content.node;
}
