import {
  Clip,
  Group,
  Rectangle,
  batch,
  pibbl,
  recordFrames,
  signal,
  type PibblFrameRecording,
  type PibblFrameRecordingSession,
} from "@pibbl/core";
import { LinearScale, LineSeries, defineSeries } from "@pibbl/core/viz";
import {
  nearestRecordedX,
  useNumericInspection,
  type NumericInspectionRef,
} from "@pibbl/core/viz/inspection";

type Row = { id: string; x: number; y: number };
const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
const output = document.querySelector<HTMLElement>("[data-testid=evidence]")!;
const width = 640,
  height = 360,
  plotWidth = 500,
  plotHeight = 250;
const initialRows = (): Row[] => [
  { id: "start", x: 0, y: 10 },
  { id: "middle", x: 5, y: 20 },
  { id: "end", x: 10, y: 30 },
];
const data = signal<readonly Row[]>(initialRows());
const domain = signal<readonly [number, number]>([0, 10]);
const clipEnd = signal(plotWidth);
const failRender = signal(false);
const series = defineSeries({ data, x: "x", y: "y" });
const inspections = new Map<
  number,
  {
    id: string;
    domainY: number;
    anchorRoot: { x: number; y: number };
    anchorInsideClips: boolean;
    domain: readonly [number, number];
    clipEnd: number;
  }
>();
const completions: Array<{ status: string; generation: number }> = [];
const capturedFrames: Array<{
  timestamp: number;
  width: number;
  height: number;
  renderGeneration: number;
}> = [];
const completionWaiters: Array<{
  after: number;
  resolve: (value: (typeof completions)[number]) => void;
  reject: (error: Error) => void;
}> = [];
const frameWaiters = new Map<
  number,
  Array<(value: (typeof capturedFrames)[number]) => void>
>();
let inspection: NumericInspectionRef<Row> | undefined;
let session: PibblFrameRecordingSession | undefined;
let recording: PibblFrameRecording | undefined;
let recordingStatus: "idle" | "recording" | "complete" | "failed" = "idle";
let failureMessage: string | null = null;
let latestCompletion: (typeof completions)[number] | undefined;

function Chart() {
  inspection = useNumericInspection(series);
  const path = new Path2D();
  path.rect(0, 0, clipEnd.get(), plotHeight);
  return (
    <>
      <Rectangle
        pointerEvents="none"
        style={{ width, height, fill: "#f4f7fb" }}
      />
      <Group style={{ translateX: 60, translateY: 50 }}>
        <LinearScale
          id="time"
          domain={domain}
          range={[0, plotWidth]}
          style={{ width: plotWidth, height: plotHeight }}
        >
          <LinearScale
            id="value"
            domain={[0, 40]}
            range={[0, plotHeight]}
            reverse
          >
            <Clip style={{ d: path }}>
              <LineSeries
                {...series}
                xScale="time"
                yScale="value"
                pointerEvents="none"
                style={{ stroke: "#0000ff", strokeWidth: 4 }}
                inspection={inspection}
              />
            </Clip>
          </LinearScale>
        </LinearScale>
      </Group>
      <ControlledFailure />
    </>
  );
}

function ControlledFailure() {
  if (failRender.get())
    throw new Error("controlled render failure after line paint");
  return null;
}

const root = pibbl(canvas, <Chart />, {
  viewport: { width, height },
  pixelRatio: 1,
});

function notifyCompletion(completion: { status: string; generation: number }) {
  completions.push(completion);
  latestCompletion = completion;
  if (completion.status === "committed") {
    const rendered = inspection?.rendered();
    const hit = rendered && nearestRecordedX(rendered, { domainX: 5 });
    if (hit) {
      inspections.set(completion.generation, {
        id: hit.datum.id,
        domainY: hit.domainY,
        anchorRoot: hit.anchorRoot,
        anchorInsideClips: rendered!.anchorInsideClips(hit.anchorLocal),
        domain: [...domain.get()] as [number, number],
        clipEnd: clipEnd.get(),
      });
    }
  } else {
    failureMessage = "Pibbl render failed; partial paint was not recorded.";
    recordingStatus = "failed";
  }
  for (let index = completionWaiters.length - 1; index >= 0; index--) {
    const waiter = completionWaiters[index];
    if (completion.generation > waiter.after) {
      completionWaiters.splice(index, 1);
      waiter.resolve(completion);
    }
  }
  publish();
}

function notifyFrame(frame: (typeof capturedFrames)[number]) {
  capturedFrames.push(frame);
  for (const resolve of frameWaiters.get(frame.renderGeneration) ?? [])
    resolve(frame);
  frameWaiters.delete(frame.renderGeneration);
  publish();
}

function bluePixelCount(
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
): number {
  let count = 0;
  for (let py = Math.max(0, Math.round(y) - 3); py <= Math.round(y) + 3; py++) {
    for (
      let px = Math.max(0, Math.round(x) - 3);
      px <= Math.round(x) + 3;
      px++
    ) {
      if (px >= width || py >= height) continue;
      const offset = (py * width + px) * 4;
      if (pixels[offset + 2] > pixels[offset] + 40) count++;
    }
  }
  return count;
}

async function frameEvidence() {
  if (!recording) return [];
  const results = await Promise.all(
    recording.frames.map(async (_, index) => {
      const frame = await recording!.readFrame(index);
      const semantic = inspections.get(frame.renderGeneration) ?? null;
      const [domainMin, domainMax] = semantic?.domain ?? domain.get();
      const independentAnchor = semantic
        ? {
            x: 60 + ((5 - domainMin) / (domainMax - domainMin)) * plotWidth,
            y: 50 + (1 - semantic.domainY / 40) * plotHeight,
          }
        : null;
      return {
        index,
        timestamp: frame.timestamp,
        renderGeneration: frame.renderGeneration,
        width: frame.width,
        height: frame.height,
        semantic,
        independentAnchor,
        blueNearSemanticAnchor: semantic
          ? bluePixelCount(frame.data, semantic.anchorRoot.x, semantic.anchorRoot.y)
          : null,
        blueAtIndependentAnchor: independentAnchor
          ? bluePixelCount(frame.data, independentAnchor.x, independentAnchor.y)
          : null,
        blueAtIndependentUpdatedAnchor: bluePixelCount(frame.data, 310, 112.5),
        blueAtIndependentInitialAnchor: bluePixelCount(frame.data, 310, 175),
      };
    }),
  );
  return results;
}

async function publish() {
  const frames = await frameEvidence();
  output.textContent = JSON.stringify(
    {
      schema: "pibbl-render-completion-evidence/1",
      application: {
        rows: structuredClone(data.get()),
        domain: [...domain.get()],
        clipEnd: clipEnd.get(),
      },
      committed: latestCompletion ?? null,
      semanticByGeneration: Object.fromEntries(inspections),
      completionEvents: completions,
      capturedFrames,
      recordingStatus,
      failureMessage,
      frames,
    },
    null,
    2,
  );
}

function waitForCompletion(after: number) {
  const existing = completions.find((item) => item.generation > after);
  if (existing) return Promise.resolve(existing);
  return new Promise<(typeof completions)[number]>((resolve, reject) => {
    const waiter = { after, resolve, reject };
    completionWaiters.push(waiter);
    setTimeout(() => {
      const index = completionWaiters.indexOf(waiter);
      if (index >= 0) {
        completionWaiters.splice(index, 1);
        reject(new Error("No root render completion arrived."));
      }
    }, 5000);
  });
}

function waitForCapturedFrame(generation: number) {
  const existing = capturedFrames.find(
    (frame) => frame.renderGeneration === generation,
  );
  if (existing) return Promise.resolve(existing);
  return new Promise<(typeof capturedFrames)[number]>((resolve, reject) => {
    const waiters = frameWaiters.get(generation) ?? [];
    waiters.push(resolve);
    frameWaiters.set(generation, waiters);
    setTimeout(() => {
      const pending = frameWaiters.get(generation);
      if (!pending?.includes(resolve)) return;
      frameWaiters.set(
        generation,
        pending.filter((item) => item !== resolve),
      );
      reject(new Error(`No pixel frame was captured for generation ${generation}.`));
    }, 5000);
  });
}

async function start() {
  recording?.dispose();
  recording = undefined;
  completions.length = 0;
  capturedFrames.length = 0;
  inspections.clear();
  failureMessage = null;
  recordingStatus = "recording";
  session = recordFrames(canvas, {
    duration: 10000,
    frameRate: 30,
    onRenderComplete: notifyCompletion,
    onFrameCaptured: notifyFrame,
  });
  await session.ready;
  await publish();
}

async function stop() {
  if (!session) return;
  session.stop();
  try {
    recording = await session.finished;
    recordingStatus = "complete";
  } catch (error) {
    recordingStatus = "failed";
    failureMessage ??= String(error);
  }
  await publish();
}

const actions = {
  async start() {
    await start();
  },
  update() {
    data.set(
      data.get().map((row) =>
        row.id === "middle" ? { ...row, y: 30 } : row,
      ),
    );
  },
  zoom() {
    domain.set([2.5, 7.5]);
  },
  pan() {
    domain.set([3.5, 8.5]);
  },
  clip() {
    clipEnd.set(100);
  },
  fail() {
    failRender.set(true);
  },
  repair() {
    failRender.set(false);
  },
  reset() {
    batch(() => {
      data.set(initialRows());
      domain.set([0, 10]);
      clipEnd.set(plotWidth);
      failRender.set(false);
    });
    failureMessage = null;
  },
  async stop() {
    await stop();
  },
};

for (const [name, action] of Object.entries(actions)) {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-action="${name}"]`,
  );
  if (button) button.onclick = () => void action();
}

window.addEventListener("pagehide", () => {
  session?.cancel();
  recording?.dispose();
  root.dispose();
});

Object.assign(window, {
  renderCompletionDemo: {
    actions,
    state: () => ({
      application: {
        rows: structuredClone(data.get()),
        domain: [...domain.get()],
        clipEnd: clipEnd.get(),
      },
      completions: [...completions],
      capturedFrames: [...capturedFrames],
      semanticByGeneration: Object.fromEntries(inspections),
      recordingStatus,
      failureMessage,
    }),
    waitForCompletion,
    waitForCapturedFrame,
    async readFrames() {
      return frameEvidence();
    },
    async dispose() {
      session?.cancel();
      recording?.dispose();
      root.dispose();
    },
  },
});

void publish();
