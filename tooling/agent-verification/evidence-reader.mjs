import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const INPUT_LIMIT = 4 * 1024 * 1024;
const DETAIL_LIMIT = 64 * 1024;
const SUMMARY_LIMIT = 12 * 1024;
const schemas = new Set(['crc-targeting-replay/1', 'crc-viz-replay/1']);

/** Reads data only: never imports, executes recipes, opens artifacts or reruns assertions. */
export async function readReplayDocument(path) {
  const source = resolve(path);
  const file = await open(source, 'r');
  let text;
  try {
    if (!(await file.stat()).isFile()) throw new Error('Evidence must be a regular JSON file.');
    const buffer = Buffer.alloc(INPUT_LIMIT + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > INPUT_LIMIT) throw new Error('Evidence exceeds 4 MiB input budget.');
    text = buffer.toString('utf8', 0, length);
  } finally { await file.close(); }
  let saved;
  try { saved = JSON.parse(text); } catch { throw new Error('Evidence is not valid JSON.'); }
  const checkpoint = saved?.schema === 'crc-replay-checkpoint/1';
  const report = checkpoint ? saved.report : saved;
  if (!schemas.has(report?.schema)) throw new Error('Unsupported replay evidence schema.');
  if (!Array.isArray(report.steps) || report.steps.some(step => !step || typeof step !== 'object' || Array.isArray(step))) {
    throw new Error('Malformed replay action records.');
  }
  return { source, saved, checkpoint, report };
}

export async function readReplayEvidence(path, { actionId, manifest = false } = {}) {
  if (actionId !== undefined && manifest) throw new Error('Select either action detail or manifest.');
  const { source, saved, checkpoint, report } = await readReplayDocument(path);
  const truncatedFields = [];
  function compact(value, field, limit = 128) {
    if (typeof value !== 'string') return null;
    if (value.length > limit) truncatedFields.push(field);
    return value.slice(0, limit);
  }
  const base = {
    schema: 'crc-replay-evidence-view/1', source, verification: 'saved-evidence-only',
    kind: checkpoint ? 'checkpoint' : 'final-report',
    claimedStatus: checkpoint ? 'partial' : compact(report.status, 'status', 32),
    runId: compact(report.run?.runId ?? saved.runId ?? report.checkpointRunId, 'runId'),
  };
  if (actionId !== undefined || manifest) {
    let data;
    if (manifest) {
      data = report.run;
      if (!data || typeof data !== 'object') throw new Error('Run manifest not found.');
    } else {
      const matches = report.steps.filter(step => step.actionId === actionId);
      if (!matches.length) throw new Error('Requested action not found.');
      if (matches.length > 1) throw new Error('Requested action identity is ambiguous.');
      data = matches[0];
    }
    const result = { ...base, view: manifest ? 'manifest' : 'action', data, truncatedFields };
    if (Buffer.byteLength(JSON.stringify(result)) > DETAIL_LIMIT) throw new Error('Requested view exceeds 64 KiB detail budget; inspect the saved file explicitly.');
    return result;
  }
  const failure = report.failure ? {
    category: compact(report.failure.category, 'failure.category'),
    actionId: compact(report.failure.actionId, 'failure.actionId'),
    message: compact(report.failure.message, 'failure.message', 512),
  } : null;
  const result = {
    ...base, view: 'summary', actionCount: report.steps.length,
    actions: report.steps.slice(0, 32).map((step, index) => ({
      actionId: compact(step.actionId, `actions[${index}].actionId`),
      status: compact(step.status, `actions[${index}].status`, 32),
    })),
    omittedActions: Math.max(0, report.steps.length - 32), failure,
    otherFailures: {
      observation: compact(report.observationFailure?.category, 'observationFailure.category'),
      completion: compact(report.completionFailure?.category, 'completionFailure.category'),
      checkpoint: compact(report.checkpointFailure, 'checkpointFailure', 512),
      cleanup: compact(report.cleanupFailure, 'cleanupFailure', 512),
      verifier: report.toolVerification && report.toolVerification.status !== 'matching-on-disk' ? compact(report.toolVerification.message ?? report.toolVerification.reason, 'toolVerification', 512) : null,
    },
    recordedPageErrors: Array.isArray(report.errors) ? report.errors.length : null,
    droppedPageErrors: Number.isSafeInteger(report.droppedErrors) ? report.droppedErrors : null,
    manifestAvailable: !!report.run,
    checkpoint: checkpoint ? {
      sequence: Number.isSafeInteger(saved.sequence) ? saved.sequence : null,
      stage: compact(saved.stage, 'checkpoint.stage'),
      timing: saved.timing ? {
        clock: compact(saved.timing.clock, 'timing.clock'), clockId: compact(saved.timing.clockId, 'timing.clockId'),
        elapsedMs: Number.isFinite(saved.timing.elapsedMs) && saved.timing.elapsedMs >= 0 ? saved.timing.elapsedMs : null,
        anchor: {
          monotonicMs: Number.isFinite(saved.timing.anchor?.monotonicMs) ? saved.timing.anchor.monotonicMs : null,
          wallTimestamp: compact(saved.timing.anchor?.wallTimestamp, 'timing.anchor.wallTimestamp'),
          correlation: compact(saved.timing.anchor?.correlation, 'timing.anchor.correlation'),
        },
      } : null,
    } : null,
    truncatedFields,
  };
  if (Buffer.byteLength(JSON.stringify(result)) > SUMMARY_LIMIT) throw new Error('Summary exceeds 12 KiB output budget.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [path, flag, actionId, ...extra] = process.argv.slice(2);
    if (!path || extra.length || (flag !== undefined && flag !== '--manifest' && flag !== '--action') ||
      (flag === '--action' && !actionId) || (flag === '--manifest' && actionId)) {
      throw new Error('Usage: node evidence-reader.mjs REPORT.json [--manifest | --action ACTION_ID]');
    }
    process.stdout.write(JSON.stringify(await readReplayEvidence(path, { actionId: flag === '--action' ? actionId : undefined, manifest: flag === '--manifest' })) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ schema: 'crc-replay-evidence-view/1', status: 'unavailable', message: error.message.slice(0, 1024) }) + '\n');
    process.exitCode = 1;
  }
}
