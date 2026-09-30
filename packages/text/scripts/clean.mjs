import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { root, cache } from "./common.mjs";
import { withDirectoryLock } from "./lib/files.mjs";
await withDirectoryLock(resolve(cache, "tooling.lock"), async () => {
  for (const path of [
    resolve(root, "dist"),
    ...["native", "native-stage", "build-stage", "previous-dist"].map((name) =>
      resolve(cache, name),
    ),
  ])
    await rm(path, { recursive: true, force: true });
});
