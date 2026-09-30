import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const cache = resolve(root, ".cache");
export const lock = JSON.parse(
  await readFile(resolve(root, "native/toolchain.lock.json"), "utf8"),
);
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} failed (${result.status ?? result.signal}). ${result.stderr ?? ""}`,
    );
  return result.stdout;
}
export function supportedHost() {
  if (
    !["darwin", "linux"].includes(process.platform) ||
    !["arm64", "x64"].includes(process.arch)
  ) {
    throw new Error(
      `Native build is not yet supported on ${process.platform}/${process.arch}. Published packages include prebuilt WASM.`,
    );
  }
}
