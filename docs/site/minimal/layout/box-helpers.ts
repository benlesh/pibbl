import {
  LayoutDiagnostic,
  layoutDiagnostic,
  normalizeEdges,
  resolveBox,
  resolveLength,
  type BoxStyle,
  type Constraints,
  type EdgeValues,
  type Edges,
  type LayoutBox,
  type LayoutDiagnosticContext,
  type LayoutDiagnosticInput,
  type Length,
  type Percentage,
  type ResolvedBoxStyle,
  type Size,
} from "@pibbl/core";

const percentage: Percentage = "50%";
const width: Length = percentage;
const edgeInput: EdgeValues = { top: 8, right: 12, bottom: 8, left: 12 };
const edges: Edges = normalizeEdges(edgeInput, "padding");
const constraints: Constraints = {
  minWidth: 0,
  maxWidth: 320,
  minHeight: 0,
  maxHeight: 220,
};
const style: BoxStyle = { width, height: 80, padding: edgeInput };
const context: LayoutDiagnosticContext = { component: "Badge", constraints };
const box: ResolvedBoxStyle = resolveBox(style, constraints, context);
const outer: LayoutBox = box.borderBox;
const inner: Size = box.contentBox;
const half = resolveLength(width, constraints.maxWidth, "width", context);
const input: LayoutDiagnosticInput = {
  ...context,
  property: "width",
  value: width,
  reason: "requires a definite containing width",
};
const diagnostic: LayoutDiagnostic = layoutDiagnostic(input);
const output = document.createElement("pre");
output.textContent = JSON.stringify(
  { edges, outer, inner, half, diagnostic: diagnostic.message },
  null,
  2,
);
document.body.append(output);
