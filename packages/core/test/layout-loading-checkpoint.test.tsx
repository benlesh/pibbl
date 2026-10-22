import { afterEach, expect, it, vi } from "vitest";
import {
  pibbl,
  prepareLayoutEngine,
  Flex,
  Text,
  Rectangle,
  useLayoutBox,
  type PibblController,
} from "@pibbl/core";
import { bytes } from "../src/lib/layout/wasm/bytes.js";

const controllers: PibblController[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

it("waits for external layout preparation before admitting a public mount", async () => {
  let finishDownload!: (response: Response) => void;
  const download = new Promise<Response>((resolve) => {
    finishDownload = resolve;
  });
  const fetchAsset = vi
    .fn(() => download)
    .mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetchAsset);
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 80;
  document.body.append(canvas);
  const getContext = vi.spyOn(canvas, "getContext");
  const boxes: { width: number; height: number }[] = [];
  let hits = 0;
  const Paint = vi.fn(
    (_props: {
      style: { width: number; height: number; minWidth: number };
    }) => {
      const box = useLayoutBox();
      boxes.push({ width: box.width, height: box.height });
      return (
        <Rectangle
          style={{ width: 80, height: 40, fill: "#19375b" }}
          onClick={() => hits++}
        />
      );
    },
  );
  await expect(
    pibbl(canvas, <Paint style={{ width: 80, height: 40, minWidth: 0 }} />),
  ).rejects.toThrow(/fetch/i);
  expect(Paint).not.toHaveBeenCalled();
  expect(getContext).not.toHaveBeenCalled();
  fetchAsset.mockClear();
  const pending = pibbl(
    canvas,
    <Flex style={{ width: 160, height: 80, alignItems: "flex-start" }}>
      <Paint style={{ width: 80, height: 40, minWidth: 0 }} />
      <Text
        style={{ width: 80, height: 40, minWidth: 0, font: "12px sans-serif" }}
      >
        Ready
      </Text>
    </Flex>,
  );
  expect(pending).toBeInstanceOf(Promise);
  expect(Paint).not.toHaveBeenCalled();
  expect(getContext).not.toHaveBeenCalled();
  const prewarm = prepareLayoutEngine();
  const aborter = new AbortController();
  const other = document.createElement("canvas");
  other.width = 80;
  other.height = 40;
  const cancelled = pibbl(
    other,
    <Rectangle style={{ width: 80, height: 40 }} />,
    { signal: aborter.signal },
  );
  const cancellation = expect(cancelled).rejects.toMatchObject({
    name: "AbortError",
  });
  aborter.abort();
  await cancellation;
  await Promise.resolve();
  expect(fetchAsset).toHaveBeenCalledTimes(1);
  finishDownload(
    new Response(
      Uint8Array.from(atob(bytes), (character) => character.charCodeAt(0)),
      { headers: { "Content-Type": "application/wasm" } },
    ),
  );
  await prewarm;
  const controller = await pending;
  controllers.push(controller);
  await nextFrame();
  expect(boxes).toEqual([{ width: 80, height: 40 }]);
  const bounds = canvas.getBoundingClientRect();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: bounds.left + 20,
        clientY: bounds.top + 20,
        bubbles: true,
        button: 0,
      }),
    );
  expect(hits).toBe(1);
  controller.dispose();
  for (const type of ["mousedown", "mouseup", "click"])
    canvas.dispatchEvent(
      new MouseEvent(type, {
        clientX: bounds.left + 20,
        clientY: bounds.top + 20,
        bubbles: true,
        button: 0,
      }),
    );
  expect(hits).toBe(1);
});

it("reuses the prepared module through the separate synchronous entry without fetching or decoding", async () => {
  const { pibblSync } = await import("@pibbl/core/sync");
  const fetchAsset = vi.fn((_props: { unused?: never }) =>
    Promise.reject(new Error("Sync must not fetch")),
  );
  vi.stubGlobal("fetch", fetchAsset);
  const decode = vi.spyOn(globalThis, "atob");
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const controller = pibblSync(
    canvas,
    <Rectangle style={{ width: 40, height: 30 }} />,
  );
  controllers.push(controller);
  expect(controller).not.toBeInstanceOf(Promise);
  expect(typeof controller.dispose).toBe("function");
  expect(fetchAsset).not.toHaveBeenCalled();
  expect(decode).not.toHaveBeenCalled();
  await nextFrame();
});

it("rejects an older same-canvas async request and mounts only the newest root", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const Old = vi.fn((_props: { unused?: never }) => <Rectangle style={{ width: 10, height: 10 }} />);
  const New = vi.fn((_props: { unused?: never }) => <Rectangle style={{ width: 40, height: 30 }} />);
  const older = pibbl(canvas, <Old />);
  const superseded = expect(older).rejects.toMatchObject({
    name: "AbortError",
  });
  const controller = await pibbl(canvas, <New />);
  controllers.push(controller);
  await superseded;
  await nextFrame();
  expect(Old).not.toHaveBeenCalled();
  expect(New).toHaveBeenCalledTimes(1);
});

it("lets a newer synchronous request supersede an async continuation", async () => {
  const { pibblSync } = await import("@pibbl/core/sync");
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const Old = vi.fn((_props: { unused?: never }) => null);
  const New = vi.fn((_props: { unused?: never }) => <Rectangle style={{ width: 40, height: 30 }} />);
  const older = pibbl(canvas, <Old />);
  const superseded = expect(older).rejects.toMatchObject({
    name: "AbortError",
  });
  const controller = pibblSync(canvas, <New />);
  controllers.push(controller);
  await superseded;
  await nextFrame();
  expect(Old).not.toHaveBeenCalled();
  expect(New).toHaveBeenCalledTimes(1);
});

it("cancels a pending update when its live mount is disposed without reviving it", async () => {
  const { pibblSync } = await import("@pibbl/core/sync");
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const oldController = pibblSync(
    canvas,
    <Rectangle style={{ width: 40, height: 30 }} />,
  );
  controllers.push(oldController);
  await nextFrame();
  const Revived = vi.fn((_props: { unused?: never }) => null);
  const pending = pibbl(canvas, <Revived />);
  const disposed = expect(pending).rejects.toMatchObject({
    name: "AbortError",
  });
  oldController.dispose();
  await disposed;
  await nextFrame();
  expect(Revived).not.toHaveBeenCalled();
  const newer = pibbl(canvas, <Rectangle style={{ width: 20, height: 20 }} />);
  oldController.dispose(); // An already disposed controller cannot cancel a new mount.
  const newController = await newer;
  controllers.push(newController);
  expect(newController).not.toBe(oldController);
});

it("does not supersede an earlier request for a pre-aborted caller", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const aborted = new AbortController();
  aborted.abort();
  const root = <Rectangle style={{ width: 20, height: 20 }} />;
  const earlier = pibbl(canvas, root);
  await expect(
    pibbl(canvas, root, { signal: aborted.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  controllers.push(await earlier);
});

it("preserves stable controller and original mount lifetime across awaited updates", async () => {
  const { pibblSync } = await import("@pibbl/core/sync");
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const lifetime = new AbortController();
  const caller = new AbortController();
  const widths: number[] = [];
  const New = vi.fn((_props: { unused?: never }) => {
    widths.push(useLayoutBox().width);
    return <Rectangle style={{ width: 40, height: 30 }} />;
  });
  const controller = pibblSync(canvas, null, {
    signal: lifetime.signal,
    viewport: { width: 100, height: 80 },
  });
  controllers.push(controller);
  const result = await pibbl(canvas, <New />, {
    signal: caller.signal,
    viewport: { width: 20, height: 10 },
  });
  expect(result).toBe(controller);
  caller.abort();
  await nextFrame();
  expect(New).toHaveBeenCalledTimes(1);
  expect(widths).toEqual([100]);
  lifetime.abort();
  const again = await pibbl(canvas, null);
  controllers.push(again);
  expect(again).not.toBe(controller);
});

it("detaches cancelled caller listeners before a newer same-canvas request", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 80;
  document.body.append(canvas);
  const oldCaller = new AbortController();
  const detach = vi.spyOn(oldCaller.signal, "removeEventListener");
  const older = pibbl(canvas, null, { signal: oldCaller.signal });
  const cancelled = expect(older).rejects.toMatchObject({ name: "AbortError" });
  oldCaller.abort();
  await cancelled;
  expect(detach).toHaveBeenCalledWith("abort", expect.any(Function));
  const newer = pibbl(canvas, null);
  oldCaller.signal.dispatchEvent(new Event("abort"));
  controllers.push(await newer);
});
