import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  withDirectoryLock,
  artifactHashes,
  verifyArtifacts,
  directoryFiles,
} from "./lib/files.mjs";
import { cache, lock, run, supportedHost } from "./common.mjs";
import { verifiedDownload } from "./lib/download.mjs";
import { ensureCompiler } from "./compiler.mjs";
export async function ensureSetup() {
  supportedHost();
  run("python3", ["--version"]);
  await mkdir(cache, { recursive: true });
  for (const name of ["emsdk", "harfbuzz"]) {
    const input = lock[name];
    const destination = resolve(cache, `${name}-${input.version}`);
    const marker = resolve(destination, ".crc-source-sha256");
    try {
      const sourceFiles = JSON.parse(
        await readFile(resolve(destination, ".crc-source-files.json"), "utf8"),
      );
      if (
        (await readFile(marker, "utf8")).trim() === input.sha256 &&
        (await verifyArtifacts(destination, sourceFiles))
      )
        continue;
    } catch {}
    const archive = resolve(cache, `${name}-${input.version}.tar.gz`);
    await verifiedDownload(input, archive, {
      offline: process.argv.includes("--offline"),
    });
    const staging = `${destination}.partial`;
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging);
    run("tar", ["-xzf", archive, "--strip-components=1", "-C", staging]);
    const sourceFiles = await artifactHashes(
      staging,
      await directoryFiles(staging),
    );
    // Upgrade an already matching cache without deleting its installed SDK.
    if (await verifyArtifacts(destination, sourceFiles)) {
      await writeFile(
        resolve(destination, ".crc-source-files.json"),
        JSON.stringify(sourceFiles),
      );
      await writeFile(marker, input.sha256);
      await rm(staging, { recursive: true, force: true });
      continue;
    }
    await writeFile(
      resolve(staging, ".crc-source-files.json"),
      JSON.stringify(sourceFiles),
    );
    await writeFile(resolve(staging, ".crc-source-sha256"), input.sha256);
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
  }
  const sdk = resolve(cache, `emsdk-${lock.emsdk.version}`);
  await ensureCompiler(sdk);
  process.stdout.write(
    String(
      `Text toolchain ready: Emscripten ${lock.emsdk.version}, HarfBuzz ${lock.harfbuzz.version}`,
    ) + "\n",
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await withDirectoryLock(resolve(cache, "tooling.lock"), ensureSetup);
}
