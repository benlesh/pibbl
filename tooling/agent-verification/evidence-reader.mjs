import { validCheckOutcomes } from './replay-outcome.mjs';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const INPUT_LIMIT = 4 * 1024 * 1024;
const DETAIL_LIMIT = 64 * 1024;
const SUMMARY_LIMIT = 12 * 1024;
const LAYOUT_SMOKE = 'crc-layout-studio-smoke/1';
const schemas = new Set([LAYOUT_SMOKE, 'crc-targeting-replay/1', 'crc-viz-replay/1', 'crc-text-replay/1', 'crc-signal-mutation-replay/1']);
const evidenceError = (code, message) => Object.assign(new Error(message), { code });

/** Reads data only: never imports, executes recipes, opens artifacts or reruns assertions. */
export async function readReplayDocument(path) {
  const source = resolve(path);
  const file = await open(source, 'r');
  let text;
  try {
    if (!(await file.stat()).isFile()) throw evidenceError('CRC_EVIDENCE_INVALID_DOCUMENT', 'Evidence must be a regular JSON file.');
    const buffer = Buffer.alloc(INPUT_LIMIT + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > INPUT_LIMIT) throw evidenceError('CRC_EVIDENCE_BUDGET_EXCEEDED', 'Evidence exceeds 4 MiB input budget.');
    text = buffer.toString('utf8', 0, length);
  } finally { await file.close(); }
  let saved;
  try { saved = JSON.parse(text); } catch { throw evidenceError('CRC_EVIDENCE_INVALID_DOCUMENT', 'Evidence is not valid JSON.'); }
  const checkpoint = saved?.schema === 'crc-replay-checkpoint/1';
  const report = checkpoint ? saved.report : saved;
  if (!schemas.has(report?.schema)) throw evidenceError('CRC_EVIDENCE_UNSUPPORTED_SCHEMA', 'Unsupported replay evidence schema.');
  if (!Array.isArray(report.steps) || report.steps.some(step => !step || typeof step !== 'object' || Array.isArray(step))) {
    throw evidenceError('CRC_EVIDENCE_INVALID_DOCUMENT', 'Malformed replay action records.');
  }
  if (report.schema === LAYOUT_SMOKE && (checkpoint || report.run !== undefined || report.checks !== undefined || report.requiredChecks !== undefined || report.steps.some(step => typeof step.action !== 'string' || !step.action.length || step.action.length > 128))) throw evidenceError('CRC_EVIDENCE_INVALID_DOCUMENT', 'Layout smoke evidence has no run/check manifest or checkpoint contract and requires named actions.');
  if (report.checks !== undefined && !validCheckOutcomes(report.checks)) throw evidenceError('CRC_EVIDENCE_INVALID_CHECKS', 'Malformed or unsupported check outcomes.');
  return { source, saved, checkpoint, report, contentHash: createHash('sha256').update(text).digest('hex') };
}

export async function readReplayEvidence(path, { actionId, checkId, manifest = false, page, cursor, pageSize, fields } = {}) {
  if ([actionId !== undefined, checkId !== undefined, manifest, page !== undefined].filter(Boolean).length > 1) throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Select either action detail, check detail, manifest or page.');
  if (page === undefined && (cursor !== undefined || pageSize !== undefined)) throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Cursor and page size require a page selection.');
  if (page !== undefined && page !== 'actions' && page !== 'checks') throw evidenceError('CRC_EVIDENCE_UNSUPPORTED_QUERY', 'Unsupported page selection.');
  if (fields !== undefined && (actionId === undefined && checkId === undefined || !Array.isArray(fields) || fields.length < 1 || fields.length > 16 || new Set(fields).size !== fields.length ||
    fields.some(field => typeof field !== 'string' || field.length > 512 || (field !== '' && !field.startsWith('/')) || /~(?![01])/.test(field) || field.split('/').length > 17))) {
    throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Fields require an action or check and 1 through 16 unique JSON pointers, each at most 512 UTF-16 units and 16 segments.');
  }
  const { source, saved, checkpoint, report, contentHash } = await readReplayDocument(path);
  const layoutSmoke = report.schema === LAYOUT_SMOKE;
  const actionIdentity = step => layoutSmoke ? step.action : step.actionId;
  const truncatedFields = [];
  function compact(value, field, limit = 128) {
    if (typeof value !== 'string') return null;
    if (value.length > limit) truncatedFields.push(field);
    return value.slice(0, limit);
  }
  const base = {
    schema: 'crc-replay-evidence-view/1', sourceSchema: report.schema, source, verification: 'saved-evidence-only',
    ...(layoutSmoke ? { attestation: 'not-provided-by-schema' } : {}),
    kind: checkpoint ? 'checkpoint' : 'final-report',
    claimedStatus: checkpoint ? 'partial' : compact(report.status, 'status', 32),
    runId: compact(report.run?.runId ?? saved.runId ?? report.checkpointRunId, 'runId'),
  };
  if (page !== undefined) {
    let offset = 0;
    let size = pageSize ?? 16;
    let previousHash;
    if (cursor !== undefined) {
      let decoded;
      try {
        if (typeof cursor !== 'string' || cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
        decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (decoded?.schema !== 'crc-evidence-cursor/1' || decoded.page !== page ||
          !/^[a-f0-9]{64}$/.test(decoded.hash) || !Number.isSafeInteger(decoded.offset) || decoded.offset < 1 ||
          !Number.isSafeInteger(decoded.size) || decoded.size < 1 || decoded.size > 32 ||
          (pageSize !== undefined && pageSize !== decoded.size)) throw new Error();
      } catch { throw evidenceError('CRC_EVIDENCE_INVALID_CURSOR', 'Invalid or mismatched evidence cursor.'); }
      offset = decoded.offset; size = decoded.size; previousHash = decoded.hash;
    }
    if (!Number.isSafeInteger(size) || size < 1 || size > 32) throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Invalid page size: expected 1 through 32.');
    const records = page === 'actions' ? report.steps : report.checks ?? [];
    const common = { ...base, view: 'page', collection: page, snapshot: contentHash,
      history: checkpoint ? 'checkpoint-prefix' : 'not-established', scope: 'saved-record-summaries-only' };
    if (previousHash && previousHash !== contentHash) return {
      ...common, status: 'cursor-expired', reason: 'Evidence bytes changed; restart explicitly to inspect the new snapshot.', data: [], nextCursor: null,
    };
    if (offset > records.length) throw evidenceError('CRC_EVIDENCE_INVALID_CURSOR', 'Evidence cursor is outside the saved collection.');
    const data = records.slice(offset, offset + size).map((record, index) => page === 'actions' ? {
      actionId: compact(actionIdentity(record), `actions[${offset + index}].actionId`),
      status: compact(record.status, `actions[${offset + index}].status`, 32),
    } : {
      checkId: compact(record.checkId, `checks[${offset + index}].checkId`),
      ...(record.actionId === undefined ? {} : { actionId: compact(record.actionId, `checks[${offset + index}].actionId`) }),
      status: record.status, required: record.required, reason: compact(record.reason, `checks[${offset + index}].reason`),
    });
    const end = offset + data.length;
    const nextCursor = end < records.length ? Buffer.from(JSON.stringify({ schema: 'crc-evidence-cursor/1', hash: contentHash, page, offset: end, size })).toString('base64url') : null;
    const result = { ...common, status: 'ok', total: records.length, offset, data, remaining: records.length - end, nextCursor, truncatedFields };
    if (Buffer.byteLength(JSON.stringify(result)) > SUMMARY_LIMIT) throw evidenceError('CRC_EVIDENCE_BUDGET_EXCEEDED', 'Page exceeds 12 KiB output budget.');
    return result;
  }
  if (actionId !== undefined || checkId !== undefined || manifest) {
    let data;
    if (manifest) {
      if (!report.run || typeof report.run !== 'object') throw evidenceError('CRC_EVIDENCE_NO_MATCH', 'Run manifest not found.');
      data = report.requiredChecks === undefined ? report.run : { ...report.run, requiredChecks: report.requiredChecks };
    } else if (checkId !== undefined) {
      const matches = (report.checks ?? []).filter(check => check.checkId === checkId);
      if (!matches.length) throw evidenceError('CRC_EVIDENCE_NO_MATCH', 'Requested check not found.');
      if (matches.length > 1) throw evidenceError('CRC_EVIDENCE_AMBIGUOUS_MATCH', 'Requested check identity is ambiguous.');
      data = matches[0];
    } else {
      const matches = report.steps.filter(step => actionIdentity(step) === actionId);
      if (!matches.length) throw evidenceError('CRC_EVIDENCE_NO_MATCH', 'Requested action not found.');
      if (matches.length > 1) throw evidenceError('CRC_EVIDENCE_AMBIGUOUS_MATCH', 'Requested action identity is ambiguous.');
      data = matches[0];
    }
    if (fields !== undefined) {
      const projected = fields.map(path => {
        let value = data;
        for (const part of path === '' ? [] : path.slice(1).split('/').map(part => part.replaceAll('~1', '/').replaceAll('~0', '~'))) {
          if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) return { path, status: 'absent' };
          // Arrays expose JSON elements only, not JS properties such as length.
          if (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(part)) return { path, status: 'absent' };
          value = value[part];
        }
        if (Array.isArray(value)) return { path, status: 'summary', kind: 'array', length: value.length };
        if (value !== null && typeof value === 'object') {
          const keys = Object.keys(value);
          return { path, status: 'summary', kind: 'object', propertyCount: keys.length,
            keys: keys.slice(0, 8).map(key => ({ value: key.slice(0, 64), truncated: key.length > 64 })), omittedKeys: Math.max(0, keys.length - 8) };
        }
        if (typeof value === 'string' && value.length > 1024) return { path, status: 'truncated', value: value.slice(0, 1024), length: value.length };
        if (typeof value === 'number' && (!Number.isFinite(value) || Object.is(value, -0))) return { path, status: 'special-number', value: Object.is(value, -0) ? '-0' : String(value) };
        return { path, status: 'value', value };
      });
      const result = { ...base, view: 'projection', parent: checkId !== undefined ? 'check' : 'action',
        snapshot: contentHash, scope: 'selected-saved-fields-only', data: projected, truncatedFields };
      if (Buffer.byteLength(JSON.stringify(result)) > DETAIL_LIMIT) throw evidenceError('CRC_EVIDENCE_BUDGET_EXCEEDED', 'Projection exceeds 64 KiB detail budget; request fewer or narrower fields.');
      return result;
    }
    const result = { ...base, view: manifest ? 'manifest' : checkId !== undefined ? 'check' : 'action', data, truncatedFields };
    if (Buffer.byteLength(JSON.stringify(result)) > DETAIL_LIMIT) throw evidenceError('CRC_EVIDENCE_BUDGET_EXCEEDED', 'Requested view exceeds 64 KiB detail budget; inspect the saved file explicitly.');
    return result;
  }
  const recordedFailure = layoutSmoke && typeof report.error === 'string' ? { category: 'smoke-error', message: report.error } : report.failure;
  const failure = recordedFailure ? {
    category: compact(recordedFailure.category, 'failure.category'),
    code: compact(recordedFailure.code, 'failure.code'),
    stage: compact(recordedFailure.stage, 'failure.stage'),
    reason: compact(recordedFailure.reason, 'failure.reason', 512),
    actionId: compact(recordedFailure.actionId, 'failure.actionId'),
    message: compact(recordedFailure.message, 'failure.message', 512),
  } : null;
  const result = {
    ...base, view: 'summary', actionCount: report.steps.length,
    firstFailedCheck: report.firstFailedCheck ? {
      checkId: compact(report.firstFailedCheck.checkId, 'firstFailedCheck.checkId'),
      actionId: compact(report.firstFailedCheck.actionId, 'firstFailedCheck.actionId'),
    } : null,
    requiredCheckCount: Array.isArray(report.requiredChecks) ? report.requiredChecks.length : null,
    checkCount: report.checks?.length ?? 0,
    checks: (report.checks ?? []).slice(0, 16).map((check, index) => ({
      checkId: compact(check.checkId, `checks[${index}].checkId`),
      ...(check.actionId === undefined ? {} : { actionId: compact(check.actionId, `checks[${index}].actionId`) }), status: check.status, required: check.required,
      reason: compact(check.reason, `checks[${index}].reason`),
    })),
    omittedChecks: Math.max(0, (report.checks?.length ?? 0) - 16),
    actions: report.steps.slice(0, 32).map((step, index) => ({
      actionId: compact(actionIdentity(step), `actions[${index}].actionId`),
      status: compact(step.status, `actions[${index}].status`, 32),
    })),
    omittedActions: Math.max(0, report.steps.length - 32), failure,
    otherFailures: {
      observation: compact(report.observationFailure?.category, 'observationFailure.category'),
      check: compact(report.checkFailure?.category, 'checkFailure.category'),
      checkCompletion: compact(report.checkCompletionFailure?.category, 'checkCompletionFailure.category'),
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
  if (Buffer.byteLength(JSON.stringify(result)) > SUMMARY_LIMIT) throw evidenceError('CRC_EVIDENCE_BUDGET_EXCEEDED', 'Summary exceeds 12 KiB output budget.');
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [path, ...arguments_] = process.argv.slice(2);
    const options = {};
    let seenSelection = false;
    for (let index = 0; index < arguments_.length; index++) {
      const flag = arguments_[index];
      if (flag === '--fields') {
        if (options.fields !== undefined || arguments_[index + 1] === undefined) throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Provide --fields once with a JSON array of pointers.');
        try { options.fields = JSON.parse(arguments_[++index]); } catch { throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Fields must be a JSON array.'); }
        continue;
      }
      if (seenSelection) throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Only one action, check, page or manifest selection is allowed.');
      seenSelection = true;
      if (flag === '--manifest') options.manifest = true;
      else if (flag === '--action' || flag === '--check' || flag === '--page') {
        const value = arguments_[++index];
        if (!value || value.startsWith('--')) throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Missing selector value.');
        if (flag === '--action') options.actionId = value;
        else if (flag === '--check') options.checkId = value;
        else {
          options.page = value;
          if (arguments_[index + 1] && !arguments_[index + 1].startsWith('--')) options.cursor = arguments_[++index];
        }
      } else throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Unknown evidence reader option.');
    }
    if (!path) throw evidenceError('CRC_EVIDENCE_INVALID_SELECTOR', 'Provide REPORT.json and optionally --action ID, --check ID, --manifest, or --page actions|checks [CURSOR]. Action/check views accept --fields JSON_POINTER_ARRAY.');
    process.stdout.write(JSON.stringify(await readReplayEvidence(path, options)) + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({ schema: 'crc-replay-evidence-view/1', status: 'unavailable', code: error.code ?? 'CRC_EVIDENCE_UNAVAILABLE', message: error.message.slice(0, 1024) }) + '\n');
    process.exitCode = 1;
  }
}
