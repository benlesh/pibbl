import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";

const run = (args, message) => {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  assert.equal(result.status, 0, message);
};

run([new URL("./build-layout-wasm.mjs", import.meta.url).pathname, "--check"], "The generated external layout asset must be current.");
const built = spawnSync("corepack", ["pnpm@11.21.0", "-C", "packages/core", "run", "build"], { stdio: "inherit" });
assert.equal(built.status, 0, "The packed loading proof must build current core sources first.");
run([new URL("./packed-layout-loading-consumer.mjs", import.meta.url).pathname], "The isolated installed loading consumer must prove exports and async bundle isolation.");
