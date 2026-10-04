import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { cache, root, lock, run, supportedHost } from "./common.mjs";
import { verifyArtifacts } from "./lib/files.mjs";
import { verifyCompiler } from "./compiler.mjs";
supportedHost();
run("python3", ["--version"]);
for (const name of ["emsdk", "harfbuzz"]) {
  const directory = resolve(cache, `${name}-${lock[name].version}`);
  let hashes;
  try {
    hashes = JSON.parse(
      await readFile(resolve(directory, ".crc-source-files.json"), "utf8"),
    );
  } catch {
    throw new Error(`${name} source cache is missing. Run pnpm text:setup.`);
  }
  if (!(await verifyArtifacts(directory, hashes)))
    throw new Error(
      `${name} source cache is altered or incomplete. Run pnpm text:setup to repair it.`,
    );
}
const sdk = resolve(cache, `emsdk-${lock.emsdk.version}`);
if (!(await verifyCompiler(sdk)))
  throw new Error(
    "Pinned compiler files are missing or altered. Run pnpm text:setup.",
  );
const version = run(
  "python3",
  [resolve(sdk, "upstream/emscripten/em++.py"), "--version"],
  {
    env: { ...process.env, EM_CONFIG: resolve(sdk, ".emscripten") },
    encoding: "utf8",
    stdio: "pipe",
  },
);
// Official emsdk binary archives may label the pinned release with -git.
// The compiler receipt above verifies the exact archive files and revision.
if (
  version.split("\n")[0].match(/\) ([0-9.]+)(?:-git)?(?:\s|$)/u)?.[1] !==
  lock.emsdk.version
)
  throw new Error(`Unexpected compiler version: ${version}`);
try {
  await access(chromium.executablePath());
} catch {
  throw new Error(
    "Chromium is missing. Run pnpm exec playwright install chromium.",
  );
}
try {
  const info = JSON.parse(
    await readFile(resolve(root, "dist/build-info.json"), "utf8"),
  );
  if (
    info.emscripten !== lock.emsdk.version ||
    info.harfbuzz !== lock.harfbuzz.version ||
    !(await verifyArtifacts(resolve(root, "dist"), info.artifacts))
  )
    throw new Error(
      "Built native assets are outdated or altered. Run pnpm text:build.",
    );
} catch (error) {
  if (error.code === "ENOENT")
    throw new Error("Built package is missing. Run pnpm text:build.", {
      cause: error,
    });
  throw error;
}
process.stdout.write(
  `Verified source caches, Emscripten ${lock.emsdk.version}, native output, and Chromium on ${process.platform}/${process.arch}.\n`,
);
