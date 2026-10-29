import { Group, Rectangle, signal } from "@pibbl/core";
import * as Viz from "@pibbl/core/viz";
import { afterEach, expect, it, vi } from "vitest";
import { testRuntime } from "./support/runtime.js";

let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

function press(canvas: HTMLCanvasElement, x: number, y: number) {
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
    }),
  );
}

it("exports trajectories and keeps each interleaved participant in encounter order", () => {
  expect(Viz).toHaveProperty("TrajectorySeries");
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  const rows = signal([
    { id: "A", day: 0, value: 20 },
    { id: "B", day: 0, value: 50 },
    { id: "A", day: 7, value: null }, // Ends only A's current run.
    { id: "B", day: 7, value: 60 },
    { id: "A", day: 14, value: 30 },
    { id: "B", day: 14, value: 70 },
  ]);
  runtime.mount(
    <Viz.LinearScale id="day" domain={[0, 14]} range={[0, 140]}>
      <Viz.LinearScale id="value" domain={[0, 100]} range={[100, 0]}>
        <Viz.TrajectorySeries
          data={rows}
          group="id"
          x="day"
          y="value"
          xScale="day"
          yScale="value"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  runtime.flush();
  // A never bridges its missing day-7 visit; B remains one source-ordered run.
  expect(moves.mock.calls).toContainEqual([0, 50]);
  expect(lines.mock.calls).toContainEqual([70, 40]);
  expect(lines.mock.calls).toContainEqual([140, 30]);
  expect(lines.mock.calls).not.toContainEqual([140, 70]);
  rows.set([
    { id: "A", day: 0, value: 20 },
    { id: "A", day: 14, value: 30 },
  ]);
  moves.mockClear();
  lines.mockClear();
  runtime.flush();
  expect(moves).toHaveBeenCalled();
  expect(lines.mock.calls).toContainEqual([140, 70]);
});

it("omits null groups and keeps string and numeric groups in non-monotonic encounter order", () => {
  runtime = testRuntime();
  const moves = vi.spyOn(Path2D.prototype, "moveTo");
  const lines = vi.spyOn(Path2D.prototype, "lineTo");
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 10]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 100]} range={[100, 0]}>
        <Viz.TrajectorySeries
          data={[
            { id: "a", x: 10, y: 10 },
            { id: 1, x: 10, y: 90 },
            { id: null, x: 5, y: 50 },
            { id: "a", x: 0, y: 20 },
            { id: 1, x: 0, y: 80 },
          ]}
          group="id"
          x="x"
          y="y"
          xScale="x"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  runtime.flush();
  expect(moves.mock.calls).toContainEqual([100, 90]);
  expect(lines.mock.calls).toContainEqual([0, 80]);
  expect(moves.mock.calls).toContainEqual([100, 10]);
  expect(lines.mock.calls).toContainEqual([0, 20]);
});

it("uses group identity to split a defined-false visit without reading its coordinates", () => {
  runtime = testRuntime();
  const x = vi.fn((row: { day: number }) => {
    if (row.day === 1) throw new Error("excluded coordinate was read");
    return row.day;
  });
  runtime.mount(
    <Viz.LinearScale id="day" domain={[0, 2]} range={[0, 100]}>
      <Viz.LinearScale id="value" domain={[0, 2]} range={[100, 0]}>
        <Viz.TrajectorySeries
          data={[
            { id: "a", day: 0, value: 0 },
            { id: "a", day: 1, value: 1 },
            { id: "a", day: 2, value: 2 },
          ]}
          group="id"
          x={x}
          y="value"
          xScale="day"
          yScale="value"
          defined={(_, index) => index !== 1}
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  runtime.flush();
  expect(x).not.toHaveBeenCalledWith(
    expect.objectContaining({ day: 1 }),
    expect.anything(),
    expect.anything(),
  );
});

it("rejects non-finite numeric group identities and blocks accessor hooks and writes", () => {
  runtime = testRuntime();
  const target = signal(0);
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 1]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
        <Viz.TrajectorySeries
          data={[{ id: Number.NaN, x: 0, y: 0 }]}
          group="id"
          x="x"
          y="y"
          xScale="x"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/group must be a string or number/);
  runtime.dispose();
  runtime = testRuntime();
  runtime.mount(
    <Viz.LinearScale id="x" domain={[0, 1]} range={[0, 100]}>
      <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
        <Viz.TrajectorySeries
          data={[{ id: "a", x: 0, y: 0 }]}
          group="id"
          x={() => {
            target.set(1);
            return 0;
          }}
          y="y"
          xScale="x"
          yScale="y"
        />
      </Viz.LinearScale>
    </Viz.LinearScale>,
  );
  expect(() => runtime.flush()).toThrow(/write|render|evaluation/i);
});

it("updates shallow style signals and retains ordinary transformed path events", () => {
  runtime = testRuntime();
  const strokeWidth = signal(2);
  const widths: number[] = [];
  vi.spyOn(CanvasRenderingContext2D.prototype, "stroke").mockImplementation(
    function (this: CanvasRenderingContext2D) {
      widths.push(this.lineWidth);
    },
  );
  const events: string[] = [];
  const canvas = runtime.mount(
    <Group style={{ translateX: 20 }}>
      <Rectangle
        style={{ width: 160, height: 120, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <Viz.LinearScale id="x" domain={[0, 1]} range={[0, 100]}>
        <Viz.LinearScale id="y" domain={[0, 1]} range={[100, 0]}>
          <Viz.TrajectorySeries
            data={[
              { id: "a", x: 0, y: 0 },
              { id: "a", x: 1, y: 1 },
            ]}
            group="id"
            x="x"
            y="y"
            xScale="x"
            yScale="y"
            style={{ strokeWidth, lineInteractionWidth: 12 }}
            onPointerDown={() => events.push("trajectory")}
          />
        </Viz.LinearScale>
      </Viz.LinearScale>
    </Group>,
  );
  runtime.flush();
  expect(widths).toContain(2);
  press(canvas, 70, 50); // Local (50, 50), then the enclosing 20px transform.
  expect(events).toEqual(["trajectory"]);
  strokeWidth.set(6);
  runtime.flush();
  expect(widths).toContain(6);
});
