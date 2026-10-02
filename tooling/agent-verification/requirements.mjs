import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute } from 'node:path';
import assert from 'node:assert/strict';

const validPath = path => typeof path === 'string' && path.length > 0 && !path.includes('\\') && !path.includes('\0') && !isAbsolute(path) && path.split('/').every(part => part && part !== '.' && part !== '..');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

/** Structural accounting and reviewed closure claims; this cannot prove semantic truth. */
export function validateRequirementLedger(inventory, ledger) {
  const requirements = [...inventory.matchAll(/^- \*\*([A-Z]+-\d{2})\b[^\n]*(?:\n[ \t]+[^\n]*)*/gm)];
  const ids = requirements.map(match => match[1]);
  const texts = new Map(requirements.map(match => [match[1], match[0].replace(/\s+/g, ' ').trim()]));
  assert.equal(new Set(ids).size, ids.length, 'Duplicate inventory IDs');
  assert.ok(Array.isArray(ledger.requirements), 'Missing requirements');
  const rows = ledger.requirements;
  assert.deepEqual(rows.map(row => row.id).sort(), [...ids].sort(), 'Ledger must contain every inventory ID exactly once');
  const counts = { unassessed: 0, partial: 0, gap: 0, complete: 0 };
  for (const row of rows) {
    assert.ok(Object.hasOwn(counts, row.status), `${row.id}: unsupported status`);
    if (row.status === 'complete') assert.equal(row.remaining, '', `${row.id}: complete claim still has remaining work`);
    else assert.ok(nonempty(row.remaining), `${row.id}: missing remaining work`);
    assert.ok(Array.isArray(row.evidence), `${row.id}: missing evidence list`);
    if (row.status !== 'unassessed') assert.ok(row.evidence.length, `${row.id}: audited status requires evidence`);
    for (const evidence of row.evidence) {
      assert.ok(validPath(evidence.path), `${row.id}: invalid evidence path`);
      assert.ok(typeof evidence.supports === 'string' && evidence.supports.trim(), `${row.id}: missing evidence scope`);
    }
    if (row.status === 'complete') {
      const closure = row.closure;
      assert.equal(closure?.schema, 'crc-requirement-closure/1', `${row.id}: missing closure`);
      assert.ok(hash(closure.inventorySha256));
      assert.equal(closure.inventorySha256, ledger.inventorySha256, `${row.id}: outdated inventory binding`);
      assert.equal(closure.requirementText, texts.get(row.id), `${row.id}: closure must quote the full current requirement`);
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(closure.reviewedAt) && nonempty(closure.review), `${row.id}: missing substantive review`);
      for (const [name, maximum] of [['acceptance', 64], ['checks', 64], ['files', 256]]) {
        assert.ok(Array.isArray(closure[name]) && closure[name].length > 0 && closure[name].length <= maximum, `${row.id}: invalid ${name}`);
      }
      const files = new Set();
      for (const file of closure.files) {
        assert.ok(validPath(file.path) && hash(file.sha256) && !files.has(file.path), `${row.id}: invalid/duplicate fingerprint`);
        files.add(file.path);
      }
      const evidencePaths = new Set(row.evidence.map(item => item.path));
      for (const path of evidencePaths) assert.ok(files.has(path), `${row.id}: evidence lacks fingerprint: ${path}`);
      const checks = new Set();
      for (const check of closure.checks) {
        assert.ok(nonempty(check.id) && !checks.has(check.id) && nonempty(check.command) && nonempty(check.environment), `${row.id}: invalid check`);
        checks.add(check.id);
        assert.equal(check.result, 'pass', `${row.id}: check did not pass`);
        assert.ok(files.has(check.artifact), `${row.id}: missing fingerprinted check artifact`);
      }
      for (const acceptance of closure.acceptance) {
        assert.ok(nonempty(acceptance.criterion), `${row.id}: missing acceptance criterion`);
        assert.ok(Array.isArray(acceptance.evidencePaths) && acceptance.evidencePaths.length > 0 && acceptance.evidencePaths.every(path => evidencePaths.has(path)), `${row.id}: invalid acceptance evidence`);
        assert.ok(Array.isArray(acceptance.checkIds) && acceptance.checkIds.length > 0 && acceptance.checkIds.every(id => checks.has(id)), `${row.id}: invalid acceptance checks`);
      }
    } else assert.equal(row.closure, undefined, `${row.id}: closure attached to an open requirement`);
    counts[row.status]++;
  }
  return { total: ids.length, ...counts, certifiedComplete: counts.complete };
}

/** Check persisted evidence bytes; never execute commands or trust instructions from artifacts. */
export async function verifyClosureFiles(root, ledger) {
  const canonicalRoot = await realpath(root);
  let verifiedFiles = 0;
  for (const row of ledger.requirements.filter(row => row.status === 'complete')) {
    for (const file of row.closure.files) {
      assert.ok(validPath(file.path), `${row.id}: invalid closure path`);
      const path = await realpath(resolve(root, file.path));
      const within = relative(canonicalRoot, path);
      assert.ok(within && !within.startsWith('..') && !isAbsolute(within), `${row.id}: evidence escapes repository`);
      const metadata = await stat(path);
      assert.ok(metadata.isFile() && metadata.size <= 8 * 1024 * 1024, `${row.id}: evidence must be a file of at most 8 MiB`);
      assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), file.sha256, `${row.id}: closure evidence changed: ${file.path}`);
      verifiedFiles++;
    }
  }
  return { verifiedFiles, scope: 'recorded-file-integrity-not-semantic-proof' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const inventory = await readFile(resolve(root, 'docs/strategy/agent-verification-inventory.md'), 'utf8');
  const ledger = JSON.parse(await readFile(resolve(root, 'docs/strategy/agent-verification-ledger.json'), 'utf8'));
  assert.equal(ledger.inventorySha256, createHash('sha256').update(inventory).digest('hex'), 'Inventory changed: reconcile the requirement ledger before accepting its accounting');
  const counts = validateRequirementLedger(inventory, ledger);
  const closures = await verifyClosureFiles(root, ledger);
  const paths = new Set(ledger.requirements.flatMap(row => row.evidence.map(item => item.path)));
  await Promise.all([...paths].map(path => readFile(resolve(root, path))));
  process.stdout.write(`${JSON.stringify({ accounting: 'valid', ...counts, closures, note: 'Complete counts reviewed closure claims with checked file integrity; semantic coverage requires review. Partial is not a completion percentage.' })}\n`);
}
