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

function removeTrackedController(controller: { dispose: () => void }): void {
  const index = mountedControllers.indexOf(controller);
  if (index >= 0) mountedControllers.splice(index, 1);
}

async function renderTutorialSnapshot(slug: string): Promise<{
  readonly canvas: HTMLCanvasElement;
  readonly controller: { dispose: () => void };
  readonly textPaints: readonly TextPaint[];
  readonly paintOperations: readonly PaintOperation[];
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
    if (path) stroke(path);
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

  return { canvas, controller, textPaints, paintOperations };
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
      { ...record(1), tutorial: "other" } as unknown as TutorialSnapshotCatalogEntry,
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
      { ...record(1), source: { path: "packages/scenarios/src/learning/start/nope.example.tsx" } },
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
