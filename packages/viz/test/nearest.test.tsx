import {
  Scale,
  useScale,
  nearestDomainValue,
  nearestPoint,
  type ResolvedLinearScale,
} from "@crc/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
it("selects original data by local distance with stable ties and inclusive limits", () => {
  runtime = testRuntime();
  let x!: ResolvedLinearScale, y!: ResolvedLinearScale;
  function Read() {
    x = useScale("x").get();
    y = useScale("y").get();
    return null;
  }
  runtime.mount(
    <Scale id="x" type="linear" domain={[0, 10]} range={[0, 200]}>
      <Scale id="y" type="linear" domain={[0, 10]} range={[100, 0]}>
        <Read />
      </Scale>
    </Scale>,
  );
  runtime.flush();
  const data = [
    { x: 2, y: 3 },
    { x: 4, y: null },
    { x: 8, y: 9 },
  ];
  const options = { x: "x", y: "y", xScale: x, yScale: y } as const;
  expect(nearestDomainValue([2, 8], 100, x)).toBe(2);
  const found = nearestPoint(data, { x: 43, y: 74 }, options);
  expect(found).toEqual({
    datum: data[0],
    index: 0,
    x: 40,
    y: 70,
    distance: 5,
  });
  expect(found?.datum).toBe(data[0]);
  expect(
    nearestPoint(data, { x: 43, y: 74 }, { ...options, maxDistance: 5 }),
  ).toEqual(found);
  expect(
    nearestPoint(data, { x: 43, y: 74 }, { ...options, maxDistance: 4 }),
  ).toBeUndefined();
  expect(nearestPoint(data, { x: 160, y: 10 }, options)?.index).toBe(2);
  expect(nearestDomainValue([], 1, x)).toBeUndefined();
  expect(
    nearestPoint<(typeof data)[number]>([], { x: 0, y: 0 }, options),
  ).toBeUndefined();
  expect(runtime.pending).toBe(0);
});
