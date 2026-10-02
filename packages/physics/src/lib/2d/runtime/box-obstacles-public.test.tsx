/** @jsxImportSource @crc/core */
import { crc, Rectangle, signal } from "@crc/core";
import { afterEach, expect, it } from "vitest";
import { PhysicsWorld2D, crcPhysicsWorld2D, physicsBoxObstacles2D, staticBody2D } from "../../../2d.js";
import { installSchedulerDriverForTest, ManualSchedulerDriver } from "../../../../../core/src/lib/scheduler/testing.js";
import { clearSharedState } from "../../../../../core/src/lib/global-state.js";

let dispose = () => {};
afterEach(() => { dispose(); clearSharedState(); document.body.replaceChildren(); });
it("publishes declared boxes through the public source and invalidates on disposal", () => {
  const driver = new ManualSchedulerDriver();
  const restore = installSchedulerDriverForTest(driver);
  const x = signal(40);
  let source!: ReturnType<typeof physicsBoxObstacles2D>;
  function Content() {
    const next = physicsBoxObstacles2D(crcPhysicsWorld2D());
    if (source) expect(next).toBe(source);
    source = next;
    return <Rectangle physics={staticBody2D()} style={{ x, y: 60, width: 80, height: 40 }} />;
  }
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const root = crc(canvas, <PhysicsWorld2D><Content /></PhysicsWorld2D>);
  dispose = () => { root.dispose(); restore(); };
  for (let i = 0; i < 4 && driver.pendingHostFrames; i++) driver.flush(i * 1000 / 60);
  const first = source.read();
  expect(Array.from(first.boxes)).toEqual([80, 80, 40, 20, 0, 0, 0, 0, 0, 0]);
  const previous = first.boxes.slice();
  x.set(70);
  expect(source.read().boxes).toEqual(previous);
  for (let i = 4; i < 8 && driver.pendingHostFrames; i++) driver.flush(i * 1000 / 60);
  expect(source.read().boxes).toBe(first.boxes);
  expect(source.read().boxes[0]).toBe(110);
  root.dispose();
  expect(() => source.read()).toThrow(/live CRC physics/i);
});
