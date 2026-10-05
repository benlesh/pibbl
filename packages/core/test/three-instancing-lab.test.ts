import {
  THREE_INSTANCING_LAB_ACTION_IDS,
  THREE_INSTANCING_LAB_PROBES,
  getLearningExampleBySlug,
  getLearningExampleRoute,
  getScenarioRoute,
  loadScenario,
  scenarioCatalog,
  threeInstancingLabScenarioEntry,
  type ScenarioController,
  type ThreeInstancingLabState,
} from '@crc/scenarios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadWorkbenchSource } from '../../../playground/src/learning-sources';
import { loadScenarioSource } from '../../../playground/src/scenario-sources';
import {
  IcosahedronGeometry,
  MeshPhongMaterial,
  Object3D,
  Scene,
  OrbitControls,
} from '../../scenarios/test-support/three-instancing-resources';
import {
  clickLogicalPoint,
  dragPointerLogicalPoint,
  pressKey,
} from './support/user-input';

const activeControllers = new Set<
  ScenarioController<ThreeInstancingLabState>
>();

afterEach(async () => {
  for (const controller of activeControllers) await controller.dispose();
  activeControllers.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function mountThreeInstancingLab() {
  const before = document.createElement('button');
  before.textContent = 'Before Canvas';
  const canvas = document.createElement('canvas');
  canvas.width = threeInstancingLabScenarioEntry.canvas.width;
  canvas.height = threeInstancingLabScenarioEntry.canvas.height;
  canvas.style.cssText = `display:block;width:${canvas.width}px;height:${canvas.height}px`;
  document.body.append(before, canvas);
  const definition = await loadScenario(threeInstancingLabScenarioEntry);
  const controller = await definition.mount({ canvas });
  activeControllers.add(controller);
  await controller.settled();
  return { before, canvas, controller, definition };
}

function pixelAt(
  canvas: HTMLCanvasElement,
  point: Readonly<{ x: number; y: number }>,
): readonly number[] {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The Three instancing Canvas has no 2D context.');
  return [...context.getImageData(point.x, point.y, 1, 1).data];
}

function pixelSignature(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The Three instancing Canvas has no 2D context.');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 2166136261;
  for (const value of pixels) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function applicationResourceIdentities(
  renderedScenes: readonly Object3D[],
): Readonly<{
  geometries: readonly IcosahedronGeometry[];
  materials: readonly MeshPhongMaterial[];
}> {
  const geometries = new Set<IcosahedronGeometry>();
  const materials = new Set<MeshPhongMaterial>();
  // Only the application scene is submitted to the GPU renderer. Picking
  // snapshots also call Object3D.add but their CPU copies are not app resources.
  for (const scene of renderedScenes) scene.traverse(object => {
    const mesh = object as Object3D & {
      readonly geometry?: unknown;
      readonly material?: unknown;
    };
    if (mesh.geometry instanceof IcosahedronGeometry) {
      geometries.add(mesh.geometry);
    }
    if (mesh.material instanceof MeshPhongMaterial) {
      materials.add(mesh.material);
    }
  });
  return {
    geometries: [...geometries],
    materials: [...materials],
  };
}

function expectEachIdentityExactlyOnce<T>(
  actual: readonly T[],
  expected: readonly T[],
): void {
  expect(actual).toHaveLength(expected.length);
  for (const identity of expected) {
    expect(actual.filter((candidate) => candidate === identity)).toHaveLength(1);
  }
}

describe('public Three instancing proving scenarios', () => {
  it('registers the exact attributed learning and deterministic laboratory surfaces', async () => {
    const learning = getLearningExampleBySlug('three-instancing');
    expect(learning).toMatchObject({
      slug: 'three-instancing',
      section: 'three',
      order: 116,
      api: [
        'defineThreeLayer',
        'InstancedMesh',
        'OrbitControls',
        'missBehavior',
      ],
      source: {
        path: 'packages/scenarios/src/learning/three/three-instancing.example.tsx',
      },
    });
    expect(learning && getLearningExampleRoute(learning)).toBe(
      '#/examples/three/three-instancing',
    );

    expect(scenarioCatalog).toContain(threeInstancingLabScenarioEntry);
    expect(getScenarioRoute(threeInstancingLabScenarioEntry)).toBe(
      '#/testing/three-instancing',
    );
    expect(threeInstancingLabScenarioEntry).toMatchObject({
      metadata: {
        id: 'three-instancing',
        slug: 'three-instancing',
        learningOrder: 177,
      },
      canvas: { width: 640, height: 360 },
      source: {
        id: 'three-instancing-laboratory-example',
        marker:
          "THREE_INSTANCING_LAB_SOURCE_ID = 'three-instancing-laboratory-example'",
        path: 'packages/scenarios/src/three-instancing-lab.example.tsx',
      },
    });
    expect(THREE_INSTANCING_LAB_ACTION_IDS).toEqual([
      'cycle-miss-behavior',
      'resize-layer',
    ]);
    expect(
      threeInstancingLabScenarioEntry.actions.map((action) => action.id),
    ).toEqual(THREE_INSTANCING_LAB_ACTION_IDS);

    if (!learning) throw new Error('Missing three-instancing learning example.');
    const [learningSource, labSource] = await Promise.all([
      loadWorkbenchSource(learning),
      loadScenarioSource(threeInstancingLabScenarioEntry),
    ]);
    for (const source of [learningSource, labSource]) {
      expect(source).toContain(
        'https://github.com/mrdoob/three.js/blob/dev/examples/webgl_instancing_raycast.html',
      );
      expect(source).toContain(
        'https://github.com/mrdoob/three.js/blob/dev/LICENSE',
      );
      expect(source).toMatch(/from ['"]@crc\/core['"]/u);
      expect(source).toMatch(/from ['"]@crc\/three['"]/u);
      expect(source).toMatch(/from ['"]three['"]/u);
      expect(source).toMatch(
        /from ['"]three\/addons\/controls\/OrbitControls\.js['"]/u,
      );
      expect(source).not.toMatch(
        /@crc\/core\/(?:internal|lib|src)|@crc\/webgl|requestAnimationFrame|setAnimationLoop/u,
      );
    }

    const definition = await loadScenario(threeInstancingLabScenarioEntry);
    expect(definition).toMatchObject({
      id: 'three-instancing',
      sourceId: 'three-instancing-laboratory-example',
      actionIds: THREE_INSTANCING_LAB_ACTION_IDS,
    });
    expect(
      definition.formatState({
        missBehavior: 'pass-through',
        lastResolution: 'Three target',
        tileClicks: 2,
        threeTargetClicks: 3,
        blockedThreeInputs: 4,
        cameraChanges: 5,
        targetPropagationTrace: ['capture', 'target', 'bubble'],
        revision: 6,
      }),
    ).toEqual([
      { label: 'Miss behavior', value: 'pass-through' },
      { label: 'Last resolution', value: 'Three target' },
      { label: 'CRC tile clicks', value: '2' },
      { label: 'Three target clicks', value: '3' },
      { label: 'Blocked Three inputs', value: '4' },
      { label: 'Camera changes', value: '5' },
      { label: 'Target propagation', value: 'capture → target → bubble' },
      { label: 'Revision', value: '6' },
    ]);
  });

  it('arbitrates exposed tiles, unregistered instances, a registered target, gaps, and the foreground toolbar', async () => {
    const { canvas, controller } = await mountThreeInstancingLab();
    expect(controller.getState()).toEqual({
      missBehavior: 'pass-through',
      lastResolution: 'none',
      tileClicks: 0,
      threeTargetClicks: 0,
      blockedThreeInputs: 0,
      cameraChanges: 0,
      targetPropagationTrace: [],
      revision: 0,
    });
    await clickLogicalPoint(canvas, THREE_INSTANCING_LAB_PROBES.exposedTile);
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'CRC tile',
      tileClicks: 1,
    });

    await clickLogicalPoint(canvas, THREE_INSTANCING_LAB_PROBES.emptyGap);
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'CRC tile',
      tileClicks: 2,
    });

    await clickLogicalPoint(
      canvas,
      THREE_INSTANCING_LAB_PROBES.unregisteredInstance,
    );
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'Three blocked',
      tileClicks: 2,
      blockedThreeInputs: 1,
    });

    await clickLogicalPoint(canvas, THREE_INSTANCING_LAB_PROBES.registeredTarget);
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'Three target',
      threeTargetClicks: 1,
      targetPropagationTrace: ['capture', 'target', 'bubble'],
    });

    const blockedBeforeToolbar = controller.getState().blockedThreeInputs;
    await clickLogicalPoint(
      canvas,
      THREE_INSTANCING_LAB_PROBES.foregroundToolbar,
    );
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'Toolbar',
      blockedThreeInputs: blockedBeforeToolbar,
    });
  });

  it('cycles miss policy and orbits through CRC-routed target-layer input without touching lower tiles', async () => {
    const { canvas, controller } = await mountThreeInstancingLab();

    await controller.perform('cycle-miss-behavior');
    expect(controller.getState()).toMatchObject({
      missBehavior: 'block',
      lastResolution: 'none',
      revision: 1,
    });
    await clickLogicalPoint(canvas, THREE_INSTANCING_LAB_PROBES.emptyGap);
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'none',
      tileClicks: 0,
    });

    await controller.perform('cycle-miss-behavior');
    expect(controller.getState()).toMatchObject({
      missBehavior: 'target-layer',
      revision: 2,
    });
    await dragPointerLogicalPoint(
      canvas,
      THREE_INSTANCING_LAB_PROBES.emptyGap,
      {
        x: THREE_INSTANCING_LAB_PROBES.emptyGap.x - 38,
        y: THREE_INSTANCING_LAB_PROBES.emptyGap.y - 22,
      },
    );
    await controller.settled();
    expect(controller.getState().cameraChanges).toBeGreaterThan(0);
    expect(controller.getState().tileClicks).toBe(0);
  });

  it('focuses the registered Three object and gives Enter and Space the same CRC propagation path', async () => {
    const { before, controller } = await mountThreeInstancingLab();
    before.focus();
    await pressKey('Enter');
    expect(controller.getState().threeTargetClicks).toBe(0);

    // The registered Three object is the scene's only logical focus target.
    await import('./support/user-input').then(({ tab }) => tab());
    await pressKey('Enter');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'Three target',
      threeTargetClicks: 1,
      targetPropagationTrace: ['capture', 'target', 'bubble'],
    });

    await pressKey('Space');
    await controller.settled();
    expect(controller.getState()).toMatchObject({
      lastResolution: 'Three target',
      threeTargetClicks: 2,
      targetPropagationTrace: ['capture', 'target', 'bubble'],
    });
  });

  it('composes the transparent bitmap through the outer clip/filter, resizes it, and disposes application resources once', async () => {
    const controls = new Set<OrbitControls>();
    const originalControlsUpdate = OrbitControls.prototype.update;
    vi.spyOn(OrbitControls.prototype, 'update').mockImplementation(function (
      this: OrbitControls,
      ...args: Parameters<OrbitControls['update']>
    ) {
      controls.add(this);
      return originalControlsUpdate.apply(this, args);
    });
    const renderedScenes = new Set<Scene>();
    const originalBeforeRender = Scene.prototype.onBeforeRender;
    vi.spyOn(Scene.prototype, 'onBeforeRender').mockImplementation(function (this: Scene, ...args: Parameters<Scene['onBeforeRender']>) {
      renderedScenes.add(this);
      return originalBeforeRender.apply(this, args);
    });
    const disposedControls: OrbitControls[] = [];
    const originalControlsDispose = OrbitControls.prototype.dispose;
    const controlsDispose = vi
      .spyOn(OrbitControls.prototype, 'dispose')
      .mockImplementation(function (this: OrbitControls) {
        disposedControls.push(this);
        return originalControlsDispose.call(this);
      });
    const disposedGeometries: IcosahedronGeometry[] = [];
    const originalGeometryDispose = IcosahedronGeometry.prototype.dispose;
    const geometryDispose = vi
      .spyOn(IcosahedronGeometry.prototype, 'dispose')
      .mockImplementation(function (this: IcosahedronGeometry) {
        disposedGeometries.push(this);
        return originalGeometryDispose.call(this);
      });
    const disposedMaterials: MeshPhongMaterial[] = [];
    const originalMaterialDispose = MeshPhongMaterial.prototype.dispose;
    const materialDispose = vi
      .spyOn(MeshPhongMaterial.prototype, 'dispose')
      .mockImplementation(function (this: MeshPhongMaterial) {
        disposedMaterials.push(this);
        return originalMaterialDispose.call(this);
      });

    const { canvas, controller } = await mountThreeInstancingLab();
    const initialResources = applicationResourceIdentities([...renderedScenes]);
    const initialControls = [...controls];
    expect(initialControls).toHaveLength(1);
    expect(initialResources.geometries).toHaveLength(2);
    expect(initialResources.materials).toHaveLength(2);
    expect(controlsDispose).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    expect(pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.exposedTile)[3]).toBe(255);
    expect(pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.registeredTarget)).not.toEqual(
      pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.emptyGap),
    );
    expect(
      Math.max(
        ...pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.unregisteredInstance).slice(
          0,
          3,
        ),
      ),
    ).toBeGreaterThan(20);
    expect(pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.clippedAway)).toEqual(
      pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.exposedTile),
    );
    expect(pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.filteredShadow)).not.toEqual(
      pixelAt(canvas, THREE_INSTANCING_LAB_PROBES.exposedTile),
    );

    const beforeResize = pixelSignature(canvas);
    await controller.perform('resize-layer');
    await controller.settled();
    expect(controller.getState().revision).toBe(1);
    expect(pixelSignature(canvas)).not.toBe(beforeResize);
    const resizedResources = applicationResourceIdentities([...renderedScenes]);
    const resizedControls = [...controls];
    expect(resizedControls).toHaveLength(1);
    expect(resizedControls[0]).toBe(initialControls[0]);
    expect(resizedResources.geometries).toHaveLength(2);
    expect(resizedResources.geometries[0]).toBe(initialResources.geometries[0]);
    expect(resizedResources.geometries[1]).toBe(initialResources.geometries[1]);
    expect(resizedResources.materials).toHaveLength(2);
    expect(resizedResources.materials[0]).toBe(initialResources.materials[0]);
    expect(resizedResources.materials[1]).toBe(initialResources.materials[1]);
    expect(controlsDispose).not.toHaveBeenCalled();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    const stateBeforeDispose = controller.getState();
    await controller.dispose();
    activeControllers.delete(controller);
    expectEachIdentityExactlyOnce(disposedControls, initialControls);
    expectEachIdentityExactlyOnce(
      disposedGeometries,
      initialResources.geometries,
    );
    expectEachIdentityExactlyOnce(
      disposedMaterials,
      initialResources.materials,
    );
    const firstDisposedControls = [...disposedControls];
    const firstDisposedGeometries = [...disposedGeometries];
    const firstDisposedMaterials = [...disposedMaterials];

    await controller.dispose();
    expect(disposedControls).toEqual(firstDisposedControls);
    expect(disposedGeometries).toEqual(firstDisposedGeometries);
    expect(disposedMaterials).toEqual(firstDisposedMaterials);
    expectEachIdentityExactlyOnce(disposedControls, initialControls);
    expectEachIdentityExactlyOnce(
      disposedGeometries,
      initialResources.geometries,
    );
    expectEachIdentityExactlyOnce(
      disposedMaterials,
      initialResources.materials,
    );
    expect(controller.getState()).toEqual(stateBeforeDispose);
    await expect(controller.perform('resize-layer')).rejects.toThrow(
      /disposed Three instancing laboratory/u,
    );
  });
});
