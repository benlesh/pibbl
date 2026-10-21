import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { toRunnableScript } from "../playground/src/sandbox-module.ts";
import { validateLearningSourceText } from "./learning-source-contract.ts";

test("Studio mounts an exported component without invoking it outside the runtime", () => {
  const calls = [];
  const controller = { dispose() {} };
  const runtime = {
    Rectangle: {},
    createElement: (type, props) => ({ type, props }),
    pibbl: (canvas, element) => {
      calls.push({ canvas, element });
      return controller;
    },
  };
  const context = { PIBBL_CORE: runtime };
  runInNewContext(
    toRunnableScript(
      `
    import { Rectangle } from "@pibbl/core";
    export function ClickStudy() {
      throw new Error("Components must be evaluated by Pibbl");
    }
  `,
      { exportName: "ClickStudy" },
    ),
    context,
  );
  assert.equal(context.__PIBBL_EXAMPLE_MOUNT__("canvas"), controller);
  assert.equal(calls[0].canvas, "canvas");
  assert.equal(calls[0].element.type.name, "ClickStudy");
});

test("learning source validation accepts an exported component", () => {
  assert.doesNotThrow(() =>
    validateLearningSourceText(
      `
    import { Rectangle } from "@pibbl/core";
    export function ClickStudy() {
      return <Rectangle style={{ width: 20, height: 20 }} />;
    }
  `,
      { authoring: "jsx", label: "component lesson", exportName: "ClickStudy" },
    ),
  );
});

test("Studio selects the catalog entry when a module exports several components", () => {
  const calls = [];
  const context = {
    PIBBL_CORE: {
      Rectangle: {},
      createElement: (type) => {
        calls.push(type.name);
        return {};
      },
      pibbl: () => ({ dispose() {} }),
    },
  };
  const source = `import { Rectangle } from "@pibbl/core";
    export function Decoration() { return null; }
    export function ActualLesson() { return null; }`;
  runInNewContext(
    toRunnableScript(source, { exportName: "ActualLesson" }),
    context,
  );
  context.__PIBBL_EXAMPLE_MOUNT__("canvas");
  assert.deepEqual(calls, ["ActualLesson"]);
  assert.throws(
    () => toRunnableScript(source, { exportName: "Missing" }),
    /Missing/,
  );
});
