import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLearningSourceText } from "./learning-source-contract.ts";
const source = `import { pibbl, Rectangle, tween, easing, type PibblController } from "@pibbl/core";
const animation = tween({ duration: 180, easing: easing.easeOut });
export default function mount(canvas: HTMLCanvasElement): PibblController { return pibbl(canvas, <Rectangle style={{ width: 10, height: 10 }} />); }`;
test("learning sources accept direct easing strategy references", () => {
  assert.doesNotThrow(() =>
    validateLearningSourceText(source, {
      authoring: "jsx",
      label: "animation fixture",
    }),
  );
});
test("learning sources continue to reject aliases of easing", () => {
  assert.throws(
    () =>
      validateLearningSourceText(
        source.replace(
          "const animation =",
          "const alias = easing; const animation =",
        ),
        { authoring: "jsx", label: "alias fixture" },
      ),
    /bindings/,
  );
});
