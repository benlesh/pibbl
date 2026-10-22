import { WasmFlexTextExample } from '../../scenarios/src/learning/layout/wasm-flex-text.example';
import { afterEach, expect, it } from "vitest";
import { Flex, Rectangle, signal, type PibblController } from "@pibbl/core";
import { pibblSync } from "@pibbl/core/sync";
import {
  experimentalLayout,
  snapshotWasmLayoutDiagnostics,
} from "../src/lib/layout/wasm/region";

let controller: PibblController | undefined;
afterEach(() => {
  controller?.dispose();
  controller = undefined;
  document.body.replaceChildren();
});
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
function canvas() {
  const result = document.createElement("canvas");
  result.width = 200;
  result.height = 80;
  document.body.append(result);
  return result;
}
const pixel = (target: HTMLCanvasElement, x: number) =>
  Array.from(target.getContext("2d")!.getImageData(x, 10, 1, 1).data);

it.runIf(experimentalLayout)(
  "repaints a receiver without revisiting its unchanged parent allocation records",
  async () => {
    const target = canvas();
    const fill = signal("#19375b");
    const baseline = snapshotWasmLayoutDiagnostics();
    const width = signal(60);
    const first = <Rectangle style={Object.freeze({ width, height: 40, minWidth: 0, flexShrink: 0, fill })} />;
    const second = <Rectangle style={Object.freeze({ width: 40, height: 40, minWidth: 0, flexShrink: 0, fill: "#426b61" })} />;
    Object.freeze(first.props); Object.freeze(first);
    Object.freeze(second.props); Object.freeze(second);
    const children = Object.freeze([first, second]);
    const root = <Flex style={{ width: 200, height: 80 }}>{children}</Flex>;
    controller = pibblSync(target, root);
    await nextFrame();
    const before = snapshotWasmLayoutDiagnostics();
    expect(pixel(target, 10)).toEqual([25, 55, 91, 255]);
    fill.set("#a63758");
    await nextFrame();
    const painted = snapshotWasmLayoutDiagnostics();
    expect(pixel(target, 10)).toEqual([166, 55, 88, 255]);
    expect(pixel(target, 70)).toEqual([66, 107, 97, 255]);
    expect(painted.frames).toBeGreaterThan(before.frames);
    expect(painted.allocationPasses).toBe(before.allocationPasses);
    expect(painted.allocationItemVisits).toBe(before.allocationItemVisits);
    expect(painted.nodeReuses).toBe(before.nodeReuses);
    fill.set("#19375b"); // Paint dirties the consumer first; layout must still invalidate it.
    width.set(100);
    await nextFrame();
    expect(pixel(target, 70)).toEqual([25, 55, 91, 255]);
    expect(pixel(target, 110)).toEqual([66, 107, 97, 255]);
    expect(snapshotWasmLayoutDiagnostics().nodeReuses).toBeGreaterThan(painted.nodeReuses);
    controller.dispose(); controller = undefined;
    const disposed = snapshotWasmLayoutDiagnostics();
    expect(disposed.activeNodes).toBe(baseline.activeNodes);
    expect(disposed.activeArenas).toBe(baseline.activeArenas);
  },
);

it("observes an in-place authored width change when a paint signal schedules rendering", async () => {
  const target = canvas();
  const fill = signal("#19375b");
  const authored = { width: 60, height: 40, minWidth: 0, flexShrink: 0, fill };
  const root = (
    <Flex style={{ width: 200, height: 80 }}>
      <Rectangle style={authored} />
      <Rectangle
        style={{
          width: 40,
          height: 40,
          minWidth: 0,
          flexShrink: 0,
          fill: "#426b61",
        }}
      />
    </Flex>
  );
  controller = pibblSync(target, root);
  await nextFrame();
  expect(pixel(target, 70)).toEqual([66, 107, 97, 255]);
  authored.width = 100;
  fill.set("#a63758");
  await nextFrame();
  expect(pixel(target, 70)).toEqual([166, 55, 88, 255]);
  expect(pixel(target, 110)).toEqual([66, 107, 97, 255]);
});


it.runIf(experimentalLayout)('exposes the bounded frozen allocation proof through the existing public example', async () => {
  const target = canvas(); target.width = 760; target.height = 460;
  const baseline = snapshotWasmLayoutDiagnostics();
  controller = pibblSync(target, <WasmFlexTextExample />);
  await nextFrame();
  function click(x: number, y: number) {
    const bounds = target.getBoundingClientRect();
    for (const type of ['mousedown', 'mouseup', 'click']) target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: bounds.left+x, clientY: bounds.top+y }));
  }
  click(500,110);
  await nextFrame();
  const frozen = snapshotWasmLayoutDiagnostics();
  expect(frozen.activeNodes-baseline.activeNodes).toBe(2);
  click(250,110);
  await nextFrame();
  const painted = snapshotWasmLayoutDiagnostics();
  expect(painted.allocationCacheHits).toBe(frozen.allocationCacheHits+1);
  expect(painted.allocationPasses).toBe(frozen.allocationPasses);
  expect(painted.allocationItemVisits).toBe(frozen.allocationItemVisits);
  const data = target.getContext('2d')!.getImageData(28,260,560,180).data;
  let red = 0;
  for (let index=0; index<data.length; index+=4) if (data[index]===166 && data[index+1]===55 && data[index+2]===88) red++;
  expect(red).toBeGreaterThan(0);
  click(45,160); // Receiver-owned text metrics invalidate the frozen allocation.
  await nextFrame();
  const measured = snapshotWasmLayoutDiagnostics();
  expect(measured.allocationPasses).toBeGreaterThan(painted.allocationPasses);
  expect(measured.measuredLeaves).toBeGreaterThan(painted.measuredLeaves);
});


it.runIf(experimentalLayout)('keeps frozen accessor styles on the conservative path', async () => {
  const target = canvas();
  const fill = signal('#19375b');
  let width = 60;
  const first = <Rectangle style={Object.freeze({ get width() { return width; }, height: 40, minWidth: 0, flexShrink: 0, fill })} />;
  const second = <Rectangle style={Object.freeze({ width: 40, height: 40, minWidth: 0, flexShrink: 0, fill: '#426b61' })} />;
  Object.freeze(first.props); Object.freeze(first);
  Object.freeze(second.props); Object.freeze(second);
  const children = Object.freeze([first, second]);
  controller = pibblSync(target, <Flex style={{ width: 200, height: 80 }}>{children}</Flex>);
  await nextFrame();
  const before = snapshotWasmLayoutDiagnostics();
  expect(pixel(target, 70)).toEqual([66,107,97,255]);
  width = 100; fill.set('#a63758');
  await nextFrame();
  expect(pixel(target, 70)).toEqual([166,55,88,255]);
  expect(snapshotWasmLayoutDiagnostics().allocationPasses).toBeGreaterThan(before.allocationPasses);
});
