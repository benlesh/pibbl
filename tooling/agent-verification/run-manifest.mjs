import assert from 'node:assert/strict';
import { describeReplayError } from './failure-evidence.mjs';
import { fingerprint } from './identity.mjs';
import { resolve } from 'node:path';

/** Data-only recipe: consumers pass arguments directly, never concatenate a shell command. */
export function createReplayManifest({ runId, repository, kind, url, density = 1 }) {
  if (kind !== 'targeting' && kind !== 'viz') throw new Error('Unknown replay kind.');
  if ((density !== 1 && density !== 2) || (kind === 'targeting' && density !== 1)) {
    throw new Error('Unsupported replay density.');
  }
  return {
    schema: 'crc-replay-run/1',
    runId,
    kind,
    startedAt: new Date().toISOString(),
    clock: 'UTC-wall-clock',
    environment: {
      node: process.version, platform: process.platform, architecture: process.arch,
      browserContext: { viewport: { width: 1280, height: 1000 }, deviceScaleFactor: density,
        locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light' },
    },
    rerun: {
      executable: process.execPath,
      arguments: [resolve(repository, 'tooling/agent-verification', kind === 'viz' ? 'viz-replay.mjs' : 'replay.mjs'), url],
      cwd: repository,
      environment: kind === 'viz' ? { CRC_VERIFY_DENSITY: String(density) } : {},
      unsetEnvironment: ['CRC_VERIFY_BROWSER_ENDPOINT'],
      outputPolicy: 'fresh-default-directory',
      preconditions: ['Provision the recorded checkout dependencies and Playwright Chromium.',
        'Serve the source Studio from the intended checkout at the recorded URL; served/local identity checks must pass.'],
    },
  };
}


export function replayToolFiles(kind) {
  if (kind !== 'targeting' && kind !== 'viz') throw new Error('Unknown replay kind.');
  const names = [kind === 'viz' ? 'viz-replay.mjs' : 'replay.mjs', 'run-manifest.mjs',
    'identity.mjs', 'evidence-directory.mjs', 'checkpoint.mjs', 'replay-outcome.mjs', 'browser-failure.mjs', 'failure-evidence.mjs'];
  if (kind === 'viz') names.push('numeric-assertion.mjs');
  else names.push('input-provenance.mjs');
  return names.map(name => `tooling/agent-verification/${name}`);
}

export async function captureReplayToolIdentity(repository, kind, revision) {
  return { ...await fingerprint(repository, replayToolFiles(kind), revision),
    schema: 'crc-replay-tool-identity/1',
    scope: 'Replay and declared local dependencies on disk; not loaded-module or installed-dependency attestation.',
  };
}


/** Complete verifier provenance even after an operation or cleanup failure. */
export async function finalizeReplayToolIdentity(report, repository) {
  if (!report.run?.toolIdentity) {
    report.toolVerification = { status: 'unavailable', reason: 'initial-tool-identity-unavailable' };
    if (report.status === 'pass') report.status = 'fail';
    return;
  }
  delete report.run.toolIdentityAfter;
  try {
    report.run.toolIdentityAfter = await captureReplayToolIdentity(repository, report.run.kind, report.run.toolIdentity.revision);
    assert.deepEqual(report.run.toolIdentityAfter, report.run.toolIdentity, 'Replay tooling changed during verification.');
    report.toolVerification = { status: 'matching-on-disk' };
  } catch (error) {
    report.status = 'fail';
    report.toolVerification = { status: 'failed', ...describeReplayError(error) };
  }
}

/** Page-reported facts at one capture boundary, not trusted OS/zoom attestation. */
export async function capturePageEnvironment(page) {
  try {
    return await page.evaluate(() => ({
      status: 'observed',
      scope: 'page-reported-at-capture',
      viewportCss: { width: globalThis.innerWidth, height: globalThis.innerHeight },
      devicePixelRatio: globalThis.devicePixelRatio,
      visualViewportScale: globalThis.visualViewport?.scale ?? null,
      // Visual viewport scale is pinch zoom, not a reliable browser zoom oracle.
      browserZoom: 'unavailable',
      language: globalThis.navigator.language.slice(0, 128),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone.slice(0, 128),
      preferences: {
        dark: globalThis.matchMedia('(prefers-color-scheme: dark)').matches,
        reducedMotion: globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
      },
    }));
  } catch (error) {
    return { status: 'unavailable', scope: 'page-reported-at-capture', failure: describeReplayError(error) };
  }
}
