import {
  mkdir,
  readFile,
  writeFile,
  rm,
  rename,
  access,
} from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { cache, lock, run } from "./common.mjs";
import {
  artifactHashes,
  verifyArtifacts,
  directoryFiles,
} from "./lib/files.mjs";
import { verifiedDownload } from "./lib/download.mjs";
export async function verifyCompiler(sdk) {
  try {
    const pin =
      lock.emsdk.compilerArchives[`${process.platform}-${process.arch}`];
    const receipt = JSON.parse(
      await readFile(resolve(sdk, ".pibbl-compiler-files.json"), "utf8"),
    );
    if (
      receipt.sha256 !== pin.sha256 ||
      !(await verifyArtifacts(resolve(sdk, "upstream"), receipt.files))
    )
      return false;
    for (const file of ["clang", "wasm-ld", "wasm-opt"])
      await access(resolve(sdk, "upstream/bin", file), constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
export async function ensureCompiler(sdk) {
  const host = `${process.platform}-${process.arch}`;
  const pin = lock.emsdk.compilerArchives[host];
  if (!pin) throw new Error(`No pinned compiler archive for ${host}.`);
  if (!(await verifyCompiler(sdk))) {
    const archive = await verifiedDownload(
      pin,
      resolve(cache, "sdk-archives", host + ".tar.xz"),
      { offline: process.argv.includes("--offline") },
    );
    const staging = resolve(cache, "compiler-stage");
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging);
    run("tar", ["-xf", archive, "--strip-components=1", "-C", staging]);
    const files = await artifactHashes(staging, await directoryFiles(staging));
    const destination = resolve(sdk, "upstream");
    // A failed verification can mean lost executable permissions as well as
    // changed bytes. Replace from the verified archive in either case.
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
    await writeFile(
      resolve(sdk, ".pibbl-compiler-files.json"),
      JSON.stringify({ sha256: pin.sha256, files }),
    );
  }
  // Use the already provisioned project Node and host Python instead of allowing
  // emsdk to download additional unpinned language runtimes.
  await writeFile(
    resolve(sdk, ".emscripten"),
    `import os\nemsdk_path = os.path.dirname(os.environ['EM_CONFIG'])\nNODE_JS = ${JSON.stringify(process.execPath)}\nLLVM_ROOT = emsdk_path + '/upstream/bin'\nBINARYEN_ROOT = emsdk_path + '/upstream'\nEMSCRIPTEN_ROOT = emsdk_path + '/upstream/emscripten'\n`,
  );
}
