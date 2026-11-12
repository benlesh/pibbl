import { expect, it } from 'vitest';
import { FocusManagement, Group, HtmlBox, Layer, Rectangle } from '@pibbl/core';
import { pibblSync } from '@pibbl/core/sync';
import { GLOBAL_STATE, getPibblInstance } from '../src/lib/global-state.js';
import type { PibblFocusManager } from '../src/lib/focus/focus-manager.js';
import { ManualSchedulerDriver, installSchedulerDriverForTest } from '../src/lib/scheduler/testing.js';

it('adopts mixed Canvas and HTML bounds for a clean inner focus manager together', () => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;width:160px;height:60px;isolation:isolate';
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 60;
  canvas.style.cssText = 'display:block;width:100%;height:100%';
  const overlay = document.createElement('div'); overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  wrapper.append(canvas, overlay); document.body.append(wrapper);
  const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
  let renders = 0, mounts = 0, updates = 0;
  let inspect: (() => void) | undefined;
  const observed: Array<Array<number | undefined>> = [];
  const mount = (content: HTMLDivElement) => {
    mounts++;
    content.append(document.createElement('input'));
    return () => { updates++; };
  };
  function Inner() {
    renders++;
    return <Group>
      <Rectangle keyboardFocusable onClick={() => {}} style={{ width: 10, height: 10, fill: '#426b61' }} />
      <HtmlBox mount={mount} data={0} style={{ left: 20, width: 10, height: 10 }} />
    </Group>;
  }
  function InspectPublication() {
    if (inspect) GLOBAL_STATE.renderTransaction?.onPublish?.(inspect);
    return undefined;
  }
  const inner = <FocusManagement><Inner /></FocusManagement>;
  const scene = (x: number) => <Group style={{ translateX: x }}>
    <Layer style={{ width: 100, height: 40 }}>{inner}</Layer>
    <InspectPublication />
  </Group>;
  const controller = pibblSync(canvas, scene(20), { htmlOverlay: overlay });
  const bounds = () => (getPibblInstance(canvas).eventRoot.focusPolicy as PibblFocusManager)
    .navigationCandidates.map(candidate => candidate.rootBounds?.x);
  try {
    driver.flush(1);
    expect(bounds()).toEqual([20, 40]);
    inspect = () => observed.push(bounds());
    pibblSync(canvas, scene(50)); driver.flush(2);
    expect(observed).toEqual([[20, 40]]);
    expect(bounds()).toEqual([50, 70]);
    expect(new DOMMatrix(overlay.querySelector<HTMLElement>('[data-pibbl-html-box]')!.style.transform).e).toBe(70);
    expect(renders).toBe(1); expect(mounts).toBe(1); expect(updates).toBe(0);
  } finally { controller.dispose(); restore(); wrapper.remove(); }
});
