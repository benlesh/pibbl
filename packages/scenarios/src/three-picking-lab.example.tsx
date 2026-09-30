/** @jsxImportSource @crc/core */
import { crc, Rectangle } from '@crc/core';
import { defineThreeLayer } from '@crc/three';
import { BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene } from 'three';
import type { ScenarioDefinition } from './types';

export const THREE_PICKING_SOURCE_ID = 'three-picking-generation-example';
export interface ThreePickingState {
  liveVisible: boolean;
  displayedVisible: boolean;
  frames: number;
  threeClicks: number;
  canvasClicks: number;
}
export const threePickingScenario: ScenarioDefinition<ThreePickingState> = {
  id: 'three-picking-generation', sourceId: THREE_PICKING_SOURCE_ID,
  actionIds: ['mutate-without-frame', 'commit-frame'],
  async mount({ canvas, onStateChange, referenceHost }) {
    let state: ThreePickingState = { liveVisible: true, displayedVisible: false, frames: 0, threeClicks: 0, canvasClicks: 0 };
    let mesh!: Mesh<BoxGeometry, MeshBasicMaterial>;
    let invalidate!: () => void;
    let disposed = false;
    const evidence = referenceHost ? document.createElement('script') : undefined;
    if (evidence) { evidence.type = 'application/json'; evidence.dataset.testid = 'three-picking-evidence'; referenceHost!.append(evidence); }
    const publish = () => {
      if (disposed) return;
      if (evidence) evidence.textContent = JSON.stringify({ schema: 'crc-three-picking-fixture/1', state });
      onStateChange?.({ ...state });
    };
    const assertActive = () => { if (disposed) throw new Error('Three picking lab is disposed.'); };
    const cancellations = new Set<() => void>();
    const settled = async () => {
      assertActive();
      await new Promise<void>((resolve, reject) => {
        let frame = 0;
        let complete = false;
        const finish = (error?: Error) => {
          if (complete) return;
          complete = true;
          cancelAnimationFrame(frame); clearTimeout(timeout); cancellations.delete(cancel);
          if (error) reject(error); else resolve();
        };
        const cancel = () => finish(new Error('Three picking lab disposed while waiting for a frame.'));
        const timeout = setTimeout(() => finish(new Error('Three picking lab frame wait exceeded 5 seconds.')), 5000);
        cancellations.add(cancel);
        frame = requestAnimationFrame(() => {
          if (complete) return;
          frame = requestAnimationFrame(() => finish());
        });
      });
      publish();
    };
    const Layer = defineThreeLayer({
      create(context) {
        invalidate = context.invalidate;
        const scene = new Scene(), camera = new PerspectiveCamera(90, 4 / 3, 0.1, 100);
        camera.position.z = 5;
        mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial({ color: 0xffffff }));
        scene.add(mesh); return { scene, camera };
      },
      render(resources, _frame, context) {
        context.renderer.render(resources.scene, resources.camera);
        state = { ...state, displayedVisible: mesh.visible, frames: state.frames + 1 };
      },
      targets() { return [{ object: mesh, handlers: { onClick() { state = { ...state, threeClicks: state.threeClicks + 1 }; publish(); } } }]; },
      dispose() { mesh.geometry.dispose(); mesh.material.dispose(); },
    });
    const runtime = crc(canvas, <>
      <Rectangle style={{ width: 400, height: 300, fill: '#2563eb' }} onClick={() => { state = { ...state, canvasClicks: state.canvasClicks + 1 }; publish(); }} />
      <Layer style={{ width: 400, height: 300 }} />
    </>, { pixelRatio: 1 });
    const release = () => {
      if (disposed) return;
      disposed = true;
      for (const cancel of cancellations) cancel();
      try { runtime.dispose(); } finally { evidence?.remove(); }
    };
    try { await settled(); } catch (error) { release(); throw error; }
    return {
      getState: () => ({ ...state }), settled,
      async perform(action) {
        assertActive();
        if (action === 'mutate-without-frame') { mesh.visible = false; state = { ...state, liveVisible: false }; }
        else if (action === 'commit-frame') invalidate();
        else throw new Error(`Unknown Three picking action ${action}`);
        await settled();
      },
      async reset() { assertActive(); mesh.visible = true; state = { ...state, liveVisible: true, threeClicks: 0, canvasClicks: 0 }; invalidate(); await settled(); },
      async dispose() { release(); },
    };
  },
  formatState: state => Object.entries(state).map(([label, value]) => ({ label, value: String(value) })),
};
