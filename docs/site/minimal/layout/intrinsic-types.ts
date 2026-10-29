import {
  fitContent,
  type BaselineMeasureInput,
  type BaselinesResult,
  type FitContent,
  type FlexMargin,
  type IntrinsicAxisConstraints,
  type IntrinsicConstraints,
  type IntrinsicMeasureInput,
  type IntrinsicSizesResult,
  type SizingKeyword,
  type SizingLength,
  type SystemStyle,
} from "@pibbl/core";

const width: IntrinsicAxisConstraints = { kind: "bounded", min: 0, max: 240 };
const constraints: IntrinsicConstraints = {
  width,
  height: { kind: "unbounded", min: 0 },
};
const bound: FitContent = fitContent(120);
const keyword: SizingKeyword = "max-content";
const length: SizingLength = bound;
const margin: FlexMargin = "auto";
const intrinsic: IntrinsicSizesResult = {
  status: "measured",
  minContent: { width: 40, height: 18 },
  maxContent: { width: 120, height: 18 },
};
const baselines: BaselinesResult = { status: "measured", first: 14, last: 14 };
type TextIntrinsicInput = IntrinsicMeasureInput<{ text: string }, SystemStyle>;
type TextBaselineInput = BaselineMeasureInput<{ text: string }, SystemStyle>;
const summary: [
  IntrinsicConstraints,
  SizingKeyword,
  SizingLength,
  FlexMargin,
  IntrinsicSizesResult,
  BaselinesResult,
] = [constraints, keyword, length, margin, intrinsic, baselines];
void (summary as unknown as TextIntrinsicInput | TextBaselineInput);
