import {
  getWorkbenchEntryBySlug,
  learningExampleCatalog,
  loadTutorialSnapshot,
  tutorialSnapshotCatalog,
  validateTutorialSnapshotCatalog,
  type TutorialSnapshotCatalogEntry,
} from "@crc/scenarios";
import { afterEach, expect, it } from "vitest";
import {
  learningSourcePaths,
  loadWorkbenchSource,
  tutorialSourcePaths,
  workbenchSourcePaths,
} from "../../../playground/src/learning-sources";
import {
  clickLogicalPoint,
  dragPointerLogicalPoint,
  pointerDownLogicalPoint,
  pointerMoveLogicalPoint,
  pointerUpLogicalPoint,
  wheelLogicalPoint,
} from "./support/user-input";
import { validateLearningSourceText } from "../../../tooling/learning-source-contract";

const mountedControllers: Array<{ dispose: () => void }> = [];

interface TextPaint {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly frame: number;
}

interface PaintOperation {
  readonly frame: number;
  readonly operation: "clearRect" | "fill" | "stroke";
  readonly fillStyle: string;
  readonly strokeStyle: string;
}

interface RectanglePaint {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly frame: number;
}

interface PathStartPaint {
  readonly x: number;
  readonly y: number;
  readonly frame: number;
}

function removeTrackedController(controller: { dispose: () => void }): void {
  const index = mountedControllers.indexOf(controller);
  if (index >= 0) mountedControllers.splice(index, 1);
}

async function renderTutorialSnapshot(slug: string): Promise<{
  readonly canvas: HTMLCanvasElement;
  readonly controller: { dispose: () => void };
  readonly textPaints: readonly TextPaint[];
  readonly paintOperations: readonly PaintOperation[];
  readonly rectanglePaints: readonly RectanglePaint[];
  readonly pathStartPaints: readonly PathStartPaint[];
}> {
  const entry = tutorialSnapshotCatalog.find(
    (candidate) => candidate.slug === slug,
  );
  if (!entry) throw new Error(`Missing tutorial snapshot ${slug}.`);

  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 600;
  document.body.appendChild(canvas);

  const context = canvas.getContext("2d");
  if (!context) throw new Error(`Tutorial snapshot ${slug} has no 2D context.`);

  let frame = 0;
  const paintOperations: PaintOperation[] = [];
  const rectanglePaints: RectanglePaint[] = [];
  const rectanglePaths = new WeakMap<
    Path2D,
    Readonly<{ x: number; y: number; width: number; height: number }>
  >();
  const pathStarts = new WeakMap<Path2D, Readonly<{ x: number; y: number }>>();
  const pathStartPaints: PathStartPaint[] = [];
  const pathRect = Path2D.prototype.rect;
  Path2D.prototype.rect = function (x, y, width, height) {
    rectanglePaths.set(this, { x, y, width, height });
    pathRect.call(this, x, y, width, height);
  };
  const pathMoveTo = Path2D.prototype.moveTo;
  Path2D.prototype.moveTo = function (x, y) {
    pathStarts.set(this, { x, y });
    pathMoveTo.call(this, x, y);
  };
  const clearRect = context.clearRect.bind(context);
  context.clearRect = function (x, y, width, height) {
    frame += 1;
    paintOperations.push({
      frame,
      operation: "clearRect",
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
    });
    clearRect(x, y, width, height);
  };
  const fill = context.fill.bind(context);
  const recordFill = function (
    this: CanvasRenderingContext2D,
    pathOrFillRule?: Path2D | CanvasFillRule,
    fillRule?: CanvasFillRule,
  ): void {
    paintOperations.push({
      frame,
      operation: "fill",
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
    });
    if (pathOrFillRule instanceof Path2D) {
      const rectangle = rectanglePaths.get(pathOrFillRule);
      if (rectangle) {
        const point = new DOMPoint(rectangle.x, rectangle.y).matrixTransform(
          this.getTransform(),
        );
        const transform = this.getTransform();
        rectanglePaints.push({
          x: point.x,
          y: point.y,
          width: rectangle.width * transform.a,
          height: rectangle.height * transform.d,
          frame,
        });
      }
    }
    if (pathOrFillRule instanceof Path2D) fill(pathOrFillRule, fillRule);
    else if (pathOrFillRule) fill(pathOrFillRule);
    else fill();
  };
  context.fill = recordFill as CanvasRenderingContext2D["fill"];
  const stroke = context.stroke.bind(context);
  context.stroke = function (path?: Path2D) {
    paintOperations.push({
      frame,
      operation: "stroke",
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
    });
    if (path) {
      const start = pathStarts.get(path);
      if (start) {
        const point = new DOMPoint(start.x, start.y).matrixTransform(
          this.getTransform(),
        );
        pathStartPaints.push({ x: point.x, y: point.y, frame });
      }
      stroke(path);
    }
    else stroke();
  };

  const textPaints: TextPaint[] = [];
  const fillText = context.fillText;
  context.fillText = function (...args) {
    const [text, x, y] = args;
    const point = new DOMPoint(x, y).matrixTransform(this.getTransform());
    textPaints.push({ text, x: point.x, y: point.y, frame });
    fillText.apply(this, args);
  };

  const module = await loadTutorialSnapshot(entry);
  const controller = module.default(canvas);
  mountedControllers.push(controller);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  Path2D.prototype.rect = pathRect;

  return {
    canvas,
    controller,
    textPaints,
    paintOperations,
    rectanglePaints,
    pathStartPaints,
  };
}

afterEach(() => {
  for (const controller of mountedControllers.splice(0)) controller.dispose();
  document.body.replaceChildren();
});

const module = async () => ({ default: () => ({ dispose() {} }) });
const record = (
  chapter: number,
  slug = `diagram-editor-chapter-${String(chapter)}`,
): TutorialSnapshotCatalogEntry => ({
  slug,
  tutorial: "diagram-editor",
  chapter,
  title: `Chapter ${String(chapter)}`,
  authoring: "jsx",
  canvas: { width: 960, height: 600 },
  source: {
    path: `packages/scenarios/src/tutorials/diagram-editor/${String(chapter).padStart(2, "0")}-chapter-${String(chapter)}.example.tsx`,
  },
  load: module,
});

it("validates one ordered tutorial prefix and rejects gaps", () => {
  expect(validateTutorialSnapshotCatalog([record(1), record(2)])).toHaveLength(
    2,
  );
  expect(() => validateTutorialSnapshotCatalog([record(1), record(3)])).toThrow(
    /contiguous from 1/u,
  );
});

it("keeps tutorial and ordinary learning slugs in one workbench namespace", () => {
  expect(
    tutorialSnapshotCatalog.map(({ chapter, slug, source }) => ({
      chapter,
      slug,
      path: source.path,
    })),
  ).toEqual([
    {
      chapter: 1,
      slug: "diagram-editor-canvas-scene",
      path: "packages/scenarios/src/tutorials/diagram-editor/01-canvas-scene.example.tsx",
    },
    {
      chapter: 2,
      slug: "diagram-editor-first-node",
      path: "packages/scenarios/src/tutorials/diagram-editor/02-first-node.example.tsx",
    },
    {
      chapter: 3,
      slug: "diagram-editor-connect-nodes",
      path: "packages/scenarios/src/tutorials/diagram-editor/03-connect-nodes.example.tsx",
    },
    {
      chapter: 4,
      slug: "diagram-editor-reusable-node",
      path: "packages/scenarios/src/tutorials/diagram-editor/04-reusable-node.example.tsx",
    },
    {
      chapter: 5,
      slug: "diagram-editor-editor-chrome",
      path: "packages/scenarios/src/tutorials/diagram-editor/05-editor-chrome.example.tsx",
    },
    {
      chapter: 6,
      slug: "diagram-editor-selection",
      path: "packages/scenarios/src/tutorials/diagram-editor/06-selection.example.tsx",
    },
    {
      chapter: 7,
      slug: "diagram-editor-dragging",
      path: "packages/scenarios/src/tutorials/diagram-editor/07-dragging.example.tsx",
    },
    {
      chapter: 8,
      slug: "diagram-editor-pan-and-zoom",
      path: "packages/scenarios/src/tutorials/diagram-editor/08-pan-and-zoom.example.tsx",
    },
  ]);
  expect(getWorkbenchEntryBySlug(learningExampleCatalog[0]!.slug)).toBe(
    learningExampleCatalog[0],
  );
  expect(() =>
    validateTutorialSnapshotCatalog([
      record(1, learningExampleCatalog[0]!.slug),
    ]),
  ).toThrow(/duplicate workbench slug/u);
});

it("rejects metadata outside the diagram-editor JSX snapshot contract", () => {
  expect(() =>
    validateTutorialSnapshotCatalog([
      {
        ...record(1),
        tutorial: "other",
      } as unknown as TutorialSnapshotCatalogEntry,
    ]),
  ).toThrow(/diagram-editor/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      {
        ...record(1),
        authoring: "createElement",
      } as unknown as TutorialSnapshotCatalogEntry,
    ]),
  ).toThrow(/JSX/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      {
        ...record(1),
        canvas: { width: 959, height: 600 },
      } as unknown as TutorialSnapshotCatalogEntry,
    ]),
  ).toThrow(/960 by 600/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      {
        ...record(1),
        source: {
          path: "packages/scenarios/src/learning/start/nope.example.tsx",
        },
      },
    ]),
  ).toThrow(/canonical tutorial source path/u);
});

it("rejects duplicate chapters and source paths", () => {
  expect(() =>
    validateTutorialSnapshotCatalog([record(1), record(1, "another-chapter")]),
  ).toThrow(/contiguous from 1/u);
  expect(() =>
    validateTutorialSnapshotCatalog([
      record(1),
      { ...record(2), source: record(1).source },
    ]),
  ).toThrow(/duplicate tutorial source path/u);
});

it("rejects tutorial modules without a default mount function", async () => {
  const invalid = {
    ...record(1),
    load: async () => ({}),
  } as TutorialSnapshotCatalogEntry;
  await expect(loadTutorialSnapshot(invalid)).rejects.toThrow(/default mount/u);
});

it("discovers learning and tutorial source paths as separate inventories", () => {
  expect(learningSourcePaths).toEqual(
    learningExampleCatalog.map((entry) => entry.source.path).sort(),
  );
  expect(tutorialSourcePaths).toEqual(
    tutorialSnapshotCatalog.map((entry) => entry.source.path),
  );
  expect(workbenchSourcePaths).toEqual(
    [...learningSourcePaths, ...tutorialSourcePaths].sort(),
  );
});

it("validates and loads every cataloged tutorial source", async () => {
  for (const entry of tutorialSnapshotCatalog) {
    const source = await loadWorkbenchSource(entry);
    expect(() =>
      validateLearningSourceText(source, {
        authoring: "jsx",
        label: `Tutorial snapshot "${entry.slug}"`,
        sourcePath: entry.source.path,
      }),
    ).not.toThrow();
    expect(typeof (await loadTutorialSnapshot(entry)).default).toBe("function");
  }
});

it.each(tutorialSnapshotCatalog)(
  "loads, mounts, paints, and disposes $slug",
  async (entry) => {
    const { canvas, controller } = await renderTutorialSnapshot(entry.slug);
    const pixels = canvas.getContext("2d")!.getImageData(0, 0, 960, 600).data;
    expect(pixels.some((channel) => channel !== 0)).toBe(true);
    controller.dispose();
    controller.dispose();
    removeTrackedController(controller);
  },
  15_000,
);

it("paints the Chapter 2 card text in the translated root position", async () => {
  const { textPaints } = await renderTutorialSnapshot(
    "diagram-editor-first-node",
  );
  const latestPaints = textPaints.slice(-5);
  expect(latestPaints).toContainEqual(
    expect.objectContaining({ text: "IDEA", x: 176, y: 270 }),
  );
  expect(latestPaints).toContainEqual(
    expect.objectContaining({ text: "Find the spark" }),
  );
});

it("paints both Chapter 3 node titles and the connection before the Idea card", async () => {
  const { paintOperations, textPaints } = await renderTutorialSnapshot(
    "diagram-editor-connect-nodes",
  );
  const lastFrame = Math.max(...textPaints.map(({ frame }) => frame));
  const titles = textPaints
    .filter(
      (paint) =>
        paint.frame === lastFrame &&
        (paint.text === "IDEA" || paint.text === "SKETCH"),
    )
    .map(({ text }) => text);
  expect(titles).toEqual(["IDEA", "SKETCH"]);

  const lastFrameOperations = paintOperations.filter(
    (operation) => operation.frame === lastFrame,
  );
  const inkStroke = lastFrameOperations.findIndex(
    (operation) =>
      operation.operation === "stroke" && operation.strokeStyle === "#17211d",
  );
  const firstIdeaFill = lastFrameOperations.findIndex(
    (operation) =>
      operation.operation === "fill" && operation.fillStyle === "#ff6b57",
  );
  expect(inkStroke).toBeGreaterThanOrEqual(0);
  expect(firstIdeaFill).toBeGreaterThan(inkStroke);
});

it("paints every Chapter 4 node title exactly once in the last frame", async () => {
  const { textPaints } = await renderTutorialSnapshot(
    "diagram-editor-reusable-node",
  );
  const lastFrame = Math.max(...textPaints.map(({ frame }) => frame));
  const titles = textPaints
    .filter(
      (paint) =>
        paint.frame === lastFrame &&
        ["IDEA", "SKETCH", "BUILD", "SHIP"].includes(paint.text),
    )
    .map(({ text }) => text);
  expect(titles).toEqual(["IDEA", "SKETCH", "BUILD", "SHIP"]);
});

it("allocates the Chapter 5 editor chrome regions through Absolute", async () => {
  const { rectanglePaints } = await renderTutorialSnapshot(
    "diagram-editor-editor-chrome",
  );
  const lastFrame = Math.max(...rectanglePaints.map(({ frame }) => frame));
  const regions = rectanglePaints.filter(
    ({ frame, x, width }) => frame === lastFrame && x === 0 && width === 960,
  );
  expect(regions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ y: 0, height: 56 }),
      expect.objectContaining({ y: 56, height: 512 }),
      expect.objectContaining({ y: 568, height: 32 }),
    ]),
  );
});

it("selects the Idea body from the Chapter 6 initial Sketch selection", async () => {
  const snapshot = await renderTutorialSnapshot("diagram-editor-selection");
  expect(snapshot.textPaints.map(({ text }) => text)).toContain(
    "SELECTED · SKETCH",
  );

  await clickLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const latestFrame = Math.max(
    ...snapshot.textPaints.map(({ frame }) => frame),
  );
  expect(
    snapshot.textPaints
      .filter(({ frame }) => frame === latestFrame)
      .map(({ text }) => text),
  ).toContain("SELECTED · IDEA");
});

function latestTitlePosition(
  paints: readonly TextPaint[],
  title: "IDEA" | "SKETCH" | "BUILD" | "SHIP",
): Readonly<{ x: number; y: number }> {
  const paint = paints.filter((candidate) => candidate.text === title).at(-1);
  if (!paint) throw new Error(`Missing ${title} title paint.`);
  return paint;
}

function latestStatus(paints: readonly TextPaint[]): string {
  const paint = paints
    .filter(({ text }) => text.startsWith("SELECTED") || text === "NO SELECTION")
    .at(-1);
  if (!paint) throw new Error("Missing status paint.");
  return paint.text;
}

async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

it("keeps a captured Chapter 7 node drag active outside its original body", async () => {
  const snapshot = await renderTutorialSnapshot("diagram-editor-dragging");
  const before = Object.fromEntries(
    (["IDEA", "SKETCH", "BUILD", "SHIP"] as const).map((title) => [
      title,
      latestTitlePosition(snapshot.textPaints, title),
    ]),
  );
  const connectorStart = snapshot.pathStartPaints.at(-4);
  let pointerId: number | undefined;
  snapshot.canvas.addEventListener(
    "pointerdown",
    (event) => {
      pointerId = event.pointerId;
    },
    { capture: true, once: true },
  );

  await dragPointerLogicalPoint(
    snapshot.canvas,
    { x: 176, y: 278 },
    { x: 360, y: 450 },
    [{ x: 280, y: 420 }],
  );
  await nextPaint();

  expect(latestTitlePosition(snapshot.textPaints, "IDEA")).toMatchObject({
    x: before.IDEA.x + 184,
    y: before.IDEA.y + 172,
  });
  for (const title of ["SKETCH", "BUILD", "SHIP"] as const) {
    expect(latestTitlePosition(snapshot.textPaints, title)).toMatchObject(
      { x: before[title].x, y: before[title].y },
    );
  }
  expect(snapshot.pathStartPaints.at(-4)).toMatchObject({
    x: connectorStart!.x + 184,
    y: connectorStart!.y + 172,
  });
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");
  expect(pointerId).toBeTypeOf("number");
  expect(snapshot.canvas.hasPointerCapture(pointerId!)).toBe(false);
});

it("clears a Chapter 7 node drag after cancellation or capture loss", async () => {
  const snapshot = await renderTutorialSnapshot("diagram-editor-dragging");
  let pointerId: number | undefined;
  snapshot.canvas.addEventListener(
    "pointerdown",
    (event) => {
      pointerId = event.pointerId;
    },
    { capture: true, once: true },
  );
  await pointerDownLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
  await pointerMoveLogicalPoint(snapshot.canvas, { x: 280, y: 420 });
  await nextPaint();
  const afterCancellation = latestTitlePosition(snapshot.textPaints, "IDEA");
  snapshot.canvas.dispatchEvent(
    new PointerEvent("pointercancel", {
      bubbles: true,
      cancelable: true,
      pointerId: pointerId!,
    }),
  );
  await pointerUpLogicalPoint(snapshot.canvas, { x: 280, y: 420 });
  await pointerMoveLogicalPoint(snapshot.canvas, { x: 600, y: 500 });
  await nextPaint();
  expect(latestTitlePosition(snapshot.textPaints, "IDEA")).toMatchObject({
    x: afterCancellation.x,
    y: afterCancellation.y,
  });

  snapshot.controller.dispose();
  removeTrackedController(snapshot.controller);
  snapshot.canvas.remove();
  const captureLoss = await renderTutorialSnapshot("diagram-editor-dragging");
  let lostPointerId: number | undefined;
  captureLoss.canvas.addEventListener("pointerdown", (event) => {
    lostPointerId = event.pointerId;
  }, { capture: true, once: true });
  await pointerDownLogicalPoint(captureLoss.canvas, { x: 176, y: 278 });
  await nextPaint();
  expect(captureLoss.canvas.hasPointerCapture(lostPointerId!)).toBe(true);
  const afterLoss = latestTitlePosition(captureLoss.textPaints, "IDEA");
  let nativeLosses = 0;
  captureLoss.canvas.addEventListener("lostpointercapture", () => {
    nativeLosses += 1;
  });
  captureLoss.canvas.releasePointerCapture(lostPointerId!);
  await nextPaint();
  // Chromium's CDP mouse transport establishes native capture but does not
  // deliver a native loss after direct release. Keep that harness limitation
  // explicit rather than manufacturing the terminal event.
  expect(nativeLosses).toBe(0);
  await pointerUpLogicalPoint(captureLoss.canvas, { x: 280, y: 420 });
  await pointerMoveLogicalPoint(captureLoss.canvas, { x: 600, y: 500 });
  await nextPaint();
  expect(latestTitlePosition(captureLoss.textPaints, "IDEA")).toMatchObject({
    x: afterLoss.x,
    y: afterLoss.y,
  });
});

it("pans, pointer-zooms, clamps, and resets Chapter 8 without changing node data", async () => {
  const snapshot = await renderTutorialSnapshot("diagram-editor-pan-and-zoom");
  const initial = Object.fromEntries(
    (["IDEA", "SKETCH", "BUILD", "SHIP"] as const).map((title) => [
      title,
      latestTitlePosition(snapshot.textPaints, title),
    ]),
  );
  await dragPointerLogicalPoint(snapshot.canvas, { x: 176, y: 278 }, { x: 196, y: 298 });
  await nextPaint();
  expect(latestTitlePosition(snapshot.textPaints, "IDEA")).toMatchObject({
    x: initial.IDEA.x + 20,
    y: initial.IDEA.y + 20,
  });
  const before = Object.fromEntries(
    (["IDEA", "SKETCH", "BUILD", "SHIP"] as const).map((title) => [
      title,
      latestTitlePosition(snapshot.textPaints, title),
    ]),
  );
  await dragPointerLogicalPoint(snapshot.canvas, { x: 40, y: 520 }, { x: 140, y: 470 });
  await nextPaint();
  for (const title of ["IDEA", "SKETCH", "BUILD", "SHIP"] as const) {
    expect(latestTitlePosition(snapshot.textPaints, title)).toMatchObject({
      x: before[title].x + 100,
      y: before[title].y - 50,
    });
  }

  let wheelPrevented = false;
  snapshot.canvas.addEventListener(
    "wheel",
    (event) => {
      wheelPrevented = event.defaultPrevented;
    },
    { once: true },
  );
  const beforeZoom = Object.fromEntries(
    (["IDEA", "SKETCH", "BUILD", "SHIP"] as const).map((title) => [
      title,
      latestTitlePosition(snapshot.textPaints, title),
    ]),
  );
  await wheelLogicalPoint(snapshot.canvas, { x: 480, y: 300 }, -160);
  await nextPaint();
  const afterZoom = Object.fromEntries(
    (["IDEA", "SKETCH", "BUILD", "SHIP"] as const).map((title) => [
      title,
      latestTitlePosition(snapshot.textPaints, title),
    ]),
  );
  expect(wheelPrevented).toBe(true);
  const beforePan = {
    x: beforeZoom.SKETCH.x - initial.SKETCH.x,
    y: beforeZoom.SKETCH.y - initial.SKETCH.y,
  };
  const beforeAnchor = {
    x: 480 - beforePan.x,
    y: 300 - 56 - beforePan.y,
  };
  const zoom =
    (afterZoom.SKETCH.x - afterZoom.BUILD.x) /
    (initial.SKETCH.x - initial.BUILD.x);
  const afterPan = {
    x: afterZoom.SKETCH.x - initial.SKETCH.x * zoom,
    y:
      afterZoom.SKETCH.y -
      56 -
      (initial.SKETCH.y - 56) * zoom,
  };
  const afterAnchor = {
    x: (480 - afterPan.x) / zoom,
    y: (300 - 56 - afterPan.y) / zoom,
  };
  expect(Math.hypot(
    afterAnchor.x - beforeAnchor.x,
    afterAnchor.y - beforeAnchor.y,
  )).toBeLessThanOrEqual(0.5);

  for (let index = 0; index < 20; index += 1) {
    await wheelLogicalPoint(snapshot.canvas, { x: 480, y: 300 }, -160);
  }
  await nextPaint();
  expect(snapshot.textPaints.at(-1)?.text).toMatch(/ZOOM · 180%/u);
  for (let index = 0; index < 30; index += 1) {
    await wheelLogicalPoint(snapshot.canvas, { x: 480, y: 300 }, 160);
  }
  await nextPaint();
  expect(snapshot.textPaints.at(-1)?.text).toMatch(/ZOOM · 60%/u);

  window.scrollTo({ left: 160, top: 0 });
  await clickLogicalPoint(snapshot.canvas, { x: 878, y: 28 });
  await nextPaint();
  await nextPaint();
  expect(latestTitlePosition(snapshot.textPaints, "IDEA")).toMatchObject({
    x: initial.IDEA.x + 20,
    y: initial.IDEA.y + 20,
  });
});
