import {
  Absolute,
  Group,
  Line,
  Rectangle,
  Text,
  pibbl,
  signal,
  useLayoutBox,
  useReaction,
  useSignal,
  type PibblNode,
  type PibblController,
  type WritableSignal,
} from "@pibbl/core";
import {
  Axis,
  LinearScale,
  LineSeries,
  PairedSeries,
  PointSeries,
  ReferenceLine,
  TrajectorySeries,
} from "@pibbl/core/viz";

type Arm = "Candidate" | "Placebo";
interface Visit {
  readonly participant: string;
  readonly arm: Arm;
  readonly week: number;
  readonly actual: number | null;
  readonly change: number | null;
}
interface Pair {
  readonly participant: string;
  readonly arm: Arm;
  readonly baseline: number;
  readonly week12: number | null;
  readonly change: number | null;
}

// All values below are invented training records. Each visit score and change
// is supplied explicitly; Pibbl does not calculate baseline change, pairing,
// arm summaries, imputation, or an efficacy conclusion.
const visits: readonly Visit[] = [
  { participant: "P-01", arm: "Candidate", week: 0, actual: 68, change: 0 },
  { participant: "P-01", arm: "Candidate", week: 2, actual: 63, change: -5 },
  { participant: "P-01", arm: "Candidate", week: 4, actual: 57, change: -11 },
  { participant: "P-01", arm: "Candidate", week: 8, actual: 52, change: -16 },
  { participant: "P-01", arm: "Candidate", week: 12, actual: 49, change: -19 },
  { participant: "P-02", arm: "Candidate", week: 0, actual: 61, change: 0 },
  { participant: "P-02", arm: "Candidate", week: 2, actual: 58, change: -3 },
  { participant: "P-02", arm: "Candidate", week: 4, actual: 54, change: -7 },
  { participant: "P-02", arm: "Candidate", week: 8, actual: 48, change: -13 },
  { participant: "P-02", arm: "Candidate", week: 12, actual: 45, change: -16 },
  { participant: "P-03", arm: "Candidate", week: 0, actual: 72, change: 0 },
  { participant: "P-03", arm: "Candidate", week: 2, actual: 69, change: -3 },
  { participant: "P-03", arm: "Candidate", week: 4, actual: 63, change: -9 },
  { participant: "P-03", arm: "Candidate", week: 8, actual: 59, change: -13 },
  { participant: "P-03", arm: "Candidate", week: 12, actual: 55, change: -17 },
  { participant: "P-04", arm: "Candidate", week: 0, actual: 59, change: 0 },
  { participant: "P-04", arm: "Candidate", week: 2, actual: 55, change: -4 },
  { participant: "P-04", arm: "Candidate", week: 4, actual: 50, change: -9 },
  { participant: "P-04", arm: "Candidate", week: 8, actual: 47, change: -12 },
  { participant: "P-04", arm: "Candidate", week: 12, actual: 44, change: -15 },
  { participant: "P-05", arm: "Candidate", week: 0, actual: 66, change: 0 },
  { participant: "P-05", arm: "Candidate", week: 2, actual: 64, change: -2 },
  { participant: "P-05", arm: "Candidate", week: 4, actual: 60, change: -6 },
  { participant: "P-05", arm: "Candidate", week: 8, actual: 56, change: -10 },
  { participant: "P-05", arm: "Candidate", week: 12, actual: 53, change: -13 },
  { participant: "P-06", arm: "Candidate", week: 0, actual: 64, change: 0 },
  { participant: "P-06", arm: "Candidate", week: 2, actual: 59, change: -5 },
  { participant: "P-06", arm: "Candidate", week: 4, actual: 55, change: -9 },
  { participant: "P-06", arm: "Candidate", week: 8, actual: 50, change: -14 },
  { participant: "P-06", arm: "Candidate", week: 12, actual: 48, change: -16 },
  { participant: "P-07", arm: "Candidate", week: 0, actual: 70, change: 0 },
  { participant: "P-07", arm: "Candidate", week: 2, actual: 66, change: -4 },
  { participant: "P-07", arm: "Candidate", week: 4, actual: 61, change: -9 },
  {
    participant: "P-07",
    arm: "Candidate",
    week: 8,
    actual: null,
    change: null,
  },
  { participant: "P-07", arm: "Candidate", week: 12, actual: 54, change: -16 },
  { participant: "P-08", arm: "Candidate", week: 0, actual: 63, change: 0 },
  { participant: "P-08", arm: "Candidate", week: 2, actual: 60, change: -3 },
  { participant: "P-08", arm: "Candidate", week: 4, actual: 56, change: -7 },
  { participant: "P-08", arm: "Candidate", week: 8, actual: 51, change: -12 },
  { participant: "P-08", arm: "Candidate", week: 12, actual: 47, change: -16 },
  { participant: "P-09", arm: "Candidate", week: 0, actual: 58, change: 0 },
  { participant: "P-09", arm: "Candidate", week: 2, actual: 56, change: -2 },
  { participant: "P-09", arm: "Candidate", week: 4, actual: 53, change: -5 },
  { participant: "P-09", arm: "Candidate", week: 8, actual: 49, change: -9 },
  { participant: "P-09", arm: "Candidate", week: 12, actual: 46, change: -12 },
  { participant: "P-10", arm: "Candidate", week: 0, actual: 67, change: 0 },
  { participant: "P-10", arm: "Candidate", week: 2, actual: 62, change: -5 },
  { participant: "P-10", arm: "Candidate", week: 4, actual: 58, change: -9 },
  { participant: "P-10", arm: "Candidate", week: 8, actual: 54, change: -13 },
  { participant: "P-10", arm: "Candidate", week: 12, actual: 51, change: -16 },
  { participant: "P-11", arm: "Placebo", week: 0, actual: 65, change: 0 },
  { participant: "P-11", arm: "Placebo", week: 2, actual: 64, change: -1 },
  { participant: "P-11", arm: "Placebo", week: 4, actual: 63, change: -2 },
  { participant: "P-11", arm: "Placebo", week: 8, actual: 62, change: -3 },
  { participant: "P-11", arm: "Placebo", week: 12, actual: 62, change: -3 },
  { participant: "P-12", arm: "Placebo", week: 0, actual: 60, change: 0 },
  { participant: "P-12", arm: "Placebo", week: 2, actual: 59, change: -1 },
  { participant: "P-12", arm: "Placebo", week: 4, actual: 60, change: 0 },
  { participant: "P-12", arm: "Placebo", week: 8, actual: 58, change: -2 },
  { participant: "P-12", arm: "Placebo", week: 12, actual: 57, change: -3 },
  { participant: "P-13", arm: "Placebo", week: 0, actual: 71, change: 0 },
  { participant: "P-13", arm: "Placebo", week: 2, actual: 70, change: -1 },
  { participant: "P-13", arm: "Placebo", week: 4, actual: 69, change: -2 },
  { participant: "P-13", arm: "Placebo", week: 8, actual: 68, change: -3 },
  { participant: "P-13", arm: "Placebo", week: 12, actual: 67, change: -4 },
  { participant: "P-14", arm: "Placebo", week: 0, actual: 62, change: 0 },
  { participant: "P-14", arm: "Placebo", week: 2, actual: 61, change: -1 },
  { participant: "P-14", arm: "Placebo", week: 4, actual: 60, change: -2 },
  { participant: "P-14", arm: "Placebo", week: 8, actual: null, change: null },
  { participant: "P-14", arm: "Placebo", week: 12, actual: null, change: null },
  { participant: "P-15", arm: "Placebo", week: 0, actual: 57, change: 0 },
  { participant: "P-15", arm: "Placebo", week: 2, actual: 56, change: -1 },
  { participant: "P-15", arm: "Placebo", week: 4, actual: 55, change: -2 },
  { participant: "P-15", arm: "Placebo", week: 8, actual: 55, change: -2 },
  { participant: "P-15", arm: "Placebo", week: 12, actual: 54, change: -3 },
  { participant: "P-16", arm: "Placebo", week: 0, actual: 69, change: 0 },
  { participant: "P-16", arm: "Placebo", week: 2, actual: 67, change: -2 },
  { participant: "P-16", arm: "Placebo", week: 4, actual: 67, change: -2 },
  { participant: "P-16", arm: "Placebo", week: 8, actual: 66, change: -3 },
  { participant: "P-16", arm: "Placebo", week: 12, actual: 65, change: -4 },
];
const pairs: readonly Pair[] = [
  {
    participant: "P-01",
    arm: "Candidate",
    baseline: 68,
    week12: 49,
    change: -19,
  },
  {
    participant: "P-02",
    arm: "Candidate",
    baseline: 61,
    week12: 45,
    change: -16,
  },
  {
    participant: "P-03",
    arm: "Candidate",
    baseline: 72,
    week12: 55,
    change: -17,
  },
  {
    participant: "P-04",
    arm: "Candidate",
    baseline: 59,
    week12: 44,
    change: -15,
  },
  {
    participant: "P-05",
    arm: "Candidate",
    baseline: 66,
    week12: 53,
    change: -13,
  },
  {
    participant: "P-06",
    arm: "Candidate",
    baseline: 64,
    week12: 48,
    change: -16,
  },
  {
    participant: "P-07",
    arm: "Candidate",
    baseline: 70,
    week12: 54,
    change: -16,
  },
  {
    participant: "P-08",
    arm: "Candidate",
    baseline: 63,
    week12: 47,
    change: -16,
  },
  {
    participant: "P-09",
    arm: "Candidate",
    baseline: 58,
    week12: 46,
    change: -12,
  },
  {
    participant: "P-10",
    arm: "Candidate",
    baseline: 67,
    week12: 51,
    change: -16,
  },
  { participant: "P-11", arm: "Placebo", baseline: 65, week12: 62, change: -3 },
  { participant: "P-12", arm: "Placebo", baseline: 60, week12: 57, change: -3 },
  { participant: "P-13", arm: "Placebo", baseline: 71, week12: 67, change: -4 },
  {
    participant: "P-14",
    arm: "Placebo",
    baseline: 62,
    week12: null,
    change: null,
  },
  { participant: "P-15", arm: "Placebo", baseline: 57, week12: 54, change: -3 },
  { participant: "P-16", arm: "Placebo", baseline: 69, week12: 65, change: -4 },
];
const candidate = "#087d83",
  placebo = "#75858d",
  ink = "#203441",
  muted = "#627480";
const byArm = (arm: Arm) => (row: { arm: Arm }) => row.arm === arm;
interface Fixture {
  readonly selectedParticipant?: WritableSignal<string | null>;
  readonly showTracks?: WritableSignal<boolean>;
}
function Label({
  x,
  y,
  children,
  size = 12,
  weight = 400,
  color = ink,
  align = "left",
}: {
  x: number;
  y: number;
  children: string;
  size?: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
}) {
  return (
    <Text
      pointerEvents="none"
      style={{
        left: x,
        top: y,
        font: `${weight} ${size}px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif`,
        fill: color,
        textAlign: align,
        textBaseline: "middle",
      }}
    >
      {children}
    </Text>
  );
}
function Pane({
  left,
  top,
  width,
  height,
  title,
  children,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  title: string;
  children: PibblNode;
}) {
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{
          left,
          top,
          width,
          height,
          fill: "#fbfcfc",
          stroke: "#dfe8ea",
          strokeWidth: 1,
          cornerRadius: 8,
        }}
      />
      <Label x={left + 18} y={top + 22} size={12} weight={650}>
        {title}
      </Label>
      {children}
    </Group>
  );
}
function Scene({
  canvas,
  fixture,
}: {
  canvas: HTMLCanvasElement;
  fixture: Fixture;
}) {
  const { width } = useLayoutBox();
  const localSelected = useSignal<string | null>(null),
    localTracks = useSignal(true);
  const selected = fixture.selectedParticipant ?? localSelected,
    showTracks = fixture.showTracks ?? localTracks;
  const compact = width < 700;
  useReaction(() => {
    const value = compact ? "1160px" : "720px";
    canvas.style.height = value;
    canvas.style.minHeight = value;
  }, [compact, canvas]);
  const paneWidth = compact ? width - 40 : (width - 64) / 2,
    paneHeight = compact ? 360 : 340,
    plotHeight = paneHeight - (compact ? 118 : 98),
    leftA = 20,
    leftB = compact ? 20 : 44 + paneWidth,
    topA = 174,
    topB = compact ? 554 : 174;
  const selectedVisits = visits.filter(
    (row) => row.participant === selected.get(),
  );
  const selectedPair = pairs.find((row) => row.participant === selected.get());
  return (
    <Group>
      <Rectangle
        pointerEvents="none"
        style={{ width, height: compact ? 1160 : 720, fill: "white" }}
      />
      {compact ? (
        <>
          <Label x={24} y={16} size={9} weight={650} color={muted}>
            SYNTHETIC PHASE II · TRAINING DATA
          </Label>
          <Label x={24} y={39} size={18} weight={650}>
            Participant trajectories
          </Label>
          <Label x={24} y={59} size={18} weight={650}>
            and paired endpoints
          </Label>
          <Label x={24} y={82} size={10} color={muted}>
            Synthetic teaching data · symptom index
          </Label>
          <Label x={24} y={98} size={10} color={muted}>
            (0–100 points; lower is better)
          </Label>
          <Label x={24} y={120} size={10} weight={600}>
            16 participants · scheduled visits retained
          </Label>
          <Label x={24} y={136} size={10} weight={600}>
            when measurements are absent
          </Label>
        </>
      ) : (
        <>
          <Label x={24} y={22} size={10} weight={650} color={muted}>
            SYNTHETIC PHASE II · REPEATED-MEASURES TRAINING DATA
          </Label>
          <Label x={24} y={54} size={27} weight={650}>
            Participant trajectories and paired endpoints
          </Label>
          <Label x={24} y={84} size={11} color={muted}>
            Invented anti-inflammatory candidate · symptom-burden index (0–100,
            lower is better)
          </Label>
          <Label x={24} y={111} size={11} weight={600}>
            16 participants · baseline and weeks 2, 4, 8, 12 · scheduled visits
            retained when measurements are absent
          </Label>
        </>
      )}
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [30, compact ? 154 : 138],
            [46, compact ? 154 : 138],
          ],
          stroke: candidate,
          strokeWidth: 2,
        }}
      />
      <Label x={52} y={compact ? 154 : 138} size={11}>
        Candidate (n = 10)
      </Label>
      <Line
        pointerEvents="none"
        style={{
          coords: [
            [180, compact ? 154 : 138],
            [196, compact ? 154 : 138],
          ],
          stroke: placebo,
          strokeWidth: 2,
        }}
      />
      <Label x={202} y={compact ? 154 : 138} size={11}>
        Placebo (n = 6)
      </Label>
      <Pane
        left={leftA}
        top={topA}
        width={paneWidth}
        height={paneHeight}
        title={
          compact
            ? "Participant change (points)"
            : "Change from baseline (points) · each participant"
        }
      >
        <Absolute
          style={{
            left: leftA + 42,
            top: topA + 52,
            width: paneWidth - 60,
            height: plotHeight,
          }}
        >
          <LinearScale
            id="week"
            domain={[0, 12]}
            range={[0, paneWidth - 60]}
            style={{ width: paneWidth - 60, height: plotHeight }}
          >
            <LinearScale id="change" domain={[-30, 10]} range={[plotHeight, 0]}>
              <ReferenceLine
                scale="change"
                direction="horizontal"
                value={0}
                span={[0, paneWidth - 60]}
                style={{ stroke: "#b9c6ca", strokeWidth: 1 }}
              />
              {showTracks.get() && (
                <>
                  <TrajectorySeries
                    data={visits}
                    group="participant"
                    x="week"
                    y="change"
                    xScale="week"
                    yScale="change"
                    defined={byArm("Candidate")}
                    pointerEvents="none"
                    style={{
                      stroke: candidate,
                      strokeWidth: 1.25,
                      opacity: 0.45,
                    }}
                  />
                  <TrajectorySeries
                    data={visits}
                    group="participant"
                    x="week"
                    y="change"
                    xScale="week"
                    yScale="change"
                    defined={byArm("Placebo")}
                    pointerEvents="none"
                    style={{
                      stroke: placebo,
                      strokeWidth: 1.25,
                      opacity: 0.45,
                    }}
                  />
                </>
              )}
              {selectedVisits.length > 0 && (
                <LineSeries
                  data={selectedVisits}
                  x="week"
                  y="change"
                  xScale="week"
                  yScale="change"
                  pointerEvents="none"
                  style={{ stroke: "#203441", strokeWidth: 3 }}
                />
              )}
              <PointSeries
                data={visits}
                x="week"
                y="change"
                xScale="week"
                yScale="change"
                pointerEvents="none"
                style={(row) => ({
                  radius: row.participant === selected.get() ? 4.5 : 2.5,
                  fill: row.arm === "Candidate" ? candidate : placebo,
                  opacity: row.participant === selected.get() ? 1 : 0.6,
                })}
              />
              <Axis
                scale="change"
                position="left"
                tickValues={[-30, -20, -10, 0, 10]}
                style={{ font: "10px sans-serif" }}
              />
              <Axis
                scale="week"
                position="bottom"
                tickValues={[0, 2, 4, 8, 12]}
                tickFormat={(week) => (week === 0 ? "Base" : `W${week}`)}
                style={{ font: "10px sans-serif" }}
              />
            </LinearScale>
          </LinearScale>
        </Absolute>
        {compact ? (
          <>
            <Label
              x={leftA + 18}
              y={topA + paneHeight - 31}
              size={9}
              color={muted}
            >
              Change in symptom-burden index (points)
            </Label>
            <Label
              x={leftA + 18}
              y={topA + paneHeight - 16}
              size={9}
              color={muted}
            >
              Negative values indicate lower reported burden
            </Label>
          </>
        ) : (
          <Label
            x={leftA + 18}
            y={topA + paneHeight - 19}
            size={10}
            color={muted}
          >
            Change in symptom-burden index (points) · negative = lower reported
            burden
          </Label>
        )}
      </Pane>
      <Pane
        left={leftB}
        top={topB}
        width={paneWidth}
        height={paneHeight}
        title={
          compact
            ? "Baseline and week 12 (points)"
            : "Paired baseline → week 12 actual score (points)"
        }
      >
        <Absolute
          style={{
            left: leftB + 42,
            top: topB + 52,
            width: paneWidth - 60,
            height: plotHeight,
          }}
        >
          <LinearScale
            id="endpoint"
            domain={[0, 1]}
            range={[0, paneWidth - 60]}
            style={{ width: paneWidth - 60, height: plotHeight }}
          >
            <LinearScale id="score" domain={[30, 80]} range={[plotHeight, 0]}>
              <PairedSeries
                data={pairs}
                before="baseline"
                after="week12"
                beforeX={0}
                afterX={1}
                xScale="endpoint"
                yScale="score"
                defined={byArm("Candidate")}
                pointerEvents="none"
                style={{ stroke: candidate, strokeWidth: 1.5, opacity: 0.55 }}
              />
              <PairedSeries
                data={pairs}
                before="baseline"
                after="week12"
                beforeX={0}
                afterX={1}
                xScale="endpoint"
                yScale="score"
                defined={byArm("Placebo")}
                pointerEvents="none"
                style={{ stroke: placebo, strokeWidth: 1.5, opacity: 0.55 }}
              />
              <PointSeries
                data={pairs}
                x={() => 0}
                y="baseline"
                xScale="endpoint"
                yScale="score"
                pointerEvents="none"
                style={(row) => ({
                  radius: 3.2,
                  fill: row.arm === "Candidate" ? candidate : placebo,
                })}
              />
              <PointSeries
                data={pairs}
                x={() => 1}
                y="week12"
                xScale="endpoint"
                yScale="score"
                pointerEvents="none"
                style={(row) => ({
                  radius: 3.2,
                  fill: row.arm === "Candidate" ? candidate : placebo,
                })}
              />
              <Axis
                scale="score"
                position="left"
                tickValues={[30, 40, 50, 60, 70, 80]}
                style={{ font: "10px sans-serif" }}
              />
              <Axis
                scale="endpoint"
                position="bottom"
                tickValues={[0, 1]}
                tickFormat={(value) => (value === 0 ? "Baseline" : "Week 12")}
                style={{ font: "10px sans-serif" }}
              />
            </LinearScale>
          </LinearScale>
        </Absolute>
        {compact ? (
          <>
            <Label
              x={leftB + 18}
              y={topB + paneHeight - 31}
              size={9}
              color={muted}
            >
              Actual symptom-burden index (points)
            </Label>
            <Label
              x={leftB + 18}
              y={topB + paneHeight - 16}
              size={9}
              color={muted}
            >
              Missing week-12 pairs are not drawn
            </Label>
          </>
        ) : (
          <Label
            x={leftB + 18}
            y={topB + paneHeight - 19}
            size={10}
            color={muted}
          >
            Actual symptom-burden index (points) · missing week-12 pairs are not
            drawn
          </Label>
        )}
      </Pane>
      <Rectangle
        pointerEvents="none"
        style={{
          left: 20,
          top: compact ? 944 : 542,
          width: width - 40,
          height: compact ? 82 : 70,
          fill: "#f1f6f6",
          cornerRadius: 7,
        }}
      />
      <Label x={36} y={compact ? 966 : 566} size={11} weight={650}>
        {selectedPair
          ? `${selectedPair.participant} · ${selectedPair.arm}`
          : "Select a participant below"}
      </Label>
      {compact ? (
        <>
          <Label x={36} y={984} size={10} color={muted}>
            {selectedPair?.week12 === null
              ? "Week 12 not observed; no paired endpoint"
              : selectedPair
                ? `Baseline ${selectedPair.baseline} → week 12 ${selectedPair.week12} points`
                : "Scheduled visits and missingness are retained"}
          </Label>
          <Label x={36} y={1000} size={10} color={muted}>
            {selectedPair?.week12 === null
              ? "is drawn."
              : selectedPair
                ? `Supplied change ${selectedPair.change} points`
                : "in the table."}
          </Label>
          <Label x={24} y={1064} size={10} color={muted}>
            Invented teaching records only.
          </Label>
          <Label x={24} y={1080} size={10} color={muted}>
            No clinical inference or treatment claim.
          </Label>
          <Label x={24} y={1096} size={10} color={muted}>
            No baseline derivation or missing-data imputation.
          </Label>
        </>
      ) : (
        <>
          <Label x={36} y={588} size={11} color={muted}>
            {selectedPair
              ? selectedPair.week12 === null
                ? "Week 12 not observed · no paired endpoint is drawn."
                : `Baseline ${selectedPair.baseline} points → week 12 ${selectedPair.week12} points · supplied change ${selectedPair.change} points`
              : "The table and control retain scheduled visits and missingness."}
          </Label>
          <Label x={24} y={650} size={10} color={muted}>
            Invented teaching records only · no clinical inference, treatment
            claim, baseline derivation, or missing-data imputation.
          </Label>
        </>
      )}
    </Group>
  );
}

const mounts = new WeakMap<HTMLCanvasElement, PibblController>();
export default function mount(
  canvas: HTMLCanvasElement,
  fixture: Fixture = {},
): PibblController {
  mounts.get(canvas)?.dispose();
  const selectedParticipant =
      fixture.selectedParticipant ?? signal<string | null>(null),
    showTracks = fixture.showTracks ?? signal(true);
  const oldHeight = canvas.style.height,
    oldMinHeight = canvas.style.minHeight,
    host = canvas.parentElement,
    oldOverflow = host?.style.overflow,
    oldDisplay = host?.style.display;
  canvas.style.height =
    canvas.clientWidth > 0 && canvas.clientWidth < 700 ? "1160px" : "720px";
  canvas.style.minHeight = canvas.style.height;
  if (host) {
    host.style.overflow = "auto";
    host.style.display = "block";
  }
  const controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;gap:18px;flex-wrap:wrap;align-items:center;padding:12px 24px;background:white;color:#203441;font:12px system-ui";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Inspect participant");
  const placeholder = new Option("Select a participant", "");
  placeholder.disabled = true;
  select.append(placeholder);
  for (const pair of pairs)
    select.append(
      new Option(`${pair.participant} · ${pair.arm}`, pair.participant),
    );
  select.value = selectedParticipant.get() ?? "";
  select.onchange = () => selectedParticipant.set(select.value || null);
  const tracks = document.createElement("input");
  tracks.type = "checkbox";
  tracks.checked = showTracks.get();
  tracks.onchange = () => showTracks.set(tracks.checked);
  const trackLabel = document.createElement("label");
  trackLabel.append(tracks, " Show individual trajectories");
  controls.append(select, trackLabel);
  const details = document.createElement("details");
  details.style.cssText =
    "padding:14px 24px;background:white;color:#203441;font:12px system-ui;overflow-x:auto";
  const summary = document.createElement("summary");
  summary.textContent = "View scheduled visits and supplied participant scores";
  const table = document.createElement("table");
  table.style.cssText =
    "min-width:760px;width:100%;border-collapse:collapse;margin-top:12px;font-variant-numeric:tabular-nums";
  const caption = document.createElement("caption");
  caption.textContent =
    "Synthetic phase-II participant records. “Not observed” remains missing; it is not replaced or imputed.";
  table.append(caption);
  const header = table.createTHead().insertRow();
  for (const title of [
    "Participant",
    "Arm",
    "Baseline (points)",
    "Week 2 (points)",
    "Week 4 (points)",
    "Week 8 (points)",
    "Week 12 (points)",
  ]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = title;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const pair of pairs) {
    const row = body.insertRow();
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = pair.participant;
    row.append(name);
    row.insertCell().textContent = pair.arm;
    for (const week of [0, 2, 4, 8, 12]) {
      const visit = visits.find(
        (item) => item.participant === pair.participant && item.week === week,
      )!;
      row.insertCell().textContent =
        visit.actual === null ? "Not observed" : String(visit.actual);
    }
  }
  for (const cell of table.querySelectorAll("th,td"))
    (cell as HTMLElement).style.cssText =
      "padding:8px 10px;border-bottom:1px solid #e7edef;text-align:left;white-space:nowrap";
  details.append(summary, table);
  canvas.after(controls, details);
  const restore = () => {
    canvas.style.height = oldHeight;
    canvas.style.minHeight = oldMinHeight;
    if (host) {
      host.style.overflow = oldOverflow ?? "";
      host.style.display = oldDisplay ?? "";
    }
  };
  try {
    const controller = pibbl(
      canvas,
      <Scene
        canvas={canvas}
        fixture={{ ...fixture, selectedParticipant, showTracks }}
      />,
      { viewport: "responsive" },
    );
    let disposed = false;
    const owned: PibblController = {
      dispose() {
        if (disposed) return;
        disposed = true;
        mounts.delete(canvas);
        try {
          controller.dispose();
        } finally {
          controls.remove();
          details.remove();
          restore();
        }
      },
    };
    mounts.set(canvas, owned);
    return owned;
  } catch (error) {
    controls.remove();
    details.remove();
    restore();
    throw error;
  }
}
