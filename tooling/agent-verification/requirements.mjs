import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

/** Accounting validation only: passing this does not prove requirement completion. */
export function validateRequirementLedger(inventory, ledger) {
  const ids = [...inventory.matchAll(/^- \*\*([A-Z]+-\d{2})\b/gm)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate inventory IDs');
  assert.ok(Array.isArray(ledger.requirements), 'Missing requirements');
  const rows = ledger.requirements;
  assert.deepEqual(rows.map(row => row.id).sort(), [...ids].sort(), 'Ledger must contain every inventory ID exactly once');
  const counts = { unassessed: 0, partial: 0, gap: 0 };
  for (const row of rows) {
    assert.ok(Object.hasOwn(counts, row.status), `${row.id}: unsupported status (this ledger does not yet certify completion)`);
    assert.ok(typeof row.remaining === 'string' && row.remaining.trim(), `${row.id}: missing remaining work`);
    assert.ok(Array.isArray(row.evidence), `${row.id}: missing evidence list`);
    if (row.status !== 'unassessed') assert.ok(row.evidence.length, `${row.id}: audited status requires evidence`);
    for (const evidence of row.evidence) {
      assert.ok(typeof evidence.path === 'string' && evidence.path.length && !evidence.path.startsWith('/') && !evidence.path.split('/').includes('..'), `${row.id}: invalid evidence path`);
      assert.ok(typeof evidence.supports === 'string' && evidence.supports.trim(), `${row.id}: missing evidence scope`);
    }
    counts[row.status]++;
  }
  return { total: ids.length, ...counts, certifiedComplete: 0 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const inventory = await readFile(resolve(root, 'docs/strategy/agent-verification-inventory.md'), 'utf8');
  const ledger = JSON.parse(await readFile(resolve(root, 'docs/strategy/agent-verification-ledger.json'), 'utf8'));
  assert.equal(ledger.inventorySha256, createHash('sha256').update(inventory).digest('hex'), 'Inventory changed: reconcile the requirement ledger before accepting its accounting');
  const counts = validateRequirementLedger(inventory, ledger);
  const paths = new Set(ledger.requirements.flatMap(row => row.evidence.map(item => item.path)));
  await Promise.all([...paths].map(path => readFile(resolve(root, path))));
  process.stdout.write(`${JSON.stringify({ accounting: 'valid', ...counts, note: 'Audit coverage, not an implementation completion percentage.' })}\n`);
}
