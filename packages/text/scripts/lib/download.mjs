import { mkdir, rename, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileHash } from "./files.mjs";
export async function verifiedDownload(
  input,
  archive,
  { offline = false } = {},
) {
  try {
    if ((await fileHash(archive)) === input.sha256) return archive;
  } catch {}
  if (offline)
    throw new Error(
      `Missing or corrupt verified archive in offline mode: ${archive}`,
    );
  await mkdir(dirname(archive), { recursive: true });
  const partial = archive + ".partial";
  try {
    const response = await fetch(input.url);
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`Archive download failed: HTTP ${response.status}`);
    }
    const digest = createHash("sha256");
    let bytes = 0;
    const maximum = input.bytes ?? 128 * 1024 * 1024;
    const check = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > maximum) {
          callback(new Error("Archive exceeds its pinned size limit."));
          return;
        }
        digest.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body),
      check,
      createWriteStream(partial),
    );
    if (
      digest.digest("hex") !== input.sha256 ||
      (input.bytes !== undefined && bytes !== input.bytes)
    )
      throw new Error("Archive integrity mismatch.");
    await rename(partial, archive);
    return archive;
  } finally {
    await rm(partial, { force: true });
  }
}
