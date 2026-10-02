import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { writeFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";

/** Sequential, process-crash-safe replacement; not a power-loss durability guarantee. */
export function createCheckpointWriter(output, {
  monotonicNow = () => performance.now(),
  wallNow = () => new Date().toISOString(),
} = {}) {
  const runId = randomUUID();
  const originMs = monotonicNow();
  if (!Number.isFinite(originMs)) throw new Error("Invalid monotonic checkpoint clock.");
  const anchor = { monotonicMs: originMs, wallTimestamp: wallNow(), correlation: "paired-observations-not-synchronized" };
  let previousMs = originMs;
  const destination = resolve(output, "checkpoint.json");
  const temporary = resolve(output, `.checkpoint-${runId}.tmp`);
  let sequence = 0;
  let writing = false;
  const checkpoint = async (report, stage) => {
    if (writing)
      throw new Error("Checkpoint writes must be awaited sequentially.");
    writing = true;
    let failed = false;
    let failure;
    try {
      const nowMs = monotonicNow();
      if (!Number.isFinite(nowMs) || nowMs < previousMs) throw new Error("Checkpoint monotonic clock moved backward or became invalid.");
      const snapshot = {
        schema: "crc-replay-checkpoint/1",
        runId,
        sequence: sequence + 1,
        status: "partial",
        stage,
        timestamp: wallNow(),
        timing: { clock: "node-monotonic", clockId: runId, elapsedMs: nowMs - originMs, anchor },
        report: { ...report, status: "incomplete" },
      };
      const text = `${JSON.stringify(snapshot, null, 2)}\n`;
      if (Buffer.byteLength(text) > 4 * 1024 * 1024)
        throw new Error("Checkpoint exceeds 4 MiB evidence budget.");
      await writeFile(temporary, text);
      await rename(temporary, destination);
      sequence++;
      previousMs = nowMs;
    } catch (error) {
      failed = true;
      failure = error;
    }
    try {
      await rm(temporary, { force: true });
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    } finally {
      writing = false;
    }
    if (failed) throw failure;
  };
  Object.defineProperty(checkpoint, "runId", { value: runId });
  return checkpoint;
}
