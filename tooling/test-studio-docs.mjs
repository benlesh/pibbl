import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";

const workspaceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const playgroundRoot = resolve(workspaceRoot, "playground");
const normalOutput = resolve(playgroundRoot, "dist");
const acceptanceOutput = resolve(
  playgroundRoot,
  ".studio-docs-acceptance-dist",
);

assert.notEqual(
  acceptanceOutput,
  normalOutput,
  "Studio documentation acceptance output must never be the normal production output.",
);
assert.equal(
  relative(playgroundRoot, acceptanceOutput),
  ".studio-docs-acceptance-dist",
  "Studio documentation acceptance cleanup must target only its explicit output directory.",
);

async function outputFingerprint(directory) {
  try {
    await lstat(directory);
  } catch (error) {
    if (isMissingPath(error)) return "missing";
    throw error;
  }

  const hash = createHash("sha256");
  async function visit(path) {
    const entries = (await readdir(path, { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name, "en"),
    );
    for (const entry of entries) {
      const entryPath = join(path, entry.name);
      hash.update(`${relative(directory, entryPath)}\0`);
      if (entry.isDirectory()) {
        hash.update("directory\0");
        await visit(entryPath);
      } else if (entry.isFile()) {
        hash.update("file\0");
        hash.update(await readFile(entryPath));
      } else {
        throw new Error(`Unsupported output entry ${entryPath}.`);
      }
    }
  }
  await visit(directory);
  return hash.digest("hex");
}

async function assertNormalOutputUnchanged(before) {
  assert.equal(
    await outputFingerprint(normalOutput),
    before,
    "Studio documentation acceptance must preserve playground/dist exactly.",
  );
}

function isMissingPath(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

async function run(command, args, env = process.env) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with ${signal ?? String(code)}.`,
        ),
      );
    });
  });
}

const normalOutputBefore = await outputFingerprint(normalOutput);
try {
  await rm(acceptanceOutput, { force: true, recursive: true });
  await run(
    "corepack",
    ["pnpm@11.21.0", "playground:build:studio-docs-acceptance"],
  );
  await assertNormalOutputUnchanged(normalOutputBefore);
  await run(process.execPath, ["tooling/verify-studio-docs.mjs"], {
    ...process.env,
    CRC_STUDIO_DOCS_PREVIEW_OUTPUT_DIRECTORY: acceptanceOutput,
  });
  await assertNormalOutputUnchanged(normalOutputBefore);
} finally {
  await rm(acceptanceOutput, { force: true, recursive: true });
  await assertNormalOutputUnchanged(normalOutputBefore);
}

process.stdout.write(
  `Validated isolated Studio documentation acceptance output; playground/dist SHA-256 remained ${normalOutputBefore}, and ${relative(workspaceRoot, acceptanceOutput)} was removed.\n`,
);
