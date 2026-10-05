import assert from "node:assert/strict";
import { test } from "node:test";
import { validateExampleSource } from "../website/minimal-examples.mjs";

test("coverage requires a public import and actual usage, not a named placeholder", () => {
  const entry = { symbols: [{ name: "signal", importPath: "@pibbl/core" }] };
  assert.throws(
    () => validateExampleSource(entry, "import { signal } from '@pibbl/core';"),
    /not used/,
  );
  assert.throws(
    () =>
      validateExampleSource(
        entry,
        "import { signal } from '@pibbl/core/internal'; signal(1);",
      ),
    /public import/,
  );
  for (const code of [
    "import { signal } from '@pibbl/core'; const object = { signal: 1 };",
    "import { signal } from '@pibbl/core'; function unrelated(signal) { return signal; }",
  ])
    assert.throws(() => validateExampleSource(entry, code), /not used/);
  assert.doesNotThrow(() =>
    validateExampleSource(
      entry,
      "import { signal } from '@pibbl/core'; const count = signal(1); count.set(2); console.log(count.get());",
    ),
  );
});
