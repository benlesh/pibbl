import { Clip, Group, Overlay, pibbl, signal } from "@pibbl/core";
import { LinearScale, LineSeries } from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { createLineAttributionInspector } from "./capture";
import { testRuntime } from "../../packages/core/test/features/viz/support/runtime";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("connects a decorative segment to captured data, scales, transform and clip after successful rendering only", () => {
  runtime = testRuntime();
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 240;
  document.body.append(canvas);
  const inspector = createLineAttributionInspector(canvas);
  const rows = signal([
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 10, y: 10 },
  ]);
  const fail = signal(false);
  let accessorCalls = 0;
  const clip = new Path2D();
  clip.rect(0, 0, 100, 100);
  function Bomb() {
    if (fail.get()) throw new Error("controlled render failure");
    return null;
  }
  function App() {
    return (
      <Group style={{ translateX: 20, translateY: 30 }}>
        <Overlay style={{ width: 200, height: 100 }}>
          <LinearScale
            id="x"
            domain={[0, 10]}
            range="width"
            style={{ width: "100%", height: "100%" }}
          >
            <LinearScale id="y" domain={[0, 10]} range="height" reverse>
              <Clip style={{ d: clip }}>
                <LineSeries
                  data={rows}
                  x={(row) => {
                    accessorCalls++;
                    return row.x;
                  }}
                  y="y"
                  xScale="x"
                  yScale="y"
                  pointerEvents="none"
                  style={{ stroke: "#2563eb", strokeWidth: 4 }}
                />
              </Clip>
            </LinearScale>
          </LinearScale>
        </Overlay>
        <Bomb />
      </Group>
    );
  }
  const app = pibbl(canvas, <App />, { pixelRatio: 1 });
  try {
    runtime.flush();
    const first = inspector.snapshot();
    expect(first.status).toBe("ready");
    expect(first.evidence).toMatchObject({
      queryCoordinates: "root-logical",
      renderTiming: "last-successful-render-may-lag-application",
      capturedPositions: "line-local",
      transforms: "local-to-root-logical",
      sourceReferences: "live-not-snapshot",
      coverage: "geometry-not-pixels-or-event-target",
      clipGeometry: "opaque-path-use-inside-outside-probes",
    });
    expect(first.lines).toHaveLength(1);
    expect(first.lines[0].xScale).toMatchObject({
      id: "x",
      type: "linear",
      domain: [0, 10],
      range: [0, 200],
    });
    expect(first.lines[0].yScale.range).toEqual([100, 0]);
    expect(first.lines[0].transform).toEqual([1, 0, 0, 1, 20, 30]);
    expect(first.lines[0].clips).toHaveLength(1);
    expect(inspector.segmentAt({ x: 70, y: 105 })).toMatchObject({
      status: "segment",
      sourceIndices: [0, 1],
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 },
    });
    expect(inspector.segmentAt({ x: 170, y: 55 }).status).toBe("clip-excluded");
    expect(accessorCalls).toBe(2); // Inspection does not rerun accessors.
    rows.get()[1].y = 5; // Original object is mutable; captured numbers must stay 10.
    const retained = inspector.segmentAt({ x: 70, y: 105 });
    if (retained.status !== "segment")
      throw new Error("Expected retained segment");
    expect(retained.to.y).toBe(10);
    expect(retained.sourceReferenceSemantics).toBe(
      "live-application-references-not-captured-values",
    );
    expect(retained.toSourceReference).toMatchObject({ id: "b", y: 5 });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fail.set(true);
    expect(() => runtime.flush()).toThrow(/controlled render failure/);
    error.mockRestore();
    const failed = inspector.snapshot();
    expect(failed.status).toBe("render-failed");
    expect(failed.generation).toBe(first.generation);
    expect(inspector.segmentAt({ x: 70, y: 105 }).status).toBe("unavailable");
    fail.set(false);
    rows.set([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 10, y: 5 },
    ]);
    pibbl(canvas, <App />); // Failed traversal detaches component consumers; explicitly retry the root.
    runtime.flush();
    expect(inspector.snapshot().generation).toBeGreaterThan(first.generation!);
    const repaired = inspector.segmentAt({ x: 70, y: 117.5 });
    if (repaired.status !== "segment")
      throw new Error("Expected repaired segment");
    expect(repaired.to.y).toBe(5);
  } finally {
    app.dispose();
  }
  expect(inspector.snapshot()).toMatchObject({ status: "disposed", lines: [] });
  inspector.dispose();
  inspector.dispose();
});

it("reports ambiguous contributing segments at a shared vertex", () => {
  runtime = testRuntime();
  const canvas = runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[0, 200]}>
      <LinearScale id="y" domain={[0, 10]} range={[100, 0]}>
        <LineSeries
          data={[
            { x: 0, y: 0 },
            { x: 5, y: 5 },
            { x: 10, y: 10 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          pointerEvents="none"
          style={{ stroke: "blue", strokeWidth: 4 }}
        />
      </LinearScale>
    </LinearScale>,
  );
  const inspector = createLineAttributionInspector(canvas);
  runtime.flush();
  expect(inspector.segmentAt({ x: 100, y: 50 })).toMatchObject({
    status: "ambiguous",
    candidateSourceIndices: [
      [0, 1],
      [1, 2],
    ],
  });
  expect(inspector.segmentAt({ x: 50, y: 75 }).status).toBe("segment");
  inspector.dispose();
});

it("excludes line geometry outside the committed root surface", () => {
  runtime = testRuntime();
  const canvas = runtime.mount(
    <LinearScale id="x" domain={[0, 10]} range={[-100, 100]}>
      <LinearScale id="y" domain={[0, 10]} range={[50, 50]}>
        <LineSeries
          data={[
            { x: 0, y: 0 },
            { x: 10, y: 10 },
          ]}
          x="x"
          y="y"
          xScale="x"
          yScale="y"
          pointerEvents="none"
          style={{ stroke: "blue", strokeWidth: 4 }}
        />
      </LinearScale>
    </LinearScale>,
  );
  const inspector = createLineAttributionInspector(canvas);
  runtime.flush();
  expect(inspector.segmentAt({ x: -50, y: 50 }).status).toBe(
    "surface-excluded",
  );
  expect(inspector.segmentAt({ x: 50, y: 50 }).status).toBe("segment");
  inspector.dispose();
});
