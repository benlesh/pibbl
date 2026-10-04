/** @jsxImportSource @crc/core */
import {
  crc,
  Rectangle,
  Ellipse,
  Polygon,
  Group,
  signal,
  useComputed,
  useManipulation,
  ManipulationFrame,
} from "@crc/core";
import { afterEach, expect, it } from "vitest";
import {
  PhysicsWorld2D,
  crcPhysicsWorld2D,
  physicsObstacles2D,
  staticBody2D,
  kinematicBody2D,
  collider2D,
} from "../../../2d.js";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../../../../../lib/scheduler/testing.js";
import { clearSharedState } from "../../../../../lib/global-state.js";

let dispose = () => {};
afterEach(() => {
  dispose();
  clearSharedState();
  document.body.replaceChildren();
});
it("publishes declared boxes through the public source and invalidates on disposal", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const x = signal(40);
  let source!: ReturnType<typeof physicsObstacles2D>;
  function Content() {
    const next = physicsObstacles2D(crcPhysicsWorld2D());
    if (source) expect(next).toBe(source);
    source = next;
    return (
      <Rectangle
        physics={staticBody2D()}
        style={{ left: x, top: 60, width: 80, height: 40 }}
      />
    );
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(
    canvas,
    <PhysicsWorld2D>
      <Content />
    </PhysicsWorld2D>,
  );
  dispose = () => {
    root.dispose();
    restore();
  };
  for (let i = 0; i < 4 && driver.pendingHostFrames; i++)
    driver.flush((i * 1000) / 60);
  const first = source.read();
  expect(Array.from(first.boxes)).toEqual([80, 80, 40, 20, 0, 0, 0, 0, 40, 60]);
  const previous = first.boxes.slice();
  x.set(70);
  expect(source.read().boxes).toEqual(previous);
  for (let i = 4; i < 8 && driver.pendingHostFrames; i++)
    driver.flush((i * 1000) / 60);
  expect(source.read().boxes).toBe(first.boxes);
  expect(source.read().boxes[0]).toBe(110);
  root.dispose();
  expect(() => source.read()).toThrow(/live CRC physics/i);
});

it("exports ellipse and triangle geometry from mounted CRC shapes", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  let source!: ReturnType<typeof physicsObstacles2D>;
  function Content() {
    source = physicsObstacles2D(crcPhysicsWorld2D());
    return (
      <>
        <Ellipse
          physics={staticBody2D()}
          style={{ cx: 100, cy: 80, radiusX: 50, radiusY: 25 }}
        />
        <Polygon
          physics={staticBody2D()}
          style={{
            coords: [
              [200, 140],
              [250, 40],
              [300, 140],
            ],
          }}
        />
      </>
    );
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(
    canvas,
    <PhysicsWorld2D>
      <Content />
    </PhysicsWorld2D>,
  );
  dispose = () => {
    root.dispose();
    restore();
  };
  for (let i = 0; i < 4 && driver.pendingHostFrames; i++)
    driver.flush((i * 1000) / 60);
  const batch = source.read();
  expect(Array.from(batch.ellipses.slice(0, 5))).toEqual([100, 80, 50, 25, 0]);
  expect(batch.polygons[0]).toBe(3);
  expect(Array.from(batch.polygons.slice(6)).sort((a, b) => a - b)).toEqual([
    40, 140, 140, 200, 250, 300,
  ]);
});

it("keeps a manipulated ellipse collider aligned after move, resize, and rotation", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const box = signal({ left: 100, top: 80, width: 120, height: 60 });
  const rotation = signal(0);
  let source!: ReturnType<typeof physicsObstacles2D>;
  function Content() {
    source = physicsObstacles2D(crcPhysicsWorld2D());
    const manipulation = useManipulation({
      box,
      rotation,
      move: {},
      resize: {},
      rotate: {},
    });
    const position = useComputed(() => {
      const b = box.get(),
        a = rotation.get(),
        c = Math.cos(a),
        s = Math.sin(a);
      return [
        b.left + b.width / 2 - (c * b.width) / 2 + (s * b.height) / 2,
        b.top + b.height / 2 - (s * b.width) / 2 - (c * b.height) / 2,
      ] as const;
    });
    const rotationDegrees = useComputed(() => (rotation.get() * 180) / Math.PI);
    const b = box.get();
    return (
      <ManipulationFrame {...manipulation.frameProps}>
        <Group
          physics={kinematicBody2D({
            collider: false,
            target: { position, rotationDegrees },
          })}
        >
          <Ellipse
            physics={collider2D()}
            style={{
              cx: b.width / 2,
              cy: b.height / 2,
              radiusX: b.width / 2,
              radiusY: b.height / 2,
            }}
          />
        </Group>
      </ManipulationFrame>
    );
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(
    canvas,
    <PhysicsWorld2D space="local" gravity={[0, 0]}>
      <Content />
    </PhysicsWorld2D>,
  );
  dispose = () => {
    root.dispose();
    restore();
  };
  let frame = 0;
  const settle = () => {
    for (let i = 0; i < 6 && driver.pendingHostFrames; i++)
      driver.flush((++frame * 1000) / 60);
  };
  settle();
  expect(Array.from(source.read().ellipses.slice(0, 5))).toEqual([
    160, 110, 60, 30, 0,
  ]);
  box.set({ left: 220, top: 140, width: 160, height: 90 });
  rotation.set(Math.PI / 4);
  settle();
  const ellipse = source.read().ellipses;
  expect(ellipse[0]).toBeCloseTo(300, 8);
  expect(ellipse[1]).toBeCloseTo(185, 8);
  expect(ellipse[2]).toBeCloseTo(80, 8);
  expect(ellipse[3]).toBeCloseTo(45, 8);
  expect(ellipse[4]).toBeCloseTo(Math.PI / 4, 8);
  const stationaryRevision = source.read().revision;
  settle();
  expect(source.read().revision).toBe(stationaryRevision);
});

it("exports a rounded shelf as an exact union of boxes and circles", () => {
  const driver = new ManualSchedulerDriver(),
    restore = installSchedulerDriverForTest(driver);
  let source!: ReturnType<typeof physicsObstacles2D>;
  function Content() {
    source = physicsObstacles2D(crcPhysicsWorld2D());
    return (
      <Rectangle
        physics={staticBody2D()}
        style={{ left: 140, top: 235, width: 160, height: 18, cornerRadius: 3 }}
      />
    );
  }
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const root = crc(
    canvas,
    <PhysicsWorld2D>
      <Content />
    </PhysicsWorld2D>,
  );
  dispose = () => {
    root.dispose();
    restore();
  };
  for (let i = 0; i < 4 && driver.pendingHostFrames; i++)
    driver.flush((i * 1000) / 60);
  const batch = source.read();
  expect(batch.boxes.length).toBe(20);
  expect(batch.ellipses.length).toBe(40);
  expect(Array.from(batch.boxes.slice(0, 4))).toEqual([220, 244, 77, 9]);
  expect(Array.from(batch.ellipses.slice(0, 4))).toEqual([143, 238, 3, 3]);
});
