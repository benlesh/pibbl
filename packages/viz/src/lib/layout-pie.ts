import type { PieSliceGeometry } from "./pie-slices.js";
import type {
  PieLayoutSlice,
  PieLabelLayout,
  PieLabelPlacement,
} from "./pie-types.js";
import type { HoverBounds } from "./hover-placement.js";
interface Metrics {
  width: number;
  height: number;
  left: number;
  ascent: number;
}
/** Checks the closest point of a complete label box, not just its corners. */
export function boxOutsideInnerCircle(
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  innerRadius: number,
): boolean {
  return (
    Math.hypot(
      Math.max(x - cx, 0, cx - (x + width)),
      Math.max(y - cy, 0, cy - (y + height)),
    ) >= innerRadius
  );
}
export function layoutPie<D>(
  slices: readonly PieSliceGeometry<D>[],
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  bounds: HoverBounds,
  font: string,
  gap: number,
  placement: PieLabelPlacement,
  label: ((slice: PieSliceGeometry<D>) => string) | undefined,
  measure: (text: string) => Metrics,
): readonly PieLayoutSlice<D>[] {
  const labels: (PieLabelLayout | undefined)[] = slices.map(() => undefined);
  const lanes: {
    index: number;
    text: string;
    metrics: Metrics;
    anchor: [number, number];
    y: number;
  }[][] = [[], []];
  function placed(
    text: string,
    m: Metrics,
    x: number,
    y: number,
    location: "inside" | "outside",
    leader?: readonly (readonly [number, number])[],
  ): PieLabelLayout {
    return Object.freeze({
      status: "placed",
      placement: location,
      text,
      font,
      x,
      y,
      width: m.width,
      height: m.height,
      textX: x + m.left,
      textY: y + m.ascent,
      leader,
    });
  }
  const inBounds = (x: number, y: number, w: number, h: number) =>
    x >= bounds.x &&
    y >= bounds.y &&
    x + w <= bounds.x + bounds.width &&
    y + h <= bounds.y + bounds.height;
  slices.forEach((slice, index) => {
    if (!label) return;
    const text = label(slice);
    if (typeof text !== "string" || /[\r\n]/u.test(text))
      throw new TypeError("PieLayout: label must return a single-line string.");
    const hide = (reason: "empty" | "inside-fit" | "space") => {
      labels[index] = Object.freeze({ status: "hidden", reason, text });
    };
    if (!text || !radius || slice.endAngle <= slice.startAngle) {
      hide("empty");
      return;
    }
    const m = measure(text);
    const mid = (slice.startAngle + slice.endAngle) / 2;
    const labelRadius = innerRadius + (radius - innerRadius) * 0.65;
    const x = cx + Math.cos(mid) * labelRadius - m.width / 2;
    const y = cy + Math.sin(mid) * labelRadius - m.height / 2;
    const corners = [
      [x, y],
      [x + m.width, y],
      [x, y + m.height],
      [x + m.width, y + m.height],
    ];
    // A disk intersected with the midpoint half-plane is convex. Restrict wide
    // sectors to it so corner containment also proves containment of the box.
    const fits =
      inBounds(x, y, m.width, m.height) &&
      corners.every(([px, py]) => {
        const dx = px - cx,
          dy = py - cy;
        const relative =
          ((Math.atan2(dy, dx) - mid + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        return (
          Math.hypot(dx, dy) <= radius &&
          Math.abs(relative) <=
            Math.min(Math.PI / 2, (slice.endAngle - slice.startAngle) / 2)
        );
      }) &&
      boxOutsideInnerCircle(x, y, m.width, m.height, cx, cy, innerRadius);
    if (placement !== "outside" && fits) {
      labels[index] = placed(text, m, x, y, "inside");
      return;
    }
    if (placement === "inside") {
      hide("inside-fit");
      return;
    }
    const anchor: [number, number] = [
      cx + Math.cos(mid) * radius,
      cy + Math.sin(mid) * radius,
    ];
    lanes[Math.cos(mid) < 0 ? 0 : 1].push({
      index,
      text,
      metrics: m,
      anchor,
      y: 0,
    });
  });
  lanes.forEach((lane, side) => {
    lane.sort((a, b) => a.anchor[1] - b.anchor[1] || a.index - b.index);
    let used = 0;
    const accepted = lane.filter((row) => {
      const x =
        side === 0 ? cx - radius - gap - row.metrics.width : cx + radius + gap;
      const next = used + (used ? gap : 0) + row.metrics.height;
      if (
        next > bounds.height ||
        !inBounds(x, bounds.y, row.metrics.width, row.metrics.height)
      ) {
        labels[row.index] = Object.freeze({
          status: "hidden",
          reason: "space",
          text: row.text,
        });
        return false;
      }
      used = next;
      return true;
    });
    const direction = side === 0 ? -1 : 1;
    const rail = cx + direction * (radius + gap / 2);
    // Pack each half away from the equator. The tangent constraint keeps every
    // straight fan-out outside the disk; ordering keeps neighboring fans apart.
    // There is one sort and two linear sweeps, with no relaxation loop.
    const upper = accepted.filter((row) => row.anchor[1] < cy).reverse();
    const lower = accepted.filter((row) => row.anchor[1] >= cy);
    const visible = new Set<(typeof accepted)[number]>();
    for (const [rows, sign] of [
      [upper, -1],
      [lower, 1],
    ] as const) {
      let cursor = cy + (sign * gap) / 2;
      for (const row of rows) {
        const dx = row.anchor[0] - cx;
        const dy = row.anchor[1] - cy;
        const half = row.metrics.height / 2;
        const ideal = cy + (dy * (radius + gap)) / radius;
        const tangent =
          dy === 0 ? cy : cy + (radius * radius - dx * (rail - cx)) / dy;
        const center =
          sign < 0
            ? Math.min(ideal, tangent, cursor - half)
            : Math.max(ideal, tangent, cursor + half);
        row.y = center - half;
        if (
          row.y < bounds.y ||
          row.y + row.metrics.height > bounds.y + bounds.height
        ) {
          labels[row.index] = Object.freeze({
            status: "hidden",
            reason: "space",
            text: row.text,
          });
          continue;
        }
        visible.add(row);
        cursor = center + sign * (half + gap);
      }
    }
    for (const row of accepted) {
      if (!visible.has(row)) continue;
      const x =
        side === 0 ? cx - radius - gap - row.metrics.width : cx + radius + gap;
      const edge = side === 0 ? x + row.metrics.width : x;
      const center = row.y + row.metrics.height / 2;
      const leader = Object.freeze([
        Object.freeze(row.anchor),
        Object.freeze([rail, center] as const),
        Object.freeze([edge, center] as const),
      ]);
      labels[row.index] = placed(
        row.text,
        row.metrics,
        x,
        row.y,
        "outside",
        leader,
      );
    }
  });
  return Object.freeze(
    slices.map((slice, index) =>
      Object.freeze({
        ...slice,
        cx,
        cy,
        radius,
        innerRadius,
        label: labels[index],
      }),
    ),
  );
}
