import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  withDirectoryLock,
  artifactHashes,
  verifyArtifacts,
} from "../scripts/lib/files.mjs";
test("tooling lock serializes writers and releases after exceptions", async () => {
  const temp = await mkdtemp(join(tmpdir(), "crc-text-lock-"));
  try {
    const order = [];
    let release, entered;
    const ready = new Promise((resolve) => {
      entered = resolve;
    });
    const hold = new Promise((resolve) => {
      release = resolve;
    });
    const first = withDirectoryLock(join(temp, "lock"), async () => {
      order.push(1);
      entered();
      await hold;
      order.push(2);
    });
    await ready;
    const second = withDirectoryLock(join(temp, "lock"), async () => {
      order.push(3);
    });
    release();
    await Promise.all([first, second]);
    assert.deepEqual(order, [1, 2, 3]);
    await assert.rejects(
      withDirectoryLock(join(temp, "lock"), async () => {
        throw new Error("test failure");
      }),
      /test failure/,
    );
    await withDirectoryLock(join(temp, "lock"), async () => order.push(4));
    assert.equal(order.at(-1), 4);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
test("native cache validation detects altered and missing artifacts", async () => {
  const temp = await mkdtemp(join(tmpdir(), "crc-text-hashes-"));
  try {
    await writeFile(join(temp, "engine.wasm"), "wasm fixture");
    const hashes = await artifactHashes(temp, ["engine.wasm"]);
    assert.equal(await verifyArtifacts(temp, hashes), true);
    await writeFile(join(temp, "engine.wasm"), "changed");
    assert.equal(await verifyArtifacts(temp, hashes), false);
    await rm(join(temp, "engine.wasm"));
    assert.equal(await verifyArtifacts(temp, hashes), false);
    assert.equal(Object.keys(hashes).length, 1);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
test("verified downloads reject corrupt bytes and reuse valid offline archives", async () => {
  const { verifiedDownload } = await import("../scripts/lib/download.mjs");
  const { createServer } = await import("node:http");
  const { createHash } = await import("node:crypto");
  const bytes = Buffer.from("pinned input");
  const temp = await mkdtemp(join(tmpdir(), "crc-text-download-"));
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.end(bytes);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const archive = join(temp, "input.tar");
  const input = {
    url: `http://127.0.0.1:${server.address().port}/archive`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
  try {
    await assert.rejects(
      verifiedDownload({ ...input, sha256: "0".repeat(64) }, archive),
      /integrity/,
    );
    await assert.rejects(
      verifiedDownload(input, archive, { offline: true }),
      /offline/,
    );
    await verifiedDownload(input, archive);
    const before = requests;
    await verifiedDownload(input, archive, { offline: true });
    assert.equal(requests, before);
    await writeFile(archive, "corrupted");
    await assert.rejects(
      verifiedDownload(input, archive, { offline: true }),
      /offline/,
    );
    await assert.rejects(
      verifiedDownload({ ...input, bytes: 2 }, archive),
      /size limit/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
});
