import assert from "node:assert/strict";
import { test } from "node:test";
import { validateExampleSource } from "../website/minimal-examples.mjs";

test("coverage requires a public import and actual usage, not a named placeholder", () => {
  const entry = { symbols: [{ name: "signal", importPath: "@crc/core" }] };
  assert.throws(
    () => validateExampleSource(entry, "import { signal } from '@crc/core';"),
    /not used/,
  );
  assert.throws(
    () =>
      validateExampleSource(
        entry,
        "import { signal } from '@crc/core/internal'; signal(1);",
      ),
    /public import/,
  );
  for (const code of [
    "import { signal } from '@crc/core'; const object = { signal: 1 };",
    "import { signal } from '@crc/core'; function unrelated(signal) { return signal; }",
  ])
    assert.throws(() => validateExampleSource(entry, code), /not used/);
  assert.doesNotThrow(() =>
    validateExampleSource(
      entry,
      "import { signal } from '@crc/core'; const count = signal(1); count.set(2); console.log(count.get());",
    ),
  );
});
