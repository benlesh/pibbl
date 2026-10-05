import {
  Absolute,
  Circle,
  Group,
  Line,
  Rectangle,
  Path,
  Text,
  batch,
  pibbl,
  useLayoutBox,
  useSignal,
  type PibblController,
  type PibblPointerEvent,
  type PibblEventTarget,
  type WritableSignal,
} from "@pibbl/core";
import { Axis, LineSeries, ScaleAdjust, useLinearScale, LinearScale } from "@pibbl/core/viz";

type Window = readonly [number, number];
type PanelSnapshot = { width: number; height: number; domain: Window };
type Reading = {
  date: string;
  value: number;
  adjusted: number;
  interpolated: boolean;
};
interface Fixture {
  window?: WritableSignal<Window>;
  selected?: WritableSignal<number>;
  onSnapshot?: (panel: number, value: PanelSnapshot) => void;
  onReading?: (reading: Reading, samples: number) => void;
}
// NOAA Global Monitoring Laboratory: monthly Mauna Loa CO2, ppm.
// Source: https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv
// Credit: Xin Lan, NOAA/GML, and Ralph Keeling, Scripps Institution of Oceanography.
// Snapshot retrieved 2026-09-28; source file created 2026-09-05.
// Jan 1980–Dec 2021; ordered [monthly mean, deseasonalized] pairs, unrounded.
// NOAA marks Apr 1984 as interpolated. Values are retained as published.
// No network requests or generated observations are used at runtime.
const observations: readonly (readonly [number, number])[] = [
  [337.9, 338.13],
  [338.34, 337.85],
  [340.07, 338.51],
  [340.93, 338.31],
  [341.45, 338.4],
  [341.36, 338.85],
  [339.45, 338.56],
  [337.67, 339.07],
  [336.25, 339.38],
  [336.14, 339.4],
  [337.3, 339.46],
  [338.29, 339.26],
  [339.29, 339.42],
  [340.55, 339.98],
  [341.63, 340.08],
  [342.6, 339.98],
  [343.04, 339.97],
  [342.54, 340.06],
  [340.82, 339.92],
  [338.48, 339.87],
  [336.95, 340.17],
  [337.05, 340.39],
  [338.58, 340.75],
  [339.91, 340.85],
  [340.93, 341.09],
  [341.76, 341.16],
  [342.78, 341.18],
  [343.96, 341.32],
  [344.77, 341.67],
  [343.88, 341.43],
  [342.42, 341.61],
  [340.24, 341.64],
  [338.37, 341.56],
  [338.41, 341.77],
  [339.44, 341.59],
  [340.78, 341.71],
  [341.57, 341.75],
  [342.78, 342.25],
  [343.37, 341.85],
  [345.4, 342.76],
  [346.14, 342.97],
  [345.76, 343.3],
  [344.32, 343.56],
  [342.51, 343.89],
  [340.46, 343.59],
  [340.53, 343.86],
  [341.79, 343.92],
  [343.2, 344.12],
  [344.21, 344.32],
  [344.92, 344.39],
  [345.68, 344.26],
  [347.37, 344.75],
  [347.77, 344.59],
  [347.16, 344.73],
  [345.79, 345.02],
  [343.74, 345.12],
  [341.59, 344.76],
  [341.86, 345.19],
  [343.31, 345.41],
  [345.0, 345.88],
  [345.48, 345.59],
  [346.41, 345.92],
  [347.91, 346.56],
  [348.66, 346.08],
  [349.28, 346.12],
  [348.65, 346.23],
  [346.9, 346.08],
  [345.26, 346.57],
  [343.47, 346.59],
  [343.35, 346.6],
  [344.73, 346.82],
  [346.12, 347.04],
  [346.78, 346.82],
  [347.48, 346.98],
  [348.25, 346.93],
  [349.86, 347.29],
  [350.52, 347.42],
  [349.98, 347.61],
  [348.25, 347.43],
  [346.17, 347.51],
  [345.48, 348.61],
  [344.82, 348.04],
  [346.22, 348.28],
  [347.48, 348.36],
  [348.73, 348.66],
  [348.92, 348.24],
  [349.81, 348.39],
  [351.4, 348.84],
  [352.15, 349.09],
  [351.58, 349.29],
  [350.21, 349.51],
  [348.2, 349.65],
  [346.66, 349.85],
  [346.72, 349.96],
  [348.08, 350.15],
  [349.28, 350.14],
  [350.51, 350.49],
  [351.7, 350.99],
  [352.5, 350.99],
  [353.67, 351.03],
  [354.35, 351.22],
  [353.88, 351.55],
  [352.8, 352.16],
  [350.49, 352.01],
  [348.97, 352.18],
  [349.37, 352.62],
  [350.42, 352.53],
  [351.62, 352.52],
  [353.07, 352.99],
  [353.43, 352.69],
  [354.08, 352.6],
  [355.72, 353.07],
  [355.95, 352.78],
  [355.44, 353.06],
  [354.05, 353.38],
  [351.84, 353.43],
  [350.09, 353.37],
  [350.33, 353.57],
  [351.55, 353.68],
  [352.91, 353.84],
  [353.86, 353.78],
  [355.1, 354.37],
  [355.75, 354.27],
  [356.38, 353.76],
  [357.38, 354.23],
  [356.39, 354.02],
  [354.89, 354.24],
  [353.06, 354.68],
  [351.38, 354.69],
  [351.69, 354.94],
  [353.14, 355.18],
  [354.41, 355.26],
  [354.93, 354.91],
  [355.82, 355.11],
  [357.33, 355.79],
  [358.77, 356.13],
  [359.23, 356.1],
  [358.23, 355.88],
  [356.3, 355.69],
  [353.97, 355.59],
  [352.34, 355.66],
  [352.43, 355.69],
  [353.89, 355.87],
  [355.21, 356.02],
  [356.34, 356.29],
  [357.21, 356.47],
  [357.97, 356.38],
  [359.22, 356.51],
  [359.71, 356.52],
  [359.44, 357.07],
  [357.15, 356.58],
  [354.99, 356.67],
  [353.01, 356.36],
  [353.4, 356.72],
  [354.42, 356.48],
  [355.68, 356.5],
  [357.1, 357.06],
  [357.42, 356.54],
  [358.59, 356.88],
  [359.39, 356.71],
  [360.3, 357.14],
  [359.64, 357.24],
  [357.45, 356.87],
  [355.76, 357.44],
  [354.14, 357.51],
  [354.23, 357.61],
  [355.53, 357.65],
  [357.03, 357.92],
  [358.36, 358.25],
  [359.04, 358.21],
  [360.11, 358.41],
  [361.36, 358.59],
  [361.78, 358.59],
  [360.94, 358.57],
  [359.51, 358.91],
  [357.59, 359.29],
  [355.86, 359.31],
  [356.21, 359.63],
  [357.65, 359.8],
  [359.1, 359.96],
  [360.04, 359.91],
  [361.0, 360.18],
  [361.98, 360.37],
  [363.44, 360.76],
  [363.83, 360.73],
  [363.33, 360.98],
  [361.78, 361.11],
  [359.33, 360.93],
  [358.32, 361.7],
  [358.14, 361.52],
  [359.61, 361.75],
  [360.82, 361.67],
  [362.2, 361.98],
  [363.36, 362.47],
  [364.28, 362.64],
  [364.69, 361.99],
  [365.25, 362.23],
  [365.06, 362.82],
  [363.69, 362.98],
  [361.55, 363.13],
  [359.69, 363.14],
  [359.72, 363.12],
  [361.04, 363.18],
  [362.39, 363.23],
  [363.24, 363.03],
  [364.21, 363.4],
  [364.65, 363.02],
  [366.49, 363.82],
  [366.77, 363.87],
  [365.73, 363.56],
  [364.46, 363.74],
  [362.4, 363.98],
  [360.44, 363.83],
  [360.97, 364.28],
  [362.65, 364.71],
  [364.51, 365.28],
  [365.39, 365.19],
  [366.1, 365.29],
  [367.36, 365.73],
  [368.79, 366.17],
  [369.56, 366.68],
  [369.13, 366.95],
  [367.98, 367.29],
  [366.1, 367.69],
  [364.16, 367.51],
  [364.54, 367.82],
  [365.67, 367.7],
  [367.3, 368.05],
  [368.35, 368.13],
  [369.28, 368.46],
  [369.84, 368.24],
  [371.15, 368.62],
  [371.12, 368.31],
  [370.46, 368.29],
  [369.61, 368.93],
  [367.06, 368.63],
  [364.95, 368.28],
  [365.52, 368.8],
  [366.88, 368.86],
  [368.26, 368.93],
  [369.45, 369.24],
  [369.71, 368.99],
  [370.75, 369.24],
  [371.98, 369.44],
  [371.75, 368.87],
  [371.87, 369.66],
  [370.02, 369.36],
  [368.27, 369.87],
  [367.15, 370.46],
  [367.18, 370.42],
  [368.53, 370.48],
  [369.83, 370.46],
  [370.76, 370.6],
  [371.69, 370.95],
  [372.63, 371.06],
  [373.55, 370.99],
  [374.03, 371.11],
  [373.4, 371.18],
  [371.68, 371.08],
  [369.78, 371.39],
  [368.34, 371.61],
  [368.61, 371.85],
  [369.94, 371.92],
  [371.42, 372.09],
  [372.7, 372.48],
  [373.37, 372.49],
  [374.3, 372.61],
  [375.19, 372.54],
  [375.93, 372.98],
  [375.69, 373.46],
  [374.16, 373.58],
  [372.03, 373.7],
  [370.92, 374.28],
  [370.73, 374.06],
  [372.43, 374.52],
  [373.98, 374.72],
  [375.07, 374.82],
  [375.82, 374.95],
  [376.64, 374.99],
  [377.92, 375.24],
  [378.78, 375.73],
  [378.46, 376.22],
  [376.88, 376.37],
  [374.57, 376.27],
  [373.34, 376.65],
  [373.31, 376.65],
  [374.84, 376.99],
  [376.17, 376.93],
  [377.17, 376.96],
  [378.05, 377.19],
  [379.06, 377.4],
  [380.54, 377.8],
  [380.8, 377.66],
  [379.87, 377.57],
  [377.65, 377.12],
  [376.17, 377.9],
  [374.43, 377.8],
  [374.63, 377.99],
  [376.33, 378.49],
  [377.68, 378.48],
  [378.63, 378.37],
  [379.91, 379.1],
  [380.95, 379.45],
  [382.48, 379.84],
  [382.64, 379.49],
  [382.4, 380.07],
  [380.93, 380.38],
  [378.93, 380.61],
  [376.89, 380.2],
  [377.19, 380.5],
  [378.54, 380.69],
  [380.31, 381.09],
  [381.58, 381.33],
  [382.4, 381.58],
  [382.86, 381.32],
  [384.8, 382.11],
  [385.22, 382.06],
  [384.24, 381.93],
  [382.65, 382.1],
  [380.6, 382.27],
  [379.04, 382.35],
  [379.33, 382.66],
  [380.35, 382.52],
  [382.02, 382.84],
  [383.1, 382.88],
  [384.12, 383.22],
  [384.81, 383.17],
  [386.73, 383.95],
  [386.78, 383.56],
  [386.33, 384.06],
  [384.73, 384.25],
  [382.24, 383.95],
  [381.2, 384.56],
  [381.37, 384.72],
  [382.7, 384.9],
  [384.19, 385.07],
  [385.78, 385.54],
  [386.06, 385.2],
  [386.28, 384.72],
  [387.33, 384.71],
  [388.78, 385.69],
  [387.99, 385.68],
  [386.62, 386.05],
  [384.32, 385.98],
  [383.41, 386.69],
  [383.22, 386.5],
  [384.41, 386.58],
  [385.79, 386.64],
  [387.17, 386.86],
  [387.7, 386.81],
  [389.04, 387.54],
  [389.76, 387.15],
  [390.36, 387.24],
  [389.7, 387.46],
  [388.24, 387.77],
  [386.29, 387.99],
  [384.95, 388.22],
  [384.64, 387.88],
  [386.23, 388.36],
  [387.63, 388.43],
  [388.91, 388.62],
  [390.41, 389.47],
  [391.37, 389.85],
  [392.67, 390.12],
  [393.21, 390.09],
  [392.38, 390.1],
  [390.41, 389.93],
  [388.54, 390.21],
  [387.03, 390.32],
  [387.43, 390.72],
  [388.87, 390.99],
  [389.99, 390.8],
  [391.5, 391.19],
  [392.05, 391.12],
  [392.8, 391.27],
  [393.44, 390.83],
  [394.41, 391.24],
  [393.95, 391.64],
  [392.72, 392.24],
  [390.33, 392.04],
  [389.28, 392.6],
  [389.19, 392.53],
  [390.48, 392.64],
  [392.06, 392.86],
  [393.31, 393.07],
  [394.04, 393.2],
  [394.59, 392.99],
  [396.38, 393.65],
  [396.93, 393.73],
  [395.91, 393.63],
  [394.56, 394.12],
  [392.59, 394.37],
  [391.32, 394.75],
  [391.27, 394.64],
  [393.2, 395.25],
  [394.57, 395.27],
  [395.78, 395.62],
  [397.03, 396.23],
  [397.66, 396.07],
  [398.64, 395.79],
  [400.02, 396.64],
  [398.81, 396.48],
  [397.51, 397.13],
  [395.39, 397.27],
  [393.72, 397.24],
  [393.9, 397.25],
  [395.36, 397.35],
  [397.03, 397.78],
  [398.04, 397.74],
  [398.27, 397.45],
  [399.91, 398.37],
  [401.51, 398.63],
  [401.96, 398.56],
  [401.43, 399.1],
  [399.27, 398.85],
  [397.18, 399.07],
  [395.54, 399.11],
  [396.16, 399.58],
  [397.4, 399.49],
  [399.08, 399.81],
  [400.18, 399.92],
  [400.55, 399.77],
  [401.74, 400.22],
  [403.35, 400.46],
  [404.15, 400.7],
  [402.97, 400.65],
  [401.46, 401.11],
  [399.11, 401.04],
  [397.82, 401.43],
  [398.49, 401.89],
  [400.27, 402.24],
  [402.06, 402.72],
  [402.73, 402.45],
  [404.25, 403.4],
  [405.06, 403.54],
  [407.6, 404.77],
  [407.9, 404.41],
  [406.99, 404.59],
  [404.59, 404.24],
  [402.45, 404.41],
  [401.23, 404.85],
  [401.79, 405.23],
  [403.72, 405.74],
  [404.64, 405.33],
  [406.36, 406.04],
  [406.66, 405.8],
  [407.54, 406.05],
  [409.22, 406.37],
  [409.89, 406.37],
  [409.08, 406.68],
  [407.33, 407.01],
  [405.32, 407.31],
  [403.57, 407.17],
  [403.82, 407.23],
  [405.31, 407.36],
  [407.0, 407.71],
  [408.15, 407.83],
  [408.52, 407.61],
  [409.59, 408.06],
  [410.45, 407.65],
  [411.44, 407.98],
  [410.99, 408.6],
  [408.9, 408.6],
  [407.16, 409.17],
  [405.71, 409.3],
  [406.19, 409.56],
  [408.21, 410.24],
  [409.27, 409.99],
  [411.03, 410.69],
  [411.96, 410.97],
  [412.18, 410.71],
  [413.54, 410.92],
  [414.86, 411.47],
  [414.15, 411.74],
  [411.96, 411.64],
  [410.17, 412.1],
  [408.76, 412.26],
  [408.74, 412.09],
  [410.47, 412.5],
  [411.97, 412.71],
  [413.59, 413.22],
  [414.32, 413.41],
  [414.72, 413.35],
  [416.42, 413.92],
  [417.28, 413.98],
  [416.58, 414.16],
  [414.58, 414.19],
  [412.75, 414.6],
  [411.5, 414.91],
  [411.49, 414.79],
  [413.1, 415.12],
  [414.23, 414.91],
  [415.49, 415.23],
  [416.72, 415.8],
  [417.61, 416.17],
  [419.01, 416.58],
  [419.09, 415.88],
  [418.93, 416.48],
  [416.9, 416.48],
  [414.42, 416.27],
  [413.26, 416.63],
  [413.9, 417.14],
  [414.97, 416.93],
  [416.67, 417.37],
];
const rows = observations.map(([value, adjusted], month) => ({
  month,
  value,
  adjusted,
}));
const last = rows.length - 1;
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const date = (index: number) =>
  `${months[index % 12]} ${1980 + Math.floor(index / 12)}`;
const blue = "#2563eb",
  amber = "#b7791f",
  ink = "#152b43",
  muted = "#64748b";
function Label({
  x,
  y,
  text,
  size = 12,
  color = muted,
  bold = false,
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
  color?: string;
  bold?: boolean;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${bold ? "600 " : ""}${size}px sans-serif`,
        fill: color,
      }}
    >
      {text}
    </Text>
  );
}
function Button({
  x,
  y,
  label,
  active,
  click,
}: {
  x: number;
  y: number;
  label: string;
  active: boolean;
  click: () => void;
}) {
  return (
    <Group>
      <Rectangle
        style={{
          left: x,
          top: y,
          width: 112,
          height: 28,
          fill: active ? ink : "#e7edf4",
          cursor: "pointer",
        }}
        onClick={click}
      />
      <Label x={x + 12} y={y + 7} text={label} color={active ? "white" : ink} />
    </Group>
  );
}
// Example-level brush: core pointer capture and signals drive the two scales.
function Brush({
  window,
  changeWindow,
}: {
  window: WritableSignal<Window>;
  changeWindow: (range: Window) => void;
}) {
  const x = useLinearScale("x").get();
  const { width, height } = useLayoutBox();
  const [start, end] = window.get();
  type Drag = {
    mode: "start" | "end" | "move";
    pointerId: number;
    anchor: number;
    range: Window;
    owner: PibblEventTarget;
  };
  const drag = useSignal<Drag | undefined>(undefined);
  const monthAt = (rootX: number) => x.invert(rootX - 24);
  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value));
  function begin(event: PibblPointerEvent, mode: Drag["mode"]) {
    if (event.button !== 0 || drag.get()) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.set({
      mode,
      pointerId: event.pointerId,
      anchor: monthAt(event.x),
      range: window.get(),
      owner: event.currentTarget,
    });
  }
  function move(event: PibblPointerEvent) {
    const active = drag.get();
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = Math.round(monthAt(event.x) - active.anchor);
    const [a, b] = active.range;
    if (active.mode === "start") changeWindow([clamp(a + delta, 0, b - 1), b]);
    else if (active.mode === "end")
      changeWindow([a, clamp(b + delta, a + 1, last)]);
    else {
      const from = clamp(a + delta, 0, last - (b - a));
      changeWindow([from, from + b - a]);
    }
  }
  function finish(event: PibblPointerEvent) {
    const active = drag.get();
    if (!active || active.pointerId !== event.pointerId) return;
    drag.set(undefined);
    active.owner.releasePointerCapture(event.pointerId);
  }
  function relocate(rootX: number) {
    const span = end - start;
    const from = clamp(Math.round(monthAt(rootX) - span / 2), 0, last - span);
    changeWindow([from, from + span]);
  }
  const left = x.map(start),
    right = x.map(end);
  const crowded = right - left < 86;
  function endpoint(value: number, mode: "start" | "end") {
    const px = x.map(value);
    const top = crowded && mode === "start" ? -56 : -30;
    const labelLeft = clamp(px - 39, 0, Math.max(0, width - 78));
    const tipBase = clamp(px, labelLeft + 8, labelLeft + 70);
    const bubble = new Path2D();
    bubble.roundRect(labelLeft, top, 78, 23, 5);
    bubble.moveTo(tipBase - 5, top + 23);
    bubble.lineTo(px, top + 30);
    bubble.lineTo(tipBase + 5, top + 23);
    bubble.closePath();
    const grip = new Path2D();
    grip.roundRect(px - 5, height / 2 - 12, 10, 24, 3);
    return (
      <Group key={mode}>
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [px, top + 30],
              [px, height],
            ],
            stroke: blue,
            strokeWidth: 1.5,
          }}
        />
        <Path
          style={{ d: bubble, fill: blue, cursor: "ew-resize" }}
          onPointerDown={(event) => begin(event, mode)}
        />
        <Text
          pointerEvents="none"
          style={{
            left: labelLeft + 39,
            top: top + 6,
            textAlign: "center",
            font: "11px sans-serif",
            fill: "white",
          }}
        >
          {date(value)}
        </Text>
        <Path
          pointerEvents="none"
          style={{ d: grip, fill: "white", stroke: blue, strokeWidth: 1.5 }}
        />
        <Line
          pointerEvents="none"
          style={{
            coords: [
              [px, height / 2 - 5],
              [px, height / 2 + 5],
            ],
            stroke: blue,
            strokeWidth: 1,
          }}
        />
        <Rectangle
          key="hit"
          style={{
            left: mode === "start" ? px - 9 : px - Math.min(9, (right - left) / 2),
            top: -3,
            width: 9 + Math.min(9, (right - left) / 2),
            height: height + 6,
            fill: "transparent",
            cursor: "ew-resize",
          }}
          onPointerDown={(event) => begin(event, mode)}
        />
      </Group>
    );
  }
  return (
    <Group
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={(event) => {
        if (drag.get()?.pointerId === event.pointerId) drag.set(undefined);
      }}
    >
      {Array.from({ length: 42 }, (_, i) => 1980 + i).map((year) => {
        const px = x.map((year - 1980) * 12),
          major = (year - 1980) % 5 === 0;
        return (
          <Group key={year}>
            <Line
              pointerEvents="none"
              style={{
                coords: [
                  [px, height],
                  [px, height + (major ? 6 : 3)],
                ],
                stroke: major ? "#94a3b8" : "#c6d1df",
                strokeWidth: 1,
              }}
            />
            {major && (
              <Text
                pointerEvents="none"
                style={{
                  left: px,
                  top: height + 9,
                  textAlign: year === 1980 ? "left" : "center",
                  font: "10px sans-serif",
                  fill: muted,
                }}
              >
                {year}
              </Text>
            )}
          </Group>
        );
      })}
      <Rectangle
        style={{ width, height, fill: "transparent", cursor: "pointer" }}
        onClick={(event) => relocate(event.x)}
      />
      <Rectangle
        key="selection"
        style={{
          left,
          width: right - left,
          height,
          fill: "transparent",
          cursor: drag.get()?.mode === "move" ? "grabbing" : "grab",
        }}
        onPointerDown={(event) => begin(event, "move")}
      />
      {endpoint(start, "start")}
      {endpoint(end, "end")}
    </Group>
  );
}

function Plot({
  overview,
  window,
  selected,
  pinned,
  changeWindow,
  onSnapshot,
}: {
  overview: boolean;
  window: WritableSignal<Window>;
  selected: WritableSignal<number>;
  pinned: WritableSignal<boolean>;
  changeWindow: (range: Window) => void;
  onSnapshot?: Fixture["onSnapshot"];
}) {
  const x = useLinearScale("x").get(),
    y = useLinearScale("y").get();
  const [start, end] = window.get();
  const selection = selected.get();
  const frame = useLayoutBox();
  onSnapshot?.(overview ? 1 : 0, {
    width: frame.width,
    height: frame.height,
    domain: x.domain,
  });
  const visible = overview ? rows : rows.slice(start, end + 1);
  const indexAt = (rootX: number) =>
    Math.max(
      0,
      Math.min(last, Math.round(x.invert(rootX - (overview ? 24 : 64)))),
    );
  function inspect(rootX: number) {
    if (!pinned.get()) selected.set(indexAt(rootX));
  }
  return (
    <Group>
      <Rectangle
        style={{
          width: frame.width,
          height: frame.height,
          fill: overview ? "#edf2f7" : "#ffffff",
        }}
        pointerEvents="none"
      />
      {!overview &&
        y.ticks((y.domain[1] - y.domain[0]) / 10 + 1).map((value) => (
          <Line
            key={value}
            pointerEvents="none"
            style={{
              coords: [
                [0, y.map(value)],
                [frame.width, y.map(value)],
              ],
              stroke: "#e3eaf2",
              strokeWidth: 1,
            }}
          />
        ))}
      {overview && (
        <Rectangle
          pointerEvents="none"
          style={{
            left: x.map(start),
            width: x.map(end) - x.map(start),
            height: frame.height,
            fill: "#d7e4fa",
          }}
        />
      )}
      <LineSeries
        data={visible}
        x="month"
        y="adjusted"
        xScale="x"
        yScale="y"
        pointerEvents="none"
        style={{
          stroke: overview ? "#9aaabe" : amber,
          strokeWidth: overview ? 1 : 2,
        }}
      />
      <LineSeries
        data={visible}
        x="month"
        y="value"
        xScale="x"
        yScale="y"
        pointerEvents="none"
        style={{ stroke: blue, strokeWidth: overview ? 1.2 : 2 }}
      />
      {overview ? (
        <Brush window={window} changeWindow={changeWindow} />
      ) : (
        <Group>
          <Axis
            scale="y"
            position="left"
            tickCount={(y.domain[1] - y.domain[0]) / 10 + 1}
            style={{ stroke: "#ccd7e3", fill: muted, font: "11px sans-serif" }}
          />
          <Axis
            scale="x"
            position="bottom"
            tickCount={5}
            tickFormat={(value) => typeof value === "string" ? value : date(Math.round(value))}
            style={{ stroke: "#ccd7e3", fill: muted, font: "11px sans-serif" }}
          />
          <Line
            pointerEvents="none"
            style={{
              coords: [
                [x.map(selection), 0],
                [x.map(selection), frame.height],
              ],
              stroke: "#96a8bd",
              strokeWidth: 1,
            }}
          />
          <ScaleAdjust
            x={selection}
            xScale="x"
            y={rows[selection].value}
            yScale="y"
          >
            <Circle
              pointerEvents="none"
              style={{ radius: 4, fill: blue, stroke: "white", strokeWidth: 2 }}
            />
          </ScaleAdjust>
        </Group>
      )}
      {!overview && (
        <Rectangle
          style={{
            width: frame.width,
            height: frame.height,
            fill: "transparent",
            cursor: "crosshair",
          }}
          onPointerMove={(event) => inspect(event.x)}
          onClick={(event) =>
            batch(() => {
              selected.set(indexAt(event.x));
              pinned.update((value) => !value);
            })
          }
        />
      )}
    </Group>
  );
}
function Scene({ fixture }: { fixture: Fixture }) {
  const box = useLayoutBox();
  const ownWindow = useSignal<Window>([last - 119, last]);
  const ownSelected = useSignal(last),
    pinned = useSignal(false);
  const window = fixture.window ?? ownWindow,
    selected = fixture.selected ?? ownSelected;
  const [start, end] = window.get();
  const reading = rows[selected.get()];
  fixture.onReading?.(
    {
      date: date(reading.month),
      value: reading.value,
      adjusted: reading.adjusted,
      interpolated: reading.month === 51,
    },
    rows.length,
  );
  const visible = rows.slice(start, end + 1);
  const low =
    Math.floor((Math.min(...visible.map((row) => row.value)) - 2) / 10) * 10;
  const high =
    Math.ceil((Math.max(...visible.map((row) => row.value)) + 2) / 10) * 10;
  function changeWindow(range: Window) {
    batch(() => {
      window.set(range);
      selected.set(range[1]);
      pinned.set(false);
    });
  }
  const plotWidth = Math.max(1, box.width - 96),
    plotHeight = Math.max(60, box.height - 390);
  const delta = reading.value - reading.adjusted;
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width: box.width, height: box.height, fill: "#f6f8fb" }}
      />
      <Label x={24} y={20} text="CO₂ at Mauna Loa" size={26} bold color={ink} />
      <Label
        x={24}
        y={55}
        text="504 monthly observations · January 1980–December 2021"
      />
      <Button
        x={Math.max(24, box.width - 264)}
        y={82}
        label="Last 10 years"
        active={start === last - 119 && end === last}
        click={() => changeWindow([last - 119, last])}
      />
      <Button
        x={Math.max(144, box.width - 144)}
        y={82}
        label="Full record"
        active={start === 0 && end === last}
        click={() => changeWindow([0, last])}
      />
      <Label
        x={24}
        y={88}
        text={date(reading.month)}
        bold
        size={16}
        color={ink}
      />
      <Label x={112} y={92} text="Monthly mean" size={11} color={blue} />
      <Label
        x={24}
        y={114}
        text={`${reading.value.toFixed(2)} ppm`}
        bold
        size={25}
        color={blue}
      />
      <Label x={215} y={91} text="Seasonally adjusted" color={amber} />
      <Label
        x={215}
        y={114}
        text={`${reading.adjusted.toFixed(2)} ppm`}
        size={22}
        color={ink}
      />
      {box.width > 850 && (
        <Group>
          <Label x={450} y={91} text="Monthly − adjusted" />
          <Label
            x={450}
            y={117}
            text={`${delta >= 0 ? "+" : ""}${delta.toFixed(2)} ppm`}
            size={19}
            color={ink}
          />
        </Group>
      )}
      <Label x={64} y={157} text="CO₂ concentration · ppm" size={11} />
      <Label
        x={Math.max(320, box.width - 300)}
        y={157}
        text={
          pinned.get()
            ? "Pinned · click plot to resume"
            : "Hover to inspect · click to pin"
        }
        size={11}
      />
      <Group style={{ translateX: 64, translateY: 182 }}>
        <Absolute style={{ width: plotWidth, height: plotHeight }}>
          <LinearScale
            id="x"

            domain={window}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale
              id="y"

              domain={[low, high]}
              range="height"
              reverse
            >
              <Plot
                overview={false}
                window={window}
                selected={selected}
                pinned={pinned}
                changeWindow={changeWindow}
                onSnapshot={fixture.onSnapshot}
              />
            </LinearScale>
          </LinearScale>
        </Absolute>
      </Group>
      <Label
        x={24}
        y={box.height - 160}
        text="EXPLORE THE ARCHIVE"
        size={10}
        bold
      />
      <Label
        x={210}
        y={box.height - 160}
        text={"Drag the selection to pan · drag either edge to resize"}
        size={11}
      />
      <Group style={{ translateX: 24, translateY: box.height - 88 }}>
        <Absolute style={{ width: Math.max(1, box.width - 48), height: 40 }}>
          <LinearScale
            id="x"

            domain={[0, last]}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale
              id="y"

              domain={[330, 430]}
              range="height"
              reverse
            >
              <Plot
                overview
                window={window}
                selected={selected}
                pinned={pinned}
                changeWindow={changeWindow}
                onSnapshot={fixture.onSnapshot}
              />
            </LinearScale>
          </LinearScale>
        </Absolute>
      </Group>
      <Label
        x={24}
        y={box.height - 20}
        text={
          reading.month === 51
            ? "April 1984 is interpolated in the NOAA record."
            : "Source: NOAA GML / Scripps · frozen historical snapshot · gml.noaa.gov/ccgg/trends"
        }
        size={10}
      />
    </Group>
  );
}
// VIZ_FOUNDATION_SOURCE_ID = 'viz-foundation-example'
export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): PibblController {
  return pibbl(canvas, <Scene fixture={fixture} />, { viewport: "responsive" });
}
