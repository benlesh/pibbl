import {
  Absolute,
  FocusManagement,
  Group,
  Line,
  Rectangle,
  Text,
  pibbl,
  signal,
  useLayoutBox,
  useReaction,
  useSignal,
  type PibblController,
  type WritableSignal,
} from "@pibbl/core";
import {
  Axis,
  BarScale,
  HorizontalIntervalSeries,
  GridLines,
  LogScale,
  ReferenceLine,
  useBarScale,
} from "@pibbl/core/viz";

interface Trial {
  readonly study: string;
  readonly participants: number;
  readonly effect: number;
  readonly lower: number;
  readonly upper: number;
}
// Deterministic synthetic results, invented solely for this authoring example.
// No real medicine, trial, patient record, fitted model, or pooled estimate.
// Supplied 95% confidence intervals are illustrative inputs, not computed here.
const trials: readonly Trial[] = [
  {
    study: "Trial A",
    participants: 420,
    effect: 0.68,
    lower: 0.48,
    upper: 0.96,
  },
  {
    study: "Trial B",
    participants: 650,
    effect: 0.82,
    lower: 0.65,
    upper: 1.03,
  },
  {
    study: "Trial C",
    participants: 510,
    effect: 0.93,
    lower: 0.71,
    upper: 1.22,
  },
  {
    study: "Trial D",
    participants: 380,
    effect: 1.07,
    lower: 0.81,
    upper: 1.42,
  },
  {
    study: "Trial E",
    participants: 290,
    effect: 0.75,
    lower: 0.53,
    upper: 1.06,
  },
  {
    study: "Trial F",
    participants: 460,
    effect: 0.88,
    lower: 0.66,
    upper: 1.18,
  },
];
interface Fixture {
  readonly selected?: WritableSignal<string | null>;
  readonly sorted?: WritableSignal<boolean>;
}
const ink = "#203441",
  muted = "#627480",
  teal = "#087d83";
function Label({
  x,
  y,
  children,
  size = 12,
  color = ink,
  weight = 400,
  align = "left",
  numeric = false,
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  color?: string;
  weight?: number;
  align?: CanvasTextAlign;
  numeric?: boolean;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${weight} ${size}px ${numeric ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"}`,
        textAlign: align,
        fill: color,
        textBaseline: "middle",
      }}
    >
      {children}
    </Text>
  );
}
function Rows({
  rows,
  width,
  compact,
  selected,
}: {
  rows: readonly Trial[];
  width: number;
  compact: boolean;
  selected: WritableSignal<string | null>;
}) {
  const scale = useBarScale("studies").get();
  return (
    <>
      {rows.map((row) => {
        const y = scale.map(row.study)! + scale.bandwidth / 2;
        const active = selected.get() === row.study;
        return (
          <Group key={row.study}>
            <Rectangle
              keyboardFocusable
              onClick={() => selected.set(row.study)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selected.set(row.study);
                }
              }}
              style={{
                left: compact ? -16 : -296,
                top: y - scale.bandwidth / 2,
                width: compact ? width + 32 : width + 484,
                height: scale.bandwidth,
                fill: active ? "#e9f3f2" : "#ffffff",
                cursor: "pointer",
              }}
            />
            <Line
              pointerEvents="none"
              style={{
                coords: [
                  [compact ? -16 : -296, y + scale.bandwidth / 2],
                  [compact ? width + 16 : width + 188, y + scale.bandwidth / 2],
                ],
                stroke: "#e7edef",
                strokeWidth: 1,
              }}
            />
            {active && (
              <Rectangle
                pointerEvents="none"
                style={{
                  left: compact ? -16 : -296,
                  top: y - scale.bandwidth / 2,
                  width: 3,
                  height: scale.bandwidth,
                  fill: teal,
                }}
              />
            )}
            <Label
              x={compact ? 0 : -288}
              y={compact ? y - 24 : y}
              size={13}
              weight={600}
              children={row.study}
            />
            <Label
              x={compact ? width : -100}
              y={compact ? y - 24 : y}
              color={muted}
              align="right"
              numeric
              children={
                compact ? `n = ${row.participants}` : String(row.participants)
              }
            />
            <Label
              x={compact ? 0 : width + 70}
              y={compact ? y + 25 : y}
              align={compact ? "left" : "right"}
              weight={600}
              numeric
              children={
                compact ? `RR ${row.effect.toFixed(2)}` : row.effect.toFixed(2)
              }
            />
            <Label
              x={compact ? width : width + 180}
              y={compact ? y + 25 : y}
              align="right"
              numeric
              color={muted}
              children={
                compact
                  ? `95% CI ${row.lower.toFixed(2)}–${row.upper.toFixed(2)}`
                  : `${row.lower.toFixed(2)}–${row.upper.toFixed(2)}`
              }
            />
          </Group>
        );
      })}
    </>
  );
}
function Scene({
  fixture,
  canvas,
}: {
  fixture: Fixture;
  canvas: HTMLCanvasElement;
}) {
  const box = useLayoutBox();
  const localSelected = useSignal<string | null>(null),
    localSorted = useSignal(false);
  const selected = fixture.selected ?? localSelected,
    sorted = fixture.sorted ?? localSorted;
  const compact = box.width < 620;
  useReaction(() => {
    const height = compact ? "880px" : "680px";
    canvas.style.height = height;
    canvas.style.minHeight = height;
  }, [compact, canvas]);
  const rows = sorted.get()
    ? [...trials].sort((a, b) => a.effect - b.effect)
    : trials;
  const left = compact ? 36 : 324,
    top = compact ? 194 : 178;
  const width = Math.max(180, box.width - left - (compact ? 36 : 216));
  const height = rows.length * (compact ? 78 : 54);
  const inspected = trials.find((row) => row.study === selected.get());
  return (
    <FocusManagement>
      <Group>
        <Rectangle
          pointerEvents="none"
          style={{ width: box.width, height: box.height, fill: "#ffffff" }}
        />
        <Label
          x={compact ? 20 : 36}
          y={16}
          size={9}
          weight={600}
          color={muted}
          children="CLINICAL RESEARCH"
        />
        {!compact && (
          <>
            <Rectangle
              pointerEvents="none"
              style={{
                left: box.width - 152,
                top: 24,
                width: 116,
                height: 25,
                fill: "#f0f4f5",
                cornerRadius: 4,
              }}
            />
            <Label
              x={box.width - 94}
              y={37}
              size={9}
              weight={600}
              align="center"
              color={muted}
              children="SYNTHETIC DATA"
            />
          </>
        )}
        <Label
          x={compact ? 20 : 36}
          y={42}
          size={compact ? 24 : 28}
          weight={600}
          children="Clinical forest plot"
        />
        <Label
          x={compact ? 20 : 36}
          y={73}
          color={muted}
          children={
            compact
              ? "Synthetic Drug A vs comparator · week 24"
              : "Drug A vs comparator · endpoint at week 24"
          }
        />
        <Label
          x={compact ? 20 : 36}
          y={94}
          size={11}
          color={muted}
          children={
            compact
              ? "Intention-to-treat · supplied 95% CIs"
              : "Intention-to-treat population · supplied 95% confidence intervals"
          }
        />
        <Group style={{ translateX: compact ? 20 : 36, translateY: 111 }}>
          <Rectangle
            keyboardFocusable
            onClick={() => sorted.set(!sorted.get())}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                sorted.set(!sorted.get());
              }
            }}
            style={{
              width: 212,
              height: 40,
              fill: sorted.get() ? "#edf5f4" : "#ffffff",
              stroke: sorted.get() ? "#9cc4c0" : "#d5dfe3",
              strokeWidth: 1,
              cornerRadius: 6,
              cursor: "pointer",
            }}
          />
          <Label
            x={14}
            y={20}
            weight={500}
            children={sorted.get() ? "Restore trial order" : "Sort by effect"}
          />
        </Group>
        {!compact && (
          <>
            <Label
              x={36}
              y={165}
              size={10}
              weight={600}
              color={muted}
              children="STUDY"
            />
            <Label
              x={224}
              y={165}
              size={10}
              weight={600}
              align="right"
              color={muted}
              children="n"
            />
            <Label
              x={left}
              y={165}
              size={10}
              weight={600}
              color={muted}
              children="RISK RATIO · 95% CI"
            />
            <Label
              x={left + width + 70}
              y={165}
              size={10}
              weight={600}
              align="right"
              color={muted}
              children="RR"
            />
            <Label
              x={left + width + 180}
              y={165}
              size={10}
              weight={600}
              align="right"
              color={muted}
              children="95% CI"
            />
            <Line
              pointerEvents="none"
              style={{
                coords: [
                  [28, 178],
                  [box.width - 28, 178],
                ],
                stroke: "#cedadd",
                strokeWidth: 1,
              }}
            />
          </>
        )}
        <Absolute>
          <BarScale
            id="studies"
            domain={rows.map((row) => row.study)}
            range="height"
            style={{ left, top, width, height }}
          >
            <LogScale id="effect" domain={[0.4, 1.6]} range="width">
              <Rows
                rows={rows}
                width={width}
                compact={compact}
                selected={selected}
              />
              <GridLines
                scale="effect"
                direction="vertical"
                span={[0, height]}
                tickValues={[0.4, 0.6, 0.8, 1.2, 1.6]}
                style={{ stroke: "#f0f3f5", strokeWidth: 1 }}
              />
              <ReferenceLine
                scale="effect"
                value={1}
                direction="vertical"
                span={[0, height]}
                style={{ stroke: "#9aadb5", strokeWidth: 1 }}
              />
              <HorizontalIntervalSeries
                data={rows}
                category="study"
                estimate="effect"
                lower="lower"
                upper="upper"
                categoryScale="studies"
                valueScale="effect"
                pointerEvents="none"
                style={{
                  stroke: teal,
                  fill: teal,
                  radius: 4,
                  capSize: 7,
                  strokeWidth: 1.6,
                }}
              />
              <Axis
                scale="effect"
                position="bottom"
                tickValues={[0.4, 0.6, 0.8, 1, 1.2, 1.6]}
                tickFormat={(value) => String(value)}
                style={{
                  fill: muted,
                  stroke: "#a6bab5",
                  font: "11px -apple-system, BlinkMacSystemFont, sans-serif",
                }}
              />
            </LogScale>
          </BarScale>
        </Absolute>
        <Label
          x={left}
          y={top + height + 42}
          color={muted}
          children={
            compact
              ? "Risk ratio · log axis · null = 1"
              : "Risk ratio · logarithmic axis · null = 1"
          }
        />
        <Rectangle
          pointerEvents="none"
          style={{
            left: compact ? 16 : 28,
            top: top + height + 62,
            width: box.width - (compact ? 32 : 56),
            height: 64,
            fill: "#f4f7f8",
            cornerRadius: 4,
          }}
        />
        <Label
          x={compact ? 28 : 44}
          y={top + height + 82}
          weight={500}
          color={teal}
          children={
            inspected
              ? `${inspected.study}: RR ${inspected.effect.toFixed(2)} · n = ${inspected.participants}`
              : compact
                ? "Inspect a trial"
                : "Inspect a trial · select a row"
          }
        />
        <Label
          x={compact ? 28 : 44}
          y={top + height + 104}
          size={11}
          color={muted}
          children={
            inspected
              ? `95% CI: ${inspected.lower.toFixed(2)}–${inspected.upper.toFixed(2)}`
              : compact
                ? "Tap a row, or use Tab and Enter."
                : "Click or tap a row, or use Tab and Enter. All numerical results remain visible above."
          }
        />
        <Label
          x={compact ? 20 : 36}
          y={top + height + 138}
          size={10}
          color={muted}
          children={
            compact
              ? "Synthetic data · equal-size points"
              : "Synthetic teaching data · equal-size estimate points · no pooled result"
          }
        />
        <Label
          x={compact ? 20 : 36}
          y={top + height + 157}
          size={10}
          color={muted}
          children="Illustrative results · no inference performed."
        />
      </Group>
    </FocusManagement>
  );
}

const mounts = new WeakMap<HTMLCanvasElement, PibblController>();

export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): PibblController {
  mounts.get(canvas)?.dispose();
  const selected = fixture.selected ?? signal<string | null>(null);
  const oldHeight = canvas.style.height;
  const oldMinHeight = canvas.style.minHeight,
    oldTouchAction = canvas.style.touchAction;
  const host = canvas.parentElement;
  const oldOverflow = host?.style.overflow,
    oldDisplay = host?.style.display;
  canvas.style.height =
    canvas.clientWidth > 0 && canvas.clientWidth < 620 ? "880px" : "680px";
  canvas.style.minHeight = canvas.style.height;
  canvas.style.touchAction = "pan-y";
  if (host) {
    host.style.overflow = "auto";
    host.style.display = "block";
  }
  function restore() {
    canvas.style.height = oldHeight;
    canvas.style.minHeight = oldMinHeight;
    canvas.style.touchAction = oldTouchAction;
    if (host) {
      host.style.overflow = oldOverflow ?? "";
      host.style.display = oldDisplay ?? "";
    }
  }
  // Application-owned HTML provides the same essential values without Canvas or hover.
  const details = document.createElement("details");
  details.style.cssText =
    "padding:16px 28px;overflow-x:auto;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:white;color:#203441;border-top:1px solid #e7edef";
  const summary = document.createElement("summary");
  summary.textContent = "View study data · synthetic results";
  summary.style.cssText =
    "cursor:pointer;font-weight:500;padding:8px 0;color:#087d83";
  const table = document.createElement("table");
  table.style.cssText =
    "width:100%;border-collapse:collapse;text-align:left;margin-top:12px;font-variant-numeric:tabular-nums";
  const caption = document.createElement("caption");
  caption.style.cssText =
    "text-align:left;color:#627480;line-height:1.6;padding-bottom:12px;font-size:11px";
  caption.textContent =
    "Synthetic Drug A vs comparator, week 24, intention-to-treat. Risk ratios with supplied 95% confidence intervals.";
  table.append(caption);
  const header = table.createTHead().insertRow();
  for (const title of [
    "Study",
    "Participants",
    "Risk ratio",
    "95% CI",
    "Inspect",
  ]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = title;
    th.style.cssText =
      "padding:10px 12px;border-bottom:1px solid #cedadd;font-size:10px;font-weight:600;color:#627480";
    header.append(th);
  }
  const body = table.createTBody();
  for (const trial of trials) {
    const row = body.insertRow();
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = trial.study;
    name.style.cssText =
      "padding:10px 12px;border-bottom:1px solid #e7edef;font-weight:600;white-space:nowrap";
    row.append(name);
    for (const value of [
      String(trial.participants),
      trial.effect.toFixed(2),
      `${trial.lower.toFixed(2)}–${trial.upper.toFixed(2)}`,
    ]) {
      const cell = row.insertCell();
      cell.textContent = value;
      cell.style.cssText =
        "padding:10px 12px;border-bottom:1px solid #e7edef;text-align:right;white-space:nowrap";
    }
    const button = document.createElement("button");
    button.textContent = `Inspect ${trial.study}`;
    button.style.cssText =
      "min-height:40px;padding:0 12px;border:1px solid #d5dfe3;border-radius:4px;background:white;color:#087d83;font:inherit;font-size:11px;cursor:pointer;white-space:nowrap";
    button.onclick = () => selected.set(trial.study);
    const action = row.insertCell();
    action.style.cssText =
      "padding:6px 12px;border-bottom:1px solid #e7edef;text-align:right";
    action.append(button);
  }
  details.append(summary, table);
  canvas.after(details);
  try {
    const controller = pibbl(
      canvas,
      <Scene fixture={{ ...fixture, selected }} canvas={canvas} />,
      { viewport: "responsive" },
    );
    let disposed = false;
    const owned: PibblController = {
      dispose() {
        if (disposed) return;
        disposed = true;
        mounts.delete(canvas);
        controller.dispose();
        details.remove();
        restore();
      },
    };
    mounts.set(canvas, owned);
    return owned;
  } catch (error) {
    details.remove();
    restore();
    throw error;
  }
}
