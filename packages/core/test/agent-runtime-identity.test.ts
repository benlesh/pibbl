import { crc, createElement, Rectangle } from '@crc/core';
import { createRuntimeCheckedInspector } from '../../../tooling/agent-verification/runtime-inspection';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing';
import { expect, it } from 'vitest';
import { captureRuntimeBinding, compareRuntimeBindings } from '../../../tooling/agent-verification/runtime-identity';
import { snapshotRealmScheduler } from '../src/lib/scheduler/testing';

it('distinguishes an actual iframe runtime without scheduling work in the inspecting realm', async () => {
  const before = snapshotRealmScheduler();
  const local = captureRuntimeBinding();
  const iframe = document.createElement('iframe');
  const loaded = new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve(); iframe.onerror = () => reject(new Error('Runtime identity iframe failed to load'));
  });
  iframe.srcdoc = `<script type="module">
    import { captureRuntimeBinding } from '/tooling/agent-verification/runtime-identity.ts';
    window.runtimeIdentityBinding = captureRuntimeBinding();
  </script>`;
  document.body.append(iframe);
  try {
    await loaded;
    const foreign = (iframe.contentWindow as Window & { runtimeIdentityBinding?: unknown }).runtimeIdentityBinding;
    expect(foreign).toBeDefined();
    const refused = createRuntimeCheckedInspector(document.createElement('canvas'), foreign);
    expect(refused.status).toBe('blocked'); expect(refused.inspector).toBeNull();
    expect(refused.diagnostic.relation).toBe('separate-realms');
    expect(compareRuntimeBindings(local, foreign)).toMatchObject({ relation: 'separate-realms', schedulers: 'independent', versions: 'matching' });
    expect(compareRuntimeBindings(local, captureRuntimeBinding())).toMatchObject({ relation: 'same-runtime', schedulers: 'shared' });
    expect(snapshotRealmScheduler()).toEqual(before);
  } finally { iframe.remove(); }
});

it('requires a matching application binding before exposing targeting operations', () => {
  const driver = new ManualSchedulerDriver(); const restore = installSchedulerDriverForTest(driver);
  const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100; document.body.append(canvas);
  const controller = crc(canvas, createElement(Rectangle, { style: { width: 50, height: 50, fill: 'red' }, onClick: () => undefined }));
  driver.flush(1);
  try {
    const binding = captureRuntimeBinding(); const before = snapshotRealmScheduler();
    const session = createRuntimeCheckedInspector(canvas, binding);
    expect(session.status).toBe('accepted');
    const snapshot = session.inspector!.snapshot();
    expect(snapshot.status).toBe('ready'); expect(snapshot.records).toHaveLength(1);
    expect(session.inspector!.probe(snapshot.generation!, 20, 20).status).toBe('target');
    session.inspector!.dispose();
    for (const supplied of [{}, { ...binding, version: '99.0.0' }, { ...binding, scheduler: () => undefined }]) {
      const blocked = createRuntimeCheckedInspector(canvas, supplied);
      expect(blocked.status).toBe('blocked'); expect(blocked.inspector).toBeNull();
      expect(blocked.reason).toBeTruthy();
    }
    expect(snapshotRealmScheduler()).toEqual(before);
  } finally { controller.dispose(); restore(); canvas.remove(); }
});
