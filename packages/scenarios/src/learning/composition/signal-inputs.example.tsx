import {
  batch,
  pibbl,
  resolveSignalValue,
  useComputed,
  useConst,
  useReaction,
  useSignal,
  Line,
  Rectangle,
  Text,
  type PibblController,
  type PibblNode,
  type SignalValue,
} from "@pibbl/core";

const signalInputsExternalResource = {
  cleanupRuns: 0,
  lastPulse: 0,
  reactionRuns: 0,
};

interface LineSeriesProps {
  readonly data: SignalValue<readonly number[]>;
  readonly domain: SignalValue<readonly [number, number]>;
}

function LineSeries(props: LineSeriesProps): PibblNode {
  const data = resolveSignalValue(props.data);
  const [minimum, maximum] = resolveSignalValue(props.domain);
  const range = Math.max(1, maximum - minimum);
  const points = data.map((value, index) => [
    390 + index * 56,
    286 - ((value - minimum) / range) * 126,
  ] as [number, number]);
  return [
    <Line
      style={{
        coords: points,
        stroke: "#f59e0b",
        strokeWidth: 5,
      }}
    />,
    ...points.map(([x, y], index) => (
      <Rectangle
        key={`point-${index}`}
        style={{ left: x - 5, top: y - 5, width: 10, height: 10, fill: "#f8fafc" }}
      />
    )),
  ];
}

function SignalInputsStudy(): PibblNode {
  const x = useSignal(72);
  const color = useSignal("#2563eb");
  const label = useSignal("Current");
  const data = useSignal<readonly number[]>([12, 28, 18, 42, 32]);
  const reactionPulse = useSignal(0);
  const domain = useComputed(
    () => [0, Math.max(...data.get())] as const,
    undefined,
    {
      equals: (previous, next) =>
        previous[0] === next[0] && previous[1] === next[1],
    },
  );

  useConst(() => {
    signalInputsExternalResource.cleanupRuns = 0;
    signalInputsExternalResource.lastPulse = 0;
    signalInputsExternalResource.reactionRuns = 0;
  });
  useReaction(() => {
    signalInputsExternalResource.lastPulse = reactionPulse.get();
    signalInputsExternalResource.reactionRuns += 1;
    return () => {
      signalInputsExternalResource.cleanupRuns += 1;
    };
  });

  return [
    <Rectangle style={{ width: 720, height: 420, fill: "#0f172a" }} />,
    <Text style={{ left: 42, top: 44, fill: "#f8fafc", font: "900 24px sans-serif" }}>
      SIGNAL INPUTS BELONG TO RECEIVERS
    </Text>,
    <Rectangle
      style={{
        left: x,
        top: 104,
        width: 240,
        height: 126,
        fill: color,
        stroke: "#f8fafc",
        strokeWidth: 4,
        cursor: "pointer",
      }}
      onClick={() => {
        batch(() => {
          x.update((value) => (value === 72 ? 108 : 72));
          color.update((value) => value === "#2563eb" ? "#7c3aed" : "#2563eb");
          label.update((value) => value === "Current" ? "Updated" : "Current");
          data.update((values) => values.map((value, index) => value + index + 1));
        });
      }}
    />,
    <Text
      pointerEvents="none"
      style={{ left: 192, top: 158, fill: "#ffffff", font: "800 22px sans-serif", textAlign: "center" }}
    >
      {label}
    </Text>,
    <Text
      pointerEvents="none"
      style={{ left: 192, top: 194, fill: "#dbeafe", font: "600 12px monospace", textAlign: "center" }}
    >
      CLICK: ONE BATCH
    </Text>,
    <LineSeries data={data} domain={domain} />,
    <Rectangle
      style={{ left: 72, top: 286, width: 240, height: 62, fill: "#1e293b", cursor: "pointer" }}
      onClick={() => reactionPulse.update((value) => value + 1)}
    />,
    <Text
      pointerEvents="none"
      style={{ left: 192, top: 316, fill: "#a7f3d0", font: "700 12px monospace", textAlign: "center" }}
    >
      REACTION-ONLY UPDATE
    </Text>,
  ];
}

export default function mount(canvas: HTMLCanvasElement): PibblController {
  return pibbl(canvas, <SignalInputsStudy />);
}
