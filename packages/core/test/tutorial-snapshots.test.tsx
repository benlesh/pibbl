import {
  getWorkbenchEntryBySlug,
  getTutorialSnapshotBySlug,
  learningExampleCatalog,
  loadTutorialSnapshot,
  tutorialSnapshotCatalog,
  validateTutorialSnapshotCatalog,
  type TutorialSnapshotCatalogEntry,
} from "@pibbl/scenarios";
import {
  pibbl,
  useEventTarget,
  useRectPath,
  useRef,
  useSignal,
  createElement,
  Rectangle,
} from "@pibbl/core";
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
  pressKey,
  tab,
  wheelLogicalPoint,
} from "./support/user-input";
import {
  validateDiagramEditorTutorialSourceText,
  validateLearningSourceText,
} from "../../../tooling/learning-source-contract";

const mountedControllers: Array<{ dispose: () => void }> = [];

interface TextPaint {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly textBaseline: CanvasTextBaseline;
  readonly frame: number;
}

interface PaintOperation {
  readonly frame: number;
  readonly operation: "clearRect" | "fill" | "stroke";
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly lineWidth: number;
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
  readonly context: CanvasRenderingContext2D;
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
  const recordPathRect: typeof Path2D.prototype.rect = function (
    this: Path2D,
    x,
    y,
    width,
    height,
  ) {
    rectanglePaths.set(this, { x, y, width, height });
    pathRect.call(this, x, y, width, height);
  };
  Path2D.prototype.rect = recordPathRect;
  const pathMoveTo = Path2D.prototype.moveTo;
  const recordPathMoveTo: typeof Path2D.prototype.moveTo = function (
    this: Path2D,
    x,
    y,
  ) {
    pathStarts.set(this, { x, y });
    pathMoveTo.call(this, x, y);
  };
  Path2D.prototype.moveTo = recordPathMoveTo;
  let pathsRestored = false;
  const restorePathMethods = (): void => {
    if (pathsRestored) return;
    pathsRestored = true;
    if (Path2D.prototype.rect === recordPathRect) {
      Path2D.prototype.rect = pathRect;
    }
    if (Path2D.prototype.moveTo === recordPathMoveTo) {
      Path2D.prototype.moveTo = pathMoveTo;
    }
  };
  const clearRect = context.clearRect.bind(context);
  context.clearRect = function (x, y, width, height) {
    frame += 1;
    paintOperations.push({
      frame,
      operation: "clearRect",
      fillStyle: String(this.fillStyle),
      strokeStyle: String(this.strokeStyle),
      lineWidth: this.lineWidth,
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
      lineWidth: this.lineWidth,
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
      lineWidth: this.lineWidth,
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
    } else stroke();
  };

  const textPaints: TextPaint[] = [];
  const fillText = context.fillText;
  context.fillText = function (...args) {
    const [text, x, y] = args;
    const point = new DOMPoint(x, y).matrixTransform(this.getTransform());
    textPaints.push({
      text,
      x: point.x,
      y: point.y,
      textBaseline: this.textBaseline,
      frame,
    });
    fillText.apply(this, args);
  };

  let mountedController: { dispose: () => void } | undefined;
  try {
    const module = await loadTutorialSnapshot(entry);
    const runtimeController = module.default(canvas);
    mountedController = {
      dispose(): void {
        try {
          runtimeController.dispose();
        } finally {
          restorePathMethods();
        }
      },
    };
    mountedControllers.push(mountedController);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  } finally {
    if (!mountedController) restorePathMethods();
  }

  return {
    canvas,
    context,
    controller: mountedController,
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
const canonicalSnapshots = [
  ["canvas-scene", "canvas-scene"],
  ["first-node", "first-node"],
  ["connect-nodes", "connect-nodes"],
  ["reusable-node", "reusable-node"],
  ["editor-chrome", "editor-chrome"],
  ["selection", "selection"],
  ["dragging", "dragging"],
  ["pan-and-zoom", "pan-and-zoom"],
  ["viewport-and-layer", "viewport-and-layer"],
  ["filters", "filters"],
  ["keyboard-interaction", "keyboard-interaction"],
  ["finished", "finished-editor"],
] as const;
const record = (
  chapter: number,
  slug = `diagram-editor-${canonicalSnapshots[chapter - 1]?.[0] ?? `chapter-${String(chapter)}`}`,
): TutorialSnapshotCatalogEntry => ({
  slug,
  tutorial: "diagram-editor",
  chapter,
  title: `Chapter ${String(chapter)}`,
  authoring: "jsx",
  canvas: { width: 960, height: 600 },
  source: {
    path: `packages/scenarios/src/tutorials/diagram-editor/${String(chapter).padStart(2, "0")}-${canonicalSnapshots[chapter - 1]?.[1] ?? `chapter-${String(chapter)}`}.example.tsx`,
  },
  load: module,
});
const records = (): TutorialSnapshotCatalogEntry[] =>
  canonicalSnapshots.map((_snapshot, index) => record(index + 1));
const withRecord = (
  chapter: number,
  replacement: TutorialSnapshotCatalogEntry,
): TutorialSnapshotCatalogEntry[] =>
  records().map((entry) => (entry.chapter === chapter ? replacement : entry));

it("validates the exact ordered tutorial and rejects chapter gaps", () => {
  expect(validateTutorialSnapshotCatalog(records())).toHaveLength(12);
  expect(() =>
    validateTutorialSnapshotCatalog(withRecord(2, record(3))),
  ).toThrow(/contiguous from 1/u);
});

it("requires the exact twelve-entry diagram-editor catalog", () => {
  expect(() =>
    validateTutorialSnapshotCatalog(tutorialSnapshotCatalog.slice(0, -1)),
  ).toThrow(/exactly 12/u);
  expect(() =>
    validateTutorialSnapshotCatalog([...tutorialSnapshotCatalog, record(13)]),
  ).toThrow(/exactly 12/u);
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
    {
      chapter: 9,
      slug: "diagram-editor-viewport-and-layer",
      path: "packages/scenarios/src/tutorials/diagram-editor/09-viewport-and-layer.example.tsx",
    },
    {
      chapter: 10,
      slug: "diagram-editor-filters",
      path: "packages/scenarios/src/tutorials/diagram-editor/10-filters.example.tsx",
    },
    {
      chapter: 11,
      slug: "diagram-editor-keyboard-interaction",
      path: "packages/scenarios/src/tutorials/diagram-editor/11-keyboard-interaction.example.tsx",
    },
    {
      chapter: 12,
      slug: "diagram-editor-finished",
      path: "packages/scenarios/src/tutorials/diagram-editor/12-finished-editor.example.tsx",
    },
  ]);
  expect(getWorkbenchEntryBySlug(learningExampleCatalog[0]!.slug)).toBe(
    learningExampleCatalog[0],
  );
  expect(() =>
    validateTutorialSnapshotCatalog(
      withRecord(1, record(1, learningExampleCatalog[0]!.slug)),
    ),
  ).toThrow(/duplicate workbench slug/u);
});

it("rejects metadata outside the diagram-editor JSX snapshot contract", () => {
  expect(() =>
    validateTutorialSnapshotCatalog(
      withRecord(1, {
        ...record(1),
        tutorial: "other",
      } as unknown as TutorialSnapshotCatalogEntry),
    ),
  ).toThrow(/diagram-editor/u);
  expect(() =>
    validateTutorialSnapshotCatalog(
      withRecord(1, {
        ...record(1),
        authoring: "createElement",
      } as unknown as TutorialSnapshotCatalogEntry),
    ),
  ).toThrow(/JSX/u);
  expect(() =>
    validateTutorialSnapshotCatalog(
      withRecord(1, {
        ...record(1),
        canvas: { width: 959, height: 600 },
      } as unknown as TutorialSnapshotCatalogEntry),
    ),
  ).toThrow(/960 by 600/u);
  expect(() =>
    validateTutorialSnapshotCatalog(
      withRecord(1, {
        ...record(1),
        source: {
          path: "packages/scenarios/src/learning/start/nope.example.tsx",
        },
      }),
    ),
  ).toThrow(/filename chapter prefix/u);
});

it("rejects duplicate chapters", () => {
  expect(() =>
    validateTutorialSnapshotCatalog(withRecord(2, record(1))),
  ).toThrow(/contiguous from 1/u);
});

it("rejects filename-order and stable slug/path correspondence mutations", () => {
  expect(() =>
    validateTutorialSnapshotCatalog(
      withRecord(2, {
        ...record(2),
        source: {
          path: "packages/scenarios/src/tutorials/diagram-editor/03-first-node.example.tsx",
        },
      }),
    ),
  ).toThrow(/filename chapter prefix 02/u);
  expect(() =>
    validateTutorialSnapshotCatalog(
      withRecord(2, { ...record(2), slug: "diagram-editor-wrong" }),
    ),
  ).toThrow(/stable diagram-editor slug\/path correspondence/u);
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
    if (entry.chapter >= 4) {
      expect(() =>
        validateDiagramEditorTutorialSourceText(source, {
          chapter: entry.chapter,
          label: `Tutorial snapshot "${entry.slug}"`,
        }),
      ).not.toThrow();
    }
    expect(typeof (await loadTutorialSnapshot(entry)).default).toBe("function");
  }
});

it("rejects cumulative vocabulary and target-ownership mutations", async () => {
  const filters = getTutorialSnapshotBySlug("diagram-editor-filters")!;
  const filtersSource = await loadWorkbenchSource(filters);
  expect(() =>
    validateDiagramEditorTutorialSourceText(
      filtersSource.replace("function NodeCard", "function Card"),
      { chapter: filters.chapter, label: "mutated Chapter 10" },
    ),
  ).toThrow(/missing NodeCard/u);

  const keyboard = getTutorialSnapshotBySlug(
    "diagram-editor-keyboard-interaction",
  )!;
  const keyboardSource = await loadWorkbenchSource(keyboard);
  expect(() =>
    validateDiagramEditorTutorialSourceText(
      keyboardSource.replace(
        "const dragSession = useRef<NodeDragSession | null>(null);",
        "const dragSession = { current: null as NodeDragSession | null };",
      ),
      { chapter: keyboard.chapter, label: "mutated Chapter 11" },
    ),
  ).toThrow(/drag ownership in NodeCard/u);
});

it("restores both instrumented Path2D methods when a snapshot is disposed", async () => {
  const pathRect = Path2D.prototype.rect;
  const pathMoveTo = Path2D.prototype.moveTo;
  const snapshot = await renderTutorialSnapshot("diagram-editor-canvas-scene");

  snapshot.controller.dispose();
  removeTrackedController(snapshot.controller);

  expect(Path2D.prototype.rect).toBe(pathRect);
  expect(Path2D.prototype.moveTo).toBe(pathMoveTo);
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

it("centers the finished editor Reset View label within its button", async () => {
  const { textPaints } = await renderTutorialSnapshot(
    "diagram-editor-finished",
  );
  expect(textPaints.find(({ text }) => text === "RESET VIEW")).toMatchObject({
    x: 878,
    y: 28,
    textBaseline: "middle",
  });
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
    .filter(
      ({ text }) => text.startsWith("SELECTED") || text === "NO SELECTION",
    )
    .at(-1);
  if (!paint) throw new Error("Missing status paint.");
  return paint.text;
}

async function nextPaint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

it("keeps every Chapter 4-12 node coordinate aligned with the canonical model", async () => {
  const expected = {
    IDEA: { x: 176, y: 270 },
    SKETCH: { x: 410, y: 182 },
    BUILD: { x: 476, y: 408 },
    SHIP: { x: 780, y: 300 },
  } as const;

  for (const entry of tutorialSnapshotCatalog.slice(3)) {
    const snapshot = await renderTutorialSnapshot(entry.slug);
    await clickLogicalPoint(snapshot.canvas, { x: 300, y: 520 });
    await nextPaint();
    for (const title of ["IDEA", "SKETCH", "BUILD", "SHIP"] as const) {
      expect(
        latestTitlePosition(snapshot.textPaints, title),
        `${entry.slug} ${title}`,
      ).toMatchObject(expected[title]);
    }
    snapshot.controller.dispose();
    removeTrackedController(snapshot.controller);
    snapshot.canvas.remove();
  }
});

it("removes an active target-local drag before pointer-up without a ghost loss or cursor", async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 180;
  document.body.appendChild(canvas);

  let removeTarget = (): void => {
    throw new Error("Removal harness has not mounted.");
  };
  let moves = 0;
  let losses = 0;

  function RemovableTarget() {
    const pointerId = useRef<number>();
    const dragging = useSignal(false);
    const finish = (): void => {
      pointerId.current = undefined;
      dragging.set(false);
    };
    useEventTarget(
      {
        onPointerDown(event) {
          pointerId.current = event.pointerId;
          dragging.set(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        },
        onPointerMove(event) {
          if (pointerId.current === event.pointerId) moves += 1;
        },
        onPointerUp: finish,
        onPointerCancel: finish,
        onLostPointerCapture() {
          losses += 1;
          finish();
        },
      },
      {
        path: useRectPath(40, 40, 120, 80),
        fill: true,
        cursor: dragging.get() ? "grabbing" : "grab",
      },
    );
    return createElement(Rectangle, {
      pointerEvents: "none",
      style: { left: 40, top: 40, width: 120, height: 80, fill: "#ff6b57" },
    });
  }

  function RemovalHarness() {
    const visible = useSignal(true);
    removeTarget = () => visible.set(false);
    return visible.get() ? createElement(RemovableTarget, {}) : null;
  }

  const controller = pibbl(canvas, createElement(RemovalHarness, {}));
  mountedControllers.push(controller);
  await nextPaint();
  await pointerMoveLogicalPoint(canvas, { x: 80, y: 80 });
  await pointerDownLogicalPoint(canvas, { x: 80, y: 80 });
  await nextPaint();
  expect(canvas.style.cursor).toBe("grabbing");
  const movesBeforeRemoval = moves;

  removeTarget();
  await nextPaint();
  expect(canvas.style.cursor).toBe("");
  await pointerMoveLogicalPoint(canvas, { x: 100, y: 100 });
  await nextPaint();
  expect(moves).toBe(movesBeforeRemoval);
  expect(losses).toBe(0);
  await pointerUpLogicalPoint(canvas, { x: 100, y: 100 });
});

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
    expect(latestTitlePosition(snapshot.textPaints, title)).toMatchObject({
      x: before[title].x,
      y: before[title].y,
    });
  }
  expect(snapshot.pathStartPaints.at(-4)).toMatchObject({
    x: connectorStart!.x + 184,
    y: connectorStart!.y + 172,
  });
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");
  expect(pointerId).toBeTypeOf("number");
  expect(snapshot.canvas.hasPointerCapture(pointerId!)).toBe(false);
});

it("clears a Chapter 7 node drag after pointer cancellation", async () => {
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
});

it("clears Chapter 7 app drag ownership on lostpointercapture before pointer-up", async () => {
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
  await nextPaint();
  expect(snapshot.canvas.hasPointerCapture(pointerId!)).toBe(true);
  const beforeLoss = latestTitlePosition(snapshot.textPaints, "IDEA");
  snapshot.canvas.dispatchEvent(
    new PointerEvent("lostpointercapture", {
      bubbles: true,
      pointerId: pointerId!,
    }),
  );
  await pointerMoveLogicalPoint(snapshot.canvas, { x: 190, y: 290 });
  await nextPaint();
  expect(latestTitlePosition(snapshot.textPaints, "IDEA")).toMatchObject(
    beforeLoss,
  );
  await pointerUpLogicalPoint(snapshot.canvas, { x: 190, y: 290 });
});

it("uses Chapter 7 pointer-up fallback when CDP direct release omits native capture loss", async () => {
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
  await nextPaint();
  expect(snapshot.canvas.hasPointerCapture(pointerId!)).toBe(true);
  let nativeLosses = 0;
  snapshot.canvas.addEventListener("lostpointercapture", () => {
    nativeLosses += 1;
  });
  snapshot.canvas.releasePointerCapture(pointerId!);
  await nextPaint();
  // Chromium's CDP mouse transport establishes native capture but does not
  // deliver a native loss after direct release. Keep that harness limitation
  // explicit rather than manufacturing the terminal event.
  expect(nativeLosses).toBe(0);
  const beforePointerUp = latestTitlePosition(snapshot.textPaints, "IDEA");
  await pointerUpLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
  await pointerMoveLogicalPoint(snapshot.canvas, { x: 190, y: 290 });
  await nextPaint();
  expect(latestTitlePosition(snapshot.textPaints, "IDEA")).toMatchObject(
    beforePointerUp,
  );
});

it("pans, pointer-zooms, clamps, and resets Chapter 8 without changing node data", async () => {
  const snapshot = await renderTutorialSnapshot("diagram-editor-pan-and-zoom");
  const initial = Object.fromEntries(
    (["IDEA", "SKETCH", "BUILD", "SHIP"] as const).map((title) => [
      title,
      latestTitlePosition(snapshot.textPaints, title),
    ]),
  );
  await dragPointerLogicalPoint(
    snapshot.canvas,
    { x: 176, y: 278 },
    { x: 196, y: 298 },
  );
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
  await dragPointerLogicalPoint(
    snapshot.canvas,
    { x: 40, y: 520 },
    { x: 140, y: 470 },
  );
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
    y: afterZoom.SKETCH.y - 56 - (initial.SKETCH.y - 56) * zoom,
  };
  const afterAnchor = {
    x: (480 - afterPan.x) / zoom,
    y: (300 - 56 - afterPan.y) / zoom,
  };
  expect(
    Math.hypot(afterAnchor.x - beforeAnchor.x, afterAnchor.y - beforeAnchor.y),
  ).toBeLessThanOrEqual(0.5);

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
}, 30_000);

it("clips Chapter 9 transformed content while reusing its stable grid layer", async () => {
  const offscreenPrototype = OffscreenCanvasRenderingContext2D.prototype;
  const fill = offscreenPrototype.fill;
  let offscreenFills = 0;
  function countOffscreenFill(
    this: OffscreenCanvasRenderingContext2D,
    fillRule?: CanvasFillRule,
  ): void;
  function countOffscreenFill(
    this: OffscreenCanvasRenderingContext2D,
    path: Path2D,
    fillRule?: CanvasFillRule,
  ): void;
  function countOffscreenFill(
    this: OffscreenCanvasRenderingContext2D,
    pathOrFillRule?: Path2D | CanvasFillRule,
    fillRule?: CanvasFillRule,
  ): void {
    offscreenFills += 1;
    Reflect.apply(
      fill,
      this,
      pathOrFillRule instanceof Path2D
        ? [pathOrFillRule, fillRule]
        : pathOrFillRule === undefined
          ? []
          : [pathOrFillRule],
    );
  }
  offscreenPrototype.fill = countOffscreenFill;
  try {
    const snapshot = await renderTutorialSnapshot(
      "diagram-editor-viewport-and-layer",
    );
    const initialIdea = latestTitlePosition(snapshot.textPaints, "IDEA");
    const initialGridFills = offscreenFills;

    await dragPointerLogicalPoint(
      snapshot.canvas,
      { x: 300, y: 510 },
      { x: 380, y: 470 },
    );
    await nextPaint();
    await nextPaint();
    expect(offscreenFills).toBe(initialGridFills);
    expect(latestTitlePosition(snapshot.textPaints, "IDEA")).toMatchObject({
      x: initialIdea.x + 80,
      y: initialIdea.y - 40,
    });

    await dragPointerLogicalPoint(
      snapshot.canvas,
      { x: 300, y: 510 },
      { x: 300, y: 270 },
    );
    await nextPaint();
    await clickLogicalPoint(snapshot.canvas, { x: 200, y: 30 });
    await nextPaint();
    expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · SKETCH");

    await clickLogicalPoint(snapshot.canvas, { x: 878, y: 28 });
    await nextPaint();
    await clickLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
    await nextPaint();
    expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");
  } finally {
    offscreenPrototype.fill = fill;
  }
});

it("filters exactly one selected Chapter 10 card without enlarging its hit geometry", async () => {
  const offscreenPrototype = OffscreenCanvasRenderingContext2D.prototype;
  const offscreenDrawImage = offscreenPrototype.drawImage;
  const rootPrototype = CanvasRenderingContext2D.prototype;
  const rootDrawImage = rootPrototype.drawImage;
  const transferToImageBitmap = OffscreenCanvas.prototype.transferToImageBitmap;
  const pathRect = Path2D.prototype.rect;
  const pathRoundRect = Path2D.prototype.roundRect;
  const transferredSurfaces = new WeakMap<ImageBitmap, OffscreenCanvas>();
  const pathRectangles = new WeakMap<
    Path2D,
    Readonly<{ x: number; y: number; width: number; height: number }>
  >();
  const offscreenDraws: Array<{
    readonly filter: string;
    readonly surface: OffscreenCanvas;
    readonly source: OffscreenCanvas | undefined;
  }> = [];
  const offscreenFills: Array<{
    readonly surface: OffscreenCanvas;
    readonly fillStyle: string;
    readonly rectangle: Readonly<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  }> = [];
  const offscreenFill = offscreenPrototype.fill;
  const rootComposites: Array<{
    readonly context: CanvasRenderingContext2D;
    readonly surface: OffscreenCanvas | undefined;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }> = [];
  Path2D.prototype.rect = function (x, y, width, height) {
    pathRectangles.set(this, { x, y, width, height });
    pathRect.call(this, x, y, width, height);
  };
  Path2D.prototype.roundRect = function (x, y, width, height, radii) {
    pathRectangles.set(this, { x, y, width, height });
    pathRoundRect.call(this, x, y, width, height, radii);
  };
  function recordOffscreenDrawImage(
    this: OffscreenCanvasRenderingContext2D,
    image: CanvasImageSource,
    dx: number,
    dy: number,
  ): void;
  function recordOffscreenDrawImage(
    this: OffscreenCanvasRenderingContext2D,
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  function recordOffscreenDrawImage(
    this: OffscreenCanvasRenderingContext2D,
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  function recordOffscreenDrawImage(
    this: OffscreenCanvasRenderingContext2D,
    image: CanvasImageSource,
    first: number,
    second: number,
    ...rest: number[]
  ): void {
    offscreenDraws.push({
      filter: this.filter,
      surface: this.canvas,
      source: image instanceof OffscreenCanvas ? image : undefined,
    });
    if (rest.length === 0 || rest.length === 2 || rest.length === 6)
      Reflect.apply(offscreenDrawImage, this, [image, first, second, ...rest]);
    else
      throw new Error(`Unexpected drawImage arity ${String(rest.length + 3)}.`);
  }
  offscreenPrototype.drawImage = recordOffscreenDrawImage;
  function recordOffscreenFill(
    this: OffscreenCanvasRenderingContext2D,
    fillRule?: CanvasFillRule,
  ): void;
  function recordOffscreenFill(
    this: OffscreenCanvasRenderingContext2D,
    path: Path2D,
    fillRule?: CanvasFillRule,
  ): void;
  function recordOffscreenFill(
    this: OffscreenCanvasRenderingContext2D,
    pathOrFillRule?: Path2D | CanvasFillRule,
    fillRule?: CanvasFillRule,
  ): void {
    if (pathOrFillRule instanceof Path2D) {
      const rectangle = pathRectangles.get(pathOrFillRule);
      if (rectangle) {
        offscreenFills.push({
          surface: this.canvas,
          fillStyle: String(this.fillStyle),
          rectangle,
        });
      }
    }
    Reflect.apply(
      offscreenFill,
      this,
      pathOrFillRule instanceof Path2D
        ? [pathOrFillRule, fillRule]
        : pathOrFillRule === undefined
          ? []
          : [pathOrFillRule],
    );
  }
  offscreenPrototype.fill = recordOffscreenFill;
  OffscreenCanvas.prototype.transferToImageBitmap = function () {
    const bitmap = transferToImageBitmap.call(this);
    transferredSurfaces.set(bitmap, this);
    return bitmap;
  };
  function recordRootDrawImage(
    this: CanvasRenderingContext2D,
    image: CanvasImageSource,
    dx: number,
    dy: number,
  ): void;
  function recordRootDrawImage(
    this: CanvasRenderingContext2D,
    image: CanvasImageSource,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  function recordRootDrawImage(
    this: CanvasRenderingContext2D,
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  function recordRootDrawImage(
    this: CanvasRenderingContext2D,
    image: CanvasImageSource,
    first: number,
    second: number,
    ...rest: number[]
  ): void {
    const surface =
      image instanceof OffscreenCanvas
        ? image
        : image instanceof ImageBitmap
          ? transferredSurfaces.get(image)
          : undefined;
    const [x, y, width, height] =
      rest.length === 0
        ? [first, second, surface?.width, surface?.height]
        : rest.length === 2
          ? [first, second, rest[0], rest[1]]
          : [rest[2], rest[3], rest[4], rest[5]];
    rootComposites.push({
      context: this,
      surface,
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    });
    if (rest.length === 0 || rest.length === 2 || rest.length === 6)
      Reflect.apply(rootDrawImage, this, [image, first, second, ...rest]);
    else
      throw new Error(`Unexpected drawImage arity ${String(rest.length + 3)}.`);
  }
  rootPrototype.drawImage = recordRootDrawImage;
  const filterBoundariesFrom = (start: number) =>
    offscreenDraws.slice(start).filter(({ filter }) => filter !== "none");
  const assertOneBoundaryAt = (
    snapshot: Awaited<ReturnType<typeof renderTutorialSnapshot>>,
    boundary: {
      readonly filter: string;
      readonly surface: OffscreenCanvas;
      readonly source: OffscreenCanvas | undefined;
    },
    card: Readonly<{
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }>,
  ): void => {
    expect(boundary.filter).toBe(
      "drop-shadow(6px 8px 10px rgb(23 33 29 / 35%))",
    );
    expect(boundary.source).toBeDefined();
    const bodyPaints = offscreenFills.filter(
      (paint) =>
        paint.surface === boundary.source && paint.fillStyle === card.color,
    );
    expect(bodyPaints.length).toBeGreaterThan(0);
    for (const paint of bodyPaints) {
      expect(paint).toEqual({
        surface: boundary.source,
        fillStyle: card.color,
        rectangle: { x: 0, y: 0, width: card.width, height: card.height },
      });
    }
    const composites = rootComposites.filter(
      (candidate) =>
        candidate.context === snapshot.context &&
        candidate.surface === boundary.surface,
    );
    expect(composites.length).toBeGreaterThan(0);
    for (const composite of composites) {
      expect(composite.x).toBeLessThanOrEqual(card.x);
      expect(composite.y).toBeLessThanOrEqual(card.y);
      expect(composite.x + composite.width).toBeGreaterThanOrEqual(
        card.x + card.width,
      );
      expect(composite.y + composite.height).toBeGreaterThanOrEqual(
        card.y + card.height,
      );
    }
  };
  try {
    const snapshot = await renderTutorialSnapshot("diagram-editor-filters");
    const initialBoundaries = filterBoundariesFrom(0);
    expect(initialBoundaries).toHaveLength(1);
    expect(offscreenDraws).toHaveLength(1);
    assertOneBoundaryAt(snapshot, initialBoundaries[0]!, {
      x: 326,
      y: 148,
      width: 168,
      height: 84,
      color: "#f7c948",
    });

    const afterInitial = offscreenDraws.length;
    await clickLogicalPoint(snapshot.canvas, { x: 300, y: 510 });
    await nextPaint();
    expect(latestStatus(snapshot.textPaints)).toBe("NO SELECTION");
    expect(offscreenDraws.slice(afterInitial)).toEqual([]);
    const directNodePositions = Object.fromEntries(
      (["IDEA", "SKETCH", "BUILD", "SHIP"] as const).map((title) => [
        title,
        latestTitlePosition(snapshot.textPaints, title),
      ]),
    );

    const afterClear = offscreenDraws.length;
    await clickLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
    await nextPaint();
    expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");
    const ideaBoundaries = filterBoundariesFrom(afterClear);
    expect(ideaBoundaries).toHaveLength(1);
    expect(offscreenDraws.slice(afterClear)).toHaveLength(1);
    assertOneBoundaryAt(snapshot, ideaBoundaries[0]!, {
      x: 92,
      y: 236,
      width: 168,
      height: 84,
      color: "#ff6b57",
    });
    for (const title of ["SKETCH", "BUILD", "SHIP"] as const) {
      expect(latestTitlePosition(snapshot.textPaints, title)).toMatchObject({
        x: directNodePositions[title].x,
        y: directNodePositions[title].y,
      });
    }

    const afterIdea = offscreenDraws.length;
    await clickLogicalPoint(snapshot.canvas, { x: 268, y: 278 });
    await nextPaint();
    expect(latestStatus(snapshot.textPaints)).toBe("NO SELECTION");
    expect(offscreenDraws.slice(afterIdea)).toEqual([]);

    const afterShadow = offscreenDraws.length;
    await clickLogicalPoint(snapshot.canvas, { x: 410, y: 190 });
    await nextPaint();
    expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · SKETCH");
    const sketchBoundaries = filterBoundariesFrom(afterShadow);
    expect(sketchBoundaries).toHaveLength(1);
    expect(offscreenDraws.slice(afterShadow)).toHaveLength(1);
    assertOneBoundaryAt(snapshot, sketchBoundaries[0]!, {
      x: 326,
      y: 148,
      width: 168,
      height: 84,
      color: "#f7c948",
    });
    for (const title of ["IDEA", "BUILD", "SHIP"] as const) {
      expect(latestTitlePosition(snapshot.textPaints, title)).toMatchObject({
        x: directNodePositions[title].x,
        y: directNodePositions[title].y,
      });
    }
  } finally {
    offscreenPrototype.drawImage = offscreenDrawImage;
    offscreenPrototype.fill = offscreenFill;
    OffscreenCanvas.prototype.transferToImageBitmap = transferToImageBitmap;
    rootPrototype.drawImage = rootDrawImage;
    Path2D.prototype.rect = pathRect;
    Path2D.prototype.roundRect = pathRoundRect;
  }
});

it("traverses, activates, and visibly focuses Chapter 11 custom Canvas targets", async () => {
  const snapshot = await renderTutorialSnapshot(
    "diagram-editor-keyboard-interaction",
  );
  await tab();
  await tab();
  await pressKey("Enter");
  await nextPaint();
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");

  await pressKey("ArrowUp");
  await pressKey("Enter");
  await nextPaint();
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · SKETCH");
  const keyboardFrame = Math.max(
    ...snapshot.paintOperations.map(({ frame }) => frame),
  );
  expect(
    snapshot.paintOperations.filter(
      ({ frame, operation, strokeStyle, lineWidth }) =>
        frame === keyboardFrame &&
        operation === "stroke" &&
        strokeStyle === "#fffdf6" &&
        lineWidth === 3,
    ),
  ).not.toEqual([]);

  await wheelLogicalPoint(snapshot.canvas, { x: 480, y: 300 }, -160);
  await nextPaint();
  expect(snapshot.textPaints.at(-1)?.text).toBe("ZOOM · 117%");
  await tab(true);
  await pressKey("Enter");
  await nextPaint();
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");
  await tab(true);
  await pressKey("Enter");
  await nextPaint();
  expect(snapshot.textPaints.at(-1)?.text).toBe("ZOOM · 100%");
  await tab(true);
  expect(document.activeElement).not.toBe(snapshot.canvas);

  await pointerMoveLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
  await pointerDownLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
  await nextPaint();
  expect(snapshot.canvas.style.cursor).toBe("grabbing");
  await pointerUpLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
  await clickLogicalPoint(snapshot.canvas, { x: 176, y: 278 });
  await nextPaint();
  const pointerFrame = Math.max(
    ...snapshot.paintOperations.map(({ frame }) => frame),
  );
  expect(
    snapshot.paintOperations.filter(
      ({ frame, operation, strokeStyle, lineWidth }) =>
        frame === pointerFrame &&
        operation === "stroke" &&
        strokeStyle === "#fffdf6" &&
        lineWidth === 3,
    ),
  ).toEqual([]);
  expect(document.querySelectorAll("canvas")).toHaveLength(1);
  expect(Array.from(document.body.children)).toEqual([snapshot.canvas]);
});

it("publishes all twelve canonical tutorial snapshots", () => {
  expect(tutorialSnapshotCatalog).toHaveLength(12);
  expect(tutorialSnapshotCatalog.map(({ chapter }) => chapter)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  expect(getTutorialSnapshotBySlug("diagram-editor-finished")?.chapter).toBe(
    12,
  );
});

it("runs the complete Chapter 12 pointer and keyboard editor flow", async () => {
  const snapshot = await renderTutorialSnapshot("diagram-editor-finished");
  const beforeConnection = snapshot.pathStartPaints.at(-4);
  await dragPointerLogicalPoint(
    snapshot.canvas,
    { x: 176, y: 278 },
    { x: 360, y: 450 },
  );
  await nextPaint();
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");
  expect(snapshot.pathStartPaints.at(-4)).toMatchObject({
    x: beforeConnection!.x + 184,
    y: beforeConnection!.y + 172,
  });
  const movedConnection = snapshot.pathStartPaints.at(-4)!;

  await dragPointerLogicalPoint(
    snapshot.canvas,
    { x: 40, y: 520 },
    { x: 120, y: 480 },
  );
  for (let index = 0; index < 20; index += 1) {
    await wheelLogicalPoint(snapshot.canvas, { x: 480, y: 300 }, -160);
  }
  await nextPaint();
  expect(snapshot.textPaints.at(-1)?.text).toBe("ZOOM · 180%");
  for (let index = 0; index < 30; index += 1) {
    await wheelLogicalPoint(snapshot.canvas, { x: 480, y: 300 }, 160);
  }
  await nextPaint();
  expect(snapshot.textPaints.at(-1)?.text).toBe("ZOOM · 60%");

  window.scrollTo({ left: 160, top: 0 });
  await clickLogicalPoint(snapshot.canvas, { x: 878, y: 28 });
  await nextPaint();
  expect(snapshot.textPaints.at(-1)?.text).toBe("ZOOM · 100%");
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · IDEA");
  expect(snapshot.pathStartPaints.at(-4)).toMatchObject({
    x: movedConnection.x,
    y: movedConnection.y,
  });

  await tab();
  await tab();
  await pressKey("Enter");
  await nextPaint();
  expect(latestStatus(snapshot.textPaints)).toBe("SELECTED · SKETCH");

  snapshot.controller.dispose();
  snapshot.controller.dispose();
  removeTrackedController(snapshot.controller);
  const pixels = Array.from(snapshot.context.getImageData(0, 0, 960, 600).data);
  snapshot.canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      clientX: 176,
      clientY: 278,
      pointerId: 71,
    }),
  );
  expect(
    Array.from(snapshot.context.getImageData(0, 0, 960, 600).data),
  ).toEqual(pixels);
});
