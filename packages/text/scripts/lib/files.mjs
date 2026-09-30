import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
  lstat,
  readlink,
} from "node:fs/promises";
import { join, dirname, resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
export async function withDirectoryLock(
  path,
  action,
  { timeoutMs = 600000 } = {},
) {
  await mkdir(dirname(path), { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      await mkdir(path);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() - started >= timeoutMs) {
        let owner = "unknown";
        try {
          owner = await readFile(join(path, "owner.json"), "utf8");
        } catch {}
        throw new Error(
          `Timed out waiting for native tooling lock ${path}. Owner: ${owner}. If that process has exited, remove this lock directory and retry.`,
          { cause: error },
        );
      }
      await delay(50);
    }
  }
  try {
    await writeFile(
      join(path, "owner.json"),
      JSON.stringify({ pid: process.pid, started: new Date().toISOString() }),
    );
    return await action();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
}
export async function fileHash(path) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  return digest.digest("hex");
}
export async function artifactHashes(directory, files) {
  const result = {};
  for (const file of files) {
    const path = resolve(directory, file);
    if (!path.startsWith(resolve(directory) + sep))
      throw new Error("Artifact path must stay within its directory.");
    result[file] = (await lstat(path)).isSymbolicLink()
      ? "link:" + (await readlink(path))
      : await fileHash(path);
  }
  return result;
}
export async function verifyArtifacts(directory, hashes) {
  if (!hashes || typeof hashes !== "object" || !Object.keys(hashes).length)
    return false;
  try {
    const actual = await artifactHashes(directory, Object.keys(hashes));
    return Object.entries(hashes).every(
      ([file, hash]) => actual[file] === hash,
    );
  } catch {
    return false;
  }
}

export async function directoryFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isDirectory())
      files.push(
        ...(await directoryFiles(join(directory, entry.name), path + "/")),
      );
    else if (entry.isFile() || entry.isSymbolicLink()) files.push(path);
  }
  return files.sort();
}
