import {
  Clip,
  Group,
  Rectangle,
  signal,
  useReaction,
  useSignal,
} from "@pibbl/core";
import { AnchoredLayout, type AnchoredItem } from "@pibbl/core/viz";
import { afterEach, expect, it } from "vitest";
import { testRuntime } from "./support/runtime.js";
let runtime: ReturnType<typeof testRuntime>;
afterEach(() => runtime?.dispose());
const item = { key: "a", anchor: { x: 20, y: 30 }, width: 40, height: 20 };

it.each([
  ["negative width", { ...item, width: -1 }],
  ["infinite height", { ...item, height: Infinity }],
  ["invalid anchor", { ...item, anchor: { x: NaN, y: 0 } }],
  ["negative radius", { ...item, anchorRadius: -1 }],
  [
    "overflow",
    {
      ...item,
      anchor: { x: Number.MAX_VALUE, y: 0 },
      anchorRadius: Number.MAX_VALUE,
    },
  ],
] as const)("rejects %s before invoking user content", (_name, invalid) => {
  runtime = testRuntime();
  let calls = 0;
  runtime.mount(
    <AnchoredLayout items={[invalid]}>
      {() => {
        calls++;
        return null;
      }}
    </AnchoredLayout>,
  );
  expect(() => runtime.flush()).toThrow(/AnchoredLayout/);
  expect(calls).toBe(0);
});
it("rejects normalized duplicate keys before rendering either box", () => {
  runtime = testRuntime();
  let calls = 0;
  runtime.mount(
    <AnchoredLayout
      items={[
        { ...item, key: 1 },
        { ...item, key: "1" },
      ]}
    >
      {() => {
        calls++;
        return null;
      }}
    </AnchoredLayout>,
  );
  expect(() => runtime.flush()).toThrow(/duplicate key/);
  expect(calls).toBe(0);
});
it.each(["throw", "hook", "write", "promise"] as const)(
  "releases sources and allocation after a callback %s failure",
  (kind) => {
    runtime = testRuntime();
    const source = signal(1);
    runtime.mount(
      <AnchoredLayout items={[item]}>
        {() => {
          source.get();
          if (kind === "throw") throw new Error("callback failure");
          if (kind === "hook") useSignal(0);
          if (kind === "write") source.set(1);
          if (kind === "promise") return Promise.resolve(null) as never;
          return null;
        }}
      </AnchoredLayout>,
    );
    expect(() => runtime.flush()).toThrow();
    source.set(2);
    expect(runtime.pending).toBe(0);
  },
);
it("detaches changing callback branches and removes keyed child effects", () => {
  runtime = testRuntime();
  const left = signal(1),
    right = signal(2),
    branch = signal(true);
  const items = signal<readonly AnchoredItem[]>([item]);
  let value = 0,
    releases = 0;
  function Child() {
    useReaction(
      () => () => {
        releases++;
      },
      [],
    );
    return null;
  }
  runtime.mount(
    <AnchoredLayout items={items}>
      {() => {
        value = branch.get() ? left.get() : right.get();
        return <Child />;
      }}
    </AnchoredLayout>,
  );
  runtime.flush();
  expect(value).toBe(1);
  branch.set(false);
  runtime.flush();
  expect(value).toBe(2);
  left.set(3);
  expect(runtime.pending).toBe(0);
  right.set(4);
  runtime.flush();
  expect(value).toBe(4);
  expect(releases).toBe(0);
  items.set([]);
  runtime.flush();
  expect(releases).toBe(1);
  right.set(5);
  branch.set(true);
  expect(runtime.pending).toBe(0);
  runtime.dispose();
  items.set([item]);
  expect(runtime.pending).toBe(0);
});
it("preserves percentage-sized hits under a transformed and clipped parent", () => {
  runtime = testRuntime();
  const clip = new Path2D();
  clip.rect(0, 0, 50, 100);
  const events: string[] = [];
  const canvas = runtime.mount(
    <>
      <Rectangle
        style={{ width: 600, height: 400, fill: "white" }}
        onPointerDown={() => events.push("background")}
      />
      <Group style={{ translateX: 20, translateY: 10, scaleX: 2 }}>
        <Clip style={{ d: clip }}>
          <AnchoredLayout items={[item]} gap={8}>
            {() => (
              <Rectangle
                style={{ width: "100%", height: "100%", fill: "blue" }}
                onPointerDown={() => events.push("card")}
              />
            )}
          </AnchoredLayout>
        </Clip>
      </Group>
    </>,
  );
  runtime.flush();
  // Local card spans x=28..68,y=20..40. Parent maps x to 2*x+40; clip ends at x=140.
  const rect = canvas.getBoundingClientRect();
  for (const x of [110, 150])
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: rect.left + x,
        clientY: rect.top + 40,
        bubbles: true,
      }),
    );
  expect(events).toEqual(["card", "background"]);
  expect([
    ...canvas.getContext("2d")!.getImageData(110, 40, 1, 1).data,
  ]).toEqual([0, 0, 255, 255]);
});
it("keeps source paint order when anchor sorting differs and does not mutate frozen inputs", () => {
  runtime = testRuntime();
  const order: string[] = [];
  const items = Object.freeze([
    Object.freeze({ ...item, key: "z", anchor: { x: 20, y: 80 } }),
    Object.freeze({ ...item, key: "a" }),
  ]);
  runtime.mount(
    <AnchoredLayout items={items}>
      {(entry) => {
        order.push(String(entry.key));
        return null;
      }}
    </AnchoredLayout>,
  );
  runtime.flush();
  expect(order).toEqual(["z", "a"]);
  expect(items[0].key).toBe("z");
});

it("normalizes numeric keys with the same semantics as core", () => {
  runtime = testRuntime();
  const keys: string[] = [];
  runtime.mount(
    <AnchoredLayout
      items={[NaN, Infinity, -Infinity].map((key) => ({ ...item, key }))}
    >
      {(entry) => {
        keys.push(String(entry.key));
        return null;
      }}
    </AnchoredLayout>,
  );
  runtime.flush();
  expect(keys).toEqual(["NaN", "Infinity", "-Infinity"]);
});
