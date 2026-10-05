import { crc } from "@crc/core";
import {
  PieLabel,
  PieLayout,
  PieSlice,
  pieSlices,
  type PieLabelLayout,
  type PieLabelPlacement,
  type PieLabelProps,
  type PieLabelStyle,
  type PieLayoutProps,
  type PieLayoutSlice,
  type PieLayoutStyle,
  type PieOptions,
  type PieSliceGeometry,
  type PieSliceProps,
  type PieSliceStyle,
} from "@crc/core/viz";

type Datum = { name: string; value: number; color: string };
const data: readonly Datum[] = [
  { name: "Design", value: 35, color: "#0f766e" },
  { name: "Build", value: 45, color: "#f97316" },
  { name: "Review", value: 20, color: "#7c3aed" },
];
const options: PieOptions<Datum> = { value: "value", keyBy: "name" };
const first: PieSliceGeometry<Datum> = pieSlices(data, options)[0];
const placement: PieLabelPlacement = "auto";
const layoutStyle: PieLayoutStyle = {
  cx: 160,
  cy: 110,
  radius: 75,
  innerRadius: 28,
  labelFont: "12px sans-serif",
};
const sliceStyle: PieSliceStyle = { fill: first.datum.color, stroke: "#fff" };
const labelStyle: PieLabelStyle = { fill: "#111827", leaderStroke: "#64748b" };
const layout: PieLayoutProps<Datum> = {
  data,
  ...options,
  placement,
  style: layoutStyle,
  label: (slice) => `${slice.datum.name} ${Math.round(slice.fraction * 100)}%`,
  children: (slice: PieLayoutSlice<Datum>) => {
    const label: PieLabelLayout | undefined = slice.label;
    const paint: PieSliceProps<Datum> = {
      slice,
      style: { ...sliceStyle, fill: slice.datum.color },
    };
    const text: PieLabelProps<Datum> = {
      slice,
      style: {
        ...labelStyle,
        fill:
          label?.status === "placed" && label.placement === "inside"
            ? "#fff"
            : "#111827",
      },
    };
    return (
      <PieSlice {...paint}>
        <PieLabel {...text} />
      </PieSlice>
    );
  },
};
const canvas = document.createElement("canvas");
canvas.width = 320;
canvas.height = 220;
document.body.append(canvas);
const app = crc(canvas, <PieLayout {...layout} />);
window.addEventListener("pagehide", () => app.dispose(), { once: true });
