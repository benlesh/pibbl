import {
  Clip,
  DragHandle,
  Group,
  Layer,
  Manipulable,
  ManipulationFrame,
  Rectangle,
  ResizeHandle,
  RotationHandle,
  crc,
  signal,
  useManipulation,
  type CRCController,
  type CRCNode,
} from '@crc/core';
import { afterEach, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

let controller: CRCController | undefined;

afterEach(async () => {
  controller?.dispose();
  controller = undefined;
  await settle();
  document.body.replaceChildren();
});

it('keeps a custom resize child aligned and active through fit, density, Layer, filter, and a nonuniform rotated Group', async () => {
  const box = signal({ left: 40, top: 50, width: 100, height: 80 });
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvas.style.cssText = 'display:block; width:160px; height:120px';
  canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  function Scene(): CRCNode {
    const manipulation = useManipulation({ box, resize: {} });
    return <Layer style={{ width: 320, height: 240 }}>
      <Group style={{
        filter: { type: 'blur', radius: 1 },
        translateX: 30,
        translateY: 20,
        rotationDegrees: 30,
        scaleX: 1.5,
        scaleY: 0.75,
      }}>
        <ManipulationFrame {...manipulation.frameProps}>
          <Clip style={{ d: rectanglePath(0, 0, 70, 60) }}>
            <Rectangle style={{ width: 100, height: 80, fill: '#dc2626' }} />
          </Clip>
          <ResizeHandle controller={manipulation} position="bottom-right">
            <Rectangle style={{ width: 8, height: 8, fill: '#16a34a' }} />
          </ResizeHandle>
        </ManipulationFrame>
      </Group>
    </Layer>;
  }
  controller = crc(canvas, <Scene />, {
    viewport: { width: 320, height: 240 },
    fit: 'contain',
    pixelRatio: 2,
  });
  await settle();

  const group = new DOMMatrix()
    .scale(1.5, 0.75)
    .rotate(30)
    .translate(30, 20);
  const css = (point: DOMPointInit) => {
    const logical = group.transformPoint(new DOMPoint(point.x, point.y));
    return { x: logical.x / 2, y: logical.y / 2 };
  };
  const start = css({ x: 140, y: 130 });
  const end = css({ x: 160, y: 140 });

  await commands.manipulationPointer([
    { type: 'move', ...start },
    { type: 'down' },
    { type: 'move', ...end },
    { type: 'up' },
  ]);
  await settle();

  expect(box.get()).toMatchObject({ left: 40, top: 50 });
  expect(box.get().width).toBeCloseTo(120, 4);
  expect(box.get().height).toBeCloseTo(90, 4);
});

it('keeps content-only clips out of handle targeting while an ancestor Clip blocks the same handle', async () => {
  const box = signal({ left: 20, top: 20, width: 100, height: 80 });
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 180;
  canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  controller = crc(canvas,
    <Clip style={{ d: rectanglePath(0, 0, 100, 100) }}>
      <Manipulable style={box} resizable>
        <Clip style={{ d: rectanglePath(0, 0, 60, 50) }}>
          <Rectangle style={{ width: 100, height: 80, fill: '#dc2626' }} />
        </Clip>
      </Manipulable>
    </Clip>,
    { pixelRatio: 1 },
  );
  await settle();

  await commands.manipulationPointer([
    { type: 'move', x: 120, y: 100 },
    { type: 'down' },
    { type: 'move', x: 150, y: 120 },
    { type: 'up' },
  ]);
  await settle();

  expect(box.get()).toEqual({ left: 20, top: 20, width: 100, height: 80 });
});

it('lets a custom rotation child receive its pointer event without replacing the handle operation', async () => {
  const box = signal({ left: 100, top: 100, width: 100, height: 80 });
  const rotation = signal(0);
  const childPresses: number[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 240;
  canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  function Scene(): CRCNode {
    const manipulation = useManipulation({ box, rotation, rotate: {} });
    return <ManipulationFrame {...manipulation.frameProps}>
      <RotationHandle controller={manipulation}>
        <Rectangle
          style={{ width: 8, height: 8, fill: '#16a34a' }}
          onPointerDown={() => childPresses.push(1)}
        />
      </RotationHandle>
    </ManipulationFrame>;
  }
  controller = crc(canvas, <Scene />, { pixelRatio: 1 });
  await settle();

  await commands.manipulationPointer([
    { type: 'move', x: 150, y: 76 },
    { type: 'down' },
    { type: 'move', x: 214, y: 140 },
    { type: 'up' },
  ]);
  await settle();

  expect(childPresses).toHaveLength(1);
  expect(rotation.get()).toBeCloseTo(Math.PI / 2, 4);
});

it('paints custom handle children in CSS-pixel local coordinates under a scaled frame', async () => {
  const box = signal({ left: 10, top: 10, width: 40, height: 30 });
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvas.style.cssText = 'display:block; width:160px; height:120px';
  canvas.dataset.manipulationTest = '';
  document.body.append(canvas);
  function Scene(): CRCNode {
    const manipulation = useManipulation({ box, resize: {} });
    return <Group style={{ scaleX: 3, scaleY: 3 }}>
      <ManipulationFrame {...manipulation.frameProps}>
        <ResizeHandle controller={manipulation} position="bottom-right">
          <Rectangle style={{ width: 8, height: 8, fill: '#16a34a' }} />
        </ResizeHandle>
      </ManipulationFrame>
    </Group>;
  }
  controller = crc(canvas, <Scene />, {
    viewport: { width: 320, height: 240 },
    fit: 'contain',
    pixelRatio: 2,
  });
  await settle();

  const bounds = paintedBounds(canvas, [22, 163, 74]);
  expect(bounds).toMatchObject({ left: 150, top: 120, width: 16, height: 16 });

  await commands.manipulationPointer([
    { type: 'move', x: 75, y: 60 },
    { type: 'down' },
    { type: 'move', x: 90, y: 67.5 },
    { type: 'up' },
  ]);
  await settle();

  expect(box.get().width).toBeCloseTo(50, 4);
  expect(box.get().height).toBeCloseTo(35, 4);
});

it("replaces a keyed frame attachment without remounting its controller", async () => {
  const box = signal({ left: 40, top: 50, width: 100, height: 80 });
  const replacement = signal(false);
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  function Scene(): CRCNode {
    const manipulation = useManipulation({ box, move: {} });
    return (
      <ManipulationFrame
        key={replacement.get() ? "replacement" : "initial"}
        {...manipulation.frameProps}
      >
        <DragHandle
          controller={manipulation}
          style={{ width: 100, height: 80 }}
        />
      </ManipulationFrame>
    );
  }
  controller = crc(canvas, <Scene />, { pixelRatio: 1 });
  await settle();
  replacement.set(true);
  await settle();

  await commands.manipulationPointer([
    { type: "move", x: 60, y: 70 },
    { type: "down" },
    { type: "move", x: 80, y: 90 },
    { type: "up" },
  ]);
  await settle();

  expect(box.get()).toEqual({ left: 60, top: 70, width: 100, height: 80 });
});

it("cancels the next captured move when an ancestor or root CSS mapping changes", async () => {
  const box = signal({ left: 40, top: 50, width: 100, height: 80 });
  const translation = signal(0);
  const cancellations: string[] = [];
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  canvas.style.cssText = "display:block; width:200px; height:150px";
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  function Scene(): CRCNode {
    const manipulation = useManipulation({
      box,
      move: {},
      onCancel: (event) => cancellations.push(event.reason),
    });
    return (
      <Group style={{ translateX: translation.get() }}>
        <ManipulationFrame {...manipulation.frameProps}>
          <DragHandle
            controller={manipulation}
            style={{ width: 100, height: 80 }}
          />
        </ManipulationFrame>
      </Group>
    );
  }
  controller = crc(canvas, <Scene />, {
    viewport: { width: 400, height: 300 },
    pixelRatio: 1,
  });
  await settle();

  await commands.manipulationPointer([
    { type: "move", x: 30, y: 35 },
    { type: "down" },
    { type: "move", x: 50, y: 45 },
  ]);
  expect(box.get()).toEqual({ left: 80, top: 70, width: 100, height: 80 });

  translation.set(20);
  await settle();
  await commands.manipulationPointer([{ type: "move", x: 55, y: 50 }]);
  expect(cancellations).toEqual(["coordinate-space-changed"]);

  box.set({ left: 40, top: 50, width: 100, height: 80 });
  translation.set(0);
  await settle();
  await commands.manipulationPointer([
    { type: "move", x: 30, y: 35 },
    { type: "down" },
    { type: "move", x: 50, y: 45 },
  ]);
  canvas.style.marginLeft = "20px";
  await commands.manipulationPointer([{ type: "move", x: 55, y: 50 }]);

  box.set({ left: 40, top: 50, width: 100, height: 80 });
  canvas.style.marginLeft = "0px";
  await settle();
  await commands.manipulationPointer([
    { type: "move", x: 30, y: 35 },
    { type: "down" },
    { type: "move", x: 50, y: 45 },
  ]);
  canvas.style.width = "250px";
  await commands.manipulationPointer([{ type: "move", x: 55, y: 50 }]);

  expect(cancellations).toEqual([
    "coordinate-space-changed",
    "coordinate-space-changed",
    "coordinate-space-changed",
  ]);
});

function rectanglePath(x: number, y: number, width: number, height: number): Path2D {
  const path = new Path2D();
  path.rect(x, y, width, height);
  return path;
}

function paintedAlphaBounds(canvas: HTMLCanvasElement) {
  const image = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (image.data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function paintedBounds(
  canvas: HTMLCanvasElement,
  color: readonly [number, number, number],
) {
  const image = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4;
      if (
        image.data[offset] !== color[0] ||
        image.data[offset + 1] !== color[1] ||
        image.data[offset + 2] !== color[2] ||
        image.data[offset + 3] !== 255
      ) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function settle(): Promise<void> {
  return new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

it("replaces an active controller when one mounted frame receives a different controller prop", async () => {
  const firstBox = signal({ left: 40, top: 50, width: 100, height: 80 });
  const secondBox = signal({ left: 180, top: 50, width: 100, height: 80 });
  const showSecond = signal(false);
  let first!: ReturnType<typeof useManipulation>;
  let second!: ReturnType<typeof useManipulation>;
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  function Scene(): CRCNode {
    first = useManipulation({ box: firstBox, move: {} });
    second = useManipulation({ box: secondBox, move: {} });
    const current = showSecond.get() ? second : first;
    const box = showSecond.get() ? secondBox.get() : firstBox.get();
    return (
      <ManipulationFrame
        controller={current}
        style={{
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
        }}
      >
        <DragHandle
          controller={current}
          style={{ width: 100, height: 80 }}
        />
      </ManipulationFrame>
    );
  }
  controller = crc(canvas, <Scene />, { pixelRatio: 1 });
  await settle();

  await commands.manipulationPointer([
    { type: "move", x: 60, y: 70 },
    { type: "down" },
    { type: "move", x: 80, y: 90 },
  ]);
  expect(first.active.get()?.operation).toBe("move");
  expect(firstBox.get()).toEqual({ left: 60, top: 70, width: 100, height: 80 });

  showSecond.set(true);
  await settle();
  expect(first.active.get()).toBe(null);
  expect(firstBox.get()).toEqual({ left: 40, top: 50, width: 100, height: 80 });
  await commands.manipulationPointer([{ type: "up" }]);

  await commands.manipulationPointer([
    { type: "move", x: 200, y: 70 },
    { type: "down" },
    { type: "move", x: 220, y: 90 },
    { type: "up" },
  ]);
  await settle();
  expect(secondBox.get()).toEqual({ left: 200, top: 70, width: 100, height: 80 });
});

it("keeps default resize-handle chrome at an eight CSS-pixel extent under scale", async () => {
  const box = signal({ left: 10, top: 10, width: 40, height: 30 });
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 240;
  canvas.dataset.manipulationTest = "";
  document.body.append(canvas);
  function Scene(): CRCNode {
    const manipulation = useManipulation({ box, resize: {} });
    return (
      <Group style={{ scaleX: 3, scaleY: 3 }}>
        <ManipulationFrame {...manipulation.frameProps}>
          <ResizeHandle controller={manipulation} position="bottom-right" />
        </ManipulationFrame>
      </Group>
    );
  }
  controller = crc(canvas, <Scene />, { pixelRatio: 1 });
  await settle();

  expect(paintedAlphaBounds(canvas)).toEqual({ left: 146, top: 116, width: 8, height: 8 });
});
