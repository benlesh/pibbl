import {
  Text,
  measureElement,
  type CanvasMeasurementService,
  type Constraints,
  type MeasureInput,
  type MeasureResult,
  type TextStyle,
} from "@pibbl/core";

const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas 2D is required for measurement.");
const service: CanvasMeasurementService = {
  measureText(text, font) {
    context.font = font;
    return context.measureText(text);
  },
};
const constraints: Constraints = {
  minWidth: 0,
  maxWidth: 300,
  minHeight: 0,
  maxHeight: 100,
};
const textStyle: TextStyle = { font: "18px sans-serif", fill: "#111827" };
const result: MeasureResult = measureElement(
  <Text style={textStyle}>Measured label</Text>,
  constraints,
  service,
);
function describeMeasurement(
  input: Pick<
    MeasureInput<{ text: string }, TextStyle>,
    "props" | "constraints"
  >,
) {
  return `${input.props.text} fits within ${input.constraints.maxWidth}px`;
}
const output = document.createElement("pre");
output.textContent =
  result.status === "measured"
    ? `${describeMeasurement({ props: { text: "Measured label" }, constraints })}: ${result.size.width.toFixed(1)} x ${result.size.height.toFixed(1)}`
    : result.reason;
document.body.append(output);
