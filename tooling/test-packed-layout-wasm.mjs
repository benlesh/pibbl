import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
const built = spawnSync(
  process.execPath,
  [new URL("./build-layout-wasm-package.mjs", import.meta.url).pathname],
  { stdio: "inherit" },
);
assert.equal(
  built.status,
  0,
  "Packed verification must build current sources first",
);
const result = spawnSync(
  process.execPath,
  [
    new URL("./packed-layout-consumer.mjs", import.meta.url).pathname,
    "--check",
  ],
  { stdio: "inherit" },
);
assert.equal(
  result.status,
  0,
  "Isolated tarball consumer must typecheck and run its public lifecycle scenario",
);
