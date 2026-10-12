import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Ignore only known non-package surfaces. Unknown inputs conservatively release.
const presentation = /^(docs\/|website\/|playground\/|games\/|packages\/scenarios\/)/;
export function alphaInputHash(tree) {
  const inputs = tree.split('\0').filter(Boolean).filter(entry => {
    const path = entry.slice(entry.indexOf('\t') + 1);
    return !presentation.test(path);
  });
  return createHash('sha256').update(inputs.join('\0')).digest('hex');
}

export function needsAlphaPublish(packages, hash) {
  return packages.length !== 4 || packages.some(pkg => !pkg?.version || pkg.pibblAlphaInputHash !== hash) || new Set(packages.map(pkg => pkg.version)).size !== 1;
}

function readAlpha(name) {
  try {
    return JSON.parse(execFileSync('npm', ['view', `${name}@alpha`, '--json', '--registry=https://registry.npmjs.org'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  } catch (error) {
    // A missing alpha tag is expected on first publication. Authentication,
    // network, and registry failures must fail the job, never masquerade as changes.
    let response;
    try { response = JSON.parse(String(error.stdout)); } catch { throw error; }
    if (response.error?.code === 'E404') return null;
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const hash = alphaInputHash(execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  const packages = ['@pibbl/core', '@pibbl/three', '@pibbl/text', 'pibbl'].map(readAlpha);
  const changed = needsAlphaPublish(packages, hash);
  if (!process.env.GITHUB_OUTPUT) throw new Error('This check requires GITHUB_OUTPUT');
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nhash=${hash}\n`);
  process.stdout.write((changed ? 'Package inputs changed or the previous alpha release is incomplete.' : 'All four alpha packages already contain these inputs; skipping publication.') + '\n');
}
