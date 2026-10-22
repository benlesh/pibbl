import { afterEach, expect, it, vi } from 'vitest';
import { canvas, controllers } from './helpers.js';
let restore = () => {};
afterEach(() => restore());
it('keeps imports inert, compiles sync once and isolates mutable layout memories', async () => {
  const compile = vi.spyOn(WebAssembly, 'compile');
  const NativeModule = WebAssembly.Module, NativeInstance = WebAssembly.Instance;
  let modules = 0;
  const memories: WebAssembly.Memory[] = [];
  WebAssembly.Module = class extends NativeModule { constructor(source: BufferSource) { super(source); modules++; } };
  WebAssembly.Instance = class extends NativeInstance { constructor(module: WebAssembly.Module, imports?: WebAssembly.Imports) { super(module, imports); memories.push(this.exports.memory as WebAssembly.Memory); } };
  restore = () => { WebAssembly.Module = NativeModule; WebAssembly.Instance = NativeInstance; };
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
  const core = await import('@pibbl/core');
  const { pibblSync } = await import('@pibbl/core/sync');
  expect(compile).not.toHaveBeenCalled(); expect(modules).toBe(0); expect(memories).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
  const root = core.createElement(core.Flex, {style:{width:100,height:100},children:core.createElement(core.Rectangle,{style:{width:20,height:20,minWidth:0}})});
  const { ManualSchedulerDriver, installSchedulerDriverForTest } = await import('../../src/lib/scheduler/testing.js');
  const driver = new ManualSchedulerDriver();
  const releaseDriver = installSchedulerDriverForTest(driver);
  const releaseConstructors = restore;
  restore = () => { releaseDriver(); releaseConstructors(); };
  const first = pibblSync(canvas(), root), second = pibblSync(canvas(), root); controllers.push(first,second);
  driver.flush(0);
  expect(modules).toBe(1);
  const wasm = import.meta.env.MODE === 'layout-wasm';
  expect(memories).toHaveLength(wasm ? 2 : 0);
  if (wasm) {
    const [a,b] = memories;
    expect(a).not.toBe(b); expect(a.buffer).not.toBe(b.buffer);
  }
  expect(fetch).not.toHaveBeenCalled();
  first.dispose();
  const {GLOBAL_STATE} = await import('../../src/lib/global-state.js');
  expect(GLOBAL_STATE.pibblInstances.size).toBe(1);
  await core.prepareLayoutEngine();
  expect(fetch).not.toHaveBeenCalled();
});
