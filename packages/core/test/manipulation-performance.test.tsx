import { afterEach, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";
import {
  crc,
  signal,
  useManipulation,
  ManipulationFrame,
  DragHandle,
  ResizeHandles,
  Flex,
  Absolute,
  Rectangle,
  type CRCController,
} from "@crc/core";
import {
  installSchedulerDriverForTest,
  ManualSchedulerDriver,
} from "../src/lib/scheduler/testing";
import { getSignalNode } from "../src/lib/signals/graph";

let mounted: CRCController | undefined;
let restore: (() => void) | undefined;
afterEach(() => {
  mounted?.dispose();
  restore?.();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
it("coalesces pointer samples into one normal content traversal and releases gesture observers", async () => {
  const driver = new ManualSchedulerDriver();
  restore = installSchedulerDriverForTest(driver);
  const box = signal({ left: 40, top: 50, width: 160, height: 120 });
  let contentVisits = 0;
  let itemVisits = 0;
  function Item(_props: {
    style: { width: number; height: number; minWidth: number };
  }) {
    itemVisits++;
    return <Rectangle style={{ width: 20, height: 20, fill: "blue" }} />;
  }
  function Content(_props: { style?: { width: number; height: number } }) {
    contentVisits++;
    return (
      <Flex style={{ flexDirection: "row", gap: 4 }}>
        {[0, 1, 2].map((key) => (
          <Item key={key} style={{ width: 20, height: 20, minWidth: 20 }} />
        ))}
      </Flex>
    );
  }
  function Scene() {
    const controller = useManipulation({ box, move: {}, resize: {} });
    return (
      <ManipulationFrame {...controller.frameProps}>
        <Content />
        <DragHandle
          controller={controller}
          style={{ width: 160, height: 120 }}
        />
        <ResizeHandles controller={controller} />
      </ManipulationFrame>
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  const readback = vi.spyOn(canvas.getContext("2d")!, "getImageData");
  mounted = crc(canvas, <Scene />);
  driver.flush(0);
  expect(contentVisits).toBe(1);
  expect(itemVisits).toBe(3);
  const baselineObservers = getSignalNode(box).observerCount;
  const baselineRequests = driver.requestCount;
  await commands.manipulationPointer([
    { type: "move", x: 80, y: 80 },
    { type: "down" },
  ]);
  expect(getSignalNode(box).observerCount).toBe(baselineObservers + 1);
  await commands.manipulationPointer([
    { type: "move", x: 100, y: 100 },
    { type: "move", x: 110, y: 110 },
    { type: "move", x: 120, y: 120 },
    { type: "up" },
  ]);
  expect(box.get().left).toBe(80);
  expect(getSignalNode(box).observerCount).toBe(baselineObservers);
  expect(driver.pendingHostFrames).toBe(1);
  expect(driver.requestCount - baselineRequests).toBe(1);
  expect(contentVisits).toBe(1);
  driver.flush(16);
  expect(contentVisits).toBe(2);
  expect(itemVisits).toBe(6);
  expect(driver.pendingHostFrames).toBe(0);
  expect(readback).not.toHaveBeenCalled();
  mounted.dispose();
  mounted = undefined;
  expect(getSignalNode(box).observerCount).toBe(0);
  expect(driver.pendingHostFrames).toBe(0);
  const visitsBeforeManual = contentVisits;
  const itemsBeforeManual = itemVisits;
  mounted = crc(
    canvas,
    <Absolute style={box}>
      <Content style={{ width: 160, height: 120 }} />
    </Absolute>,
  );
  driver.flush(32);
  const manualRequests = driver.requestCount;
  box.update((value) => ({ ...value, left: 90 }));
  box.update((value) => ({ ...value, left: 100 }));
  box.update((value) => ({ ...value, left: 110 }));
  expect(driver.requestCount - manualRequests).toBe(1);
  driver.flush(48);
  expect(contentVisits - visitsBeforeManual).toBe(2);
  expect(itemVisits - itemsBeforeManual).toBe(6);
  expect(driver.pendingHostFrames).toBe(0);
});
