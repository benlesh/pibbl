import { afterEach, expect, it, vi } from 'vitest';
import { pibbl, Rectangle, embers, hologram, useVisibilityTransition, type PibblVisibilityTransition } from '@pibbl/core';
import { installSchedulerDriverForTest, ManualSchedulerDriver } from '../src/lib/scheduler/testing';
const roots: ReturnType<typeof pibbl>[] = [];
afterEach(() => { roots.splice(0).forEach(root => root.dispose()); document.body.replaceChildren(); });
for (const [name, factory] of [['embers', embers], ['hologram', hologram]] as const) {
  it(`${name} initializes WASM only while animating and reuses its instance`, () => {
    const Native = WebAssembly.Instance;
    const instances = vi.spyOn(WebAssembly, 'Instance').mockImplementation(function(module, imports) { return new Native(module, imports); });
    const driver = new ManualSchedulerDriver(), restore = installSchedulerDriverForTest(driver);
    const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 200; document.body.append(canvas);
    let handle!: PibblVisibilityTransition;
    try {
      const effect = factory({region:{x:40,y:50,width:120,height:120}, seed: 9});
      function Scene() { handle = useVisibilityTransition({enter:effect,duration:100}); return <Rectangle style={{left:40,top:50,width:120,height:120,fill:'red',transition:handle.binding}} />; }
      const root=pibbl(canvas,<Scene />);roots.push(root);driver.flush(0);
      expect(instances).not.toHaveBeenCalled();
      void handle.hide();driver.flush(10);driver.flush(35);
      expect(instances).toHaveBeenCalledTimes(1);
      driver.flush(60);expect(instances).toHaveBeenCalledTimes(1);
      root.dispose();if(driver.pendingHostFrames)driver.flush(1000);
      expect(handle.status.get()).toBe('disposed');
    } finally { roots.splice(0).forEach(root=>root.dispose());if(driver.pendingHostFrames)driver.flush(2000);restore();instances.mockRestore(); }
  });
}
