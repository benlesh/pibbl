import { Group, Wedge, signal } from "@crc/core";
import * as viz from "@crc/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());

it("partitions source values into keyed Canvas wedges with exact sector events and scheduled updates", () => {
  expect(viz).toHaveProperty("pieSlices");
  const data = [
    { id: "a", amount: 1 },
    { id: "b", amount: 3 },
  ];
  const slices = viz.pieSlices(data, { value: "amount", keyBy: "id" });
  expect(slices.map((s) => s.key)).toEqual(["a", "b"]);
  expect(slices[0].datum).toBe(data[0]);
  expect(slices[0].fraction).toBe(0.25);
  expect(slices[0].startAngle).toBe(-Math.PI / 2);
  expect(slices[0].endAngle).toBe(0);
  expect(slices[1].endAngle).toBe(Math.PI * 1.5);
  runtime = testRuntime();
  const rows = signal(data);
  const hits: string[] = [];
  function Scene() {
    return (
      <Group>
        {viz
          .pieSlices(rows.get(), { value: "amount", keyBy: "id" })
          .map((slice) => (
            <Wedge
              key={slice.key}
              style={{
                cx: 100,
                cy: 100,
                radius: 80,
                startAngle: slice.startAngle,
                endAngle: slice.endAngle,
                fill: "red",
              }}
              onPointerDown={() => hits.push(slice.key)}
            />
          ))}
      </Group>
    );
  }
  const canvas = runtime.mount(<Scene />);
  runtime.flush();
  const rect = canvas.getBoundingClientRect();
  const hit = (x: number, y: number) =>
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + x,
        clientY: rect.top + y,
        bubbles: true,
      }),
    );
  hit(130, 70);
  hit(70, 130);
  hit(175, 25);
  expect(hits).toEqual(["a", "b"]); // Last point is inside the bounds but outside the sector.
  rows.set([...data].reverse());
  expect(runtime.pending).toBe(1);
  runtime.flush();
  hit(130, 70);
  expect(hits).toEqual(["a", "b", "b"]);
});

it("keeps missing and zero rows empty and rejects misleading values or duplicate identities", () => {
  expect(viz).toHaveProperty("pieSlices");
  const empty = viz.pieSlices([0, null, undefined], {
    value: (d: number | null | undefined) => d,
  });
  expect(
    empty.map((s) => [s.value, s.fraction, s.startAngle, s.endAngle]),
  ).toEqual(
    Array.from({ length: 3 }, () => [0, 0, -Math.PI / 2, -Math.PI / 2]),
  );
  expect(viz.pieSlices([], { value: (d: number) => d })).toEqual([]);
  for (const value of [-1, NaN, Infinity])
    expect(() =>
      viz.pieSlices([value], { value: (d: number | null | undefined) => d }),
    ).toThrow(/pieSlices.*value/);
  expect(() =>
    viz.pieSlices([1, 2], {
      value: (d: number | null | undefined) => d,
      keyBy: () => "same",
    }),
  ).toThrow(/duplicate key/);
});
