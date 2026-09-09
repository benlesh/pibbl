import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rectangle } from '../../index.js';
import {
  createBackendToken,
  defineBackendPrimitive,
  getBackendEnvironment,
  getCurrentFrameTimestamp,
  mountBackendCRC,
  requestCurrentInstanceFrame,
  setCurrentComponentAfterRender,
  useInternalHookSlot,
  type CRCBackendDriver,
  type CRCBackendFrame,
} from '../../internal.js';
import { executeRender } from '../execute-render.js';
import {
  clearSharedState,
  getCRCInstance,
  GLOBAL_STATE,
} from '../global-state.js';
import { crcWhenChanged } from '../hooks/crc-when-changed.js';
import { mountCRC } from '../mount-crc.js';
import type { CRCNode } from '../types.js';

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('backend-neutral component traversal', () => {
  it('dispatches one traversal through the selected backend and retains keyed hook identity', () => {
    const backend = createRecordingBackend('test');
    const identities: object[] = [];
    const timestamps: number[] = [];
    const environments: object[] = [];
    const cleanup = vi.fn();
    const Primitive = defineBackendPrimitive<{
      value: number;
    }, {}, {}, {}, TestEnvironment>(
      backend.driver.token,
      function renderTestPrimitive({ value }, _style, environment) {
        expect(value).toBeGreaterThan(0);
        environments.push(environment);
      },
    );
    function Stateful({ value }: { value: number }): CRCNode {
      const identity = useInternalHookSlot('backend-test-identity', teardowns => {
        teardowns.add(cleanup);
        return {};
      });
      identities.push(identity.value);
      timestamps.push(getCurrentFrameTimestamp());
      expect(getBackendEnvironment<TestEnvironment>(backend.driver.token))
        .toBe(backend.environment);
      return <Primitive value={value} />;
    }

    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(96, 48);
    const mount = mountBackendCRC(canvas, <Stateful key="stable" value={1} />, {
      parent: parentCanvas,
      logicalWidth: 32,
      logicalHeight: 16,
      driver: backend.driver,
    });

    mount.render(<Stateful key="stable" value={1} />, 10);
    mount.render(<Stateful key="stable" value={2} />, 20);

    expect(identities).toHaveLength(2);
    expect(identities[1]).toBe(identities[0]);
    expect(timestamps).toEqual([10, 20]);
    expect(environments).toEqual([
      backend.environment,
      backend.environment,
    ]);
    expect(backend.calls).toEqual([
      'begin:32x16@96x48:10',
      'enter',
      'enter',
      'primitive:TestPrimitive',
      'exit',
      'exit',
      'finish:true',
      'begin:32x16@96x48:20',
      'enter',
      'enter',
      'primitive:TestPrimitive',
      'exit',
      'exit',
      'finish:true',
    ]);
    expect(cleanup).not.toHaveBeenCalled();

    mount.dispose();
    mount.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(backend.calls.at(-1)).toBe('dispose');
    expect(backend.calls.filter(call => call === 'dispose')).toHaveLength(1);
    parent.dispose();
  });

  it('runs component after-render work before returning control to the backend', () => {
    const backend = createRecordingBackend('test');
    const Primitive = defineBackendPrimitive<{}, {}, {}, {}, TestEnvironment>(
      backend.driver.token,
      function renderOrderedPrimitive() {
        backend.calls.push('program');
        setCurrentComponentAfterRender(() => {
          backend.calls.push('after-render');
        });
      },
    );
    const driver: CRCBackendDriver<TestEnvironment> = {
      ...backend.driver,
      runPrimitive(frame, input, runProgram) {
        backend.calls.push(`primitive:${input.componentName}`);
        const program = input.definition.program as (
          props: typeof input.props,
          style: typeof input.style,
          environment: TestEnvironment,
        ) => CRCNode | void;
        runProgram(() => program(input.props, input.style, frame.environment));
        backend.calls.push('primitive-finished');
      },
    };
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(10, 10);
    const mount = mountBackendCRC(canvas, <Primitive />, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver,
    });

    mount.render(<Primitive />, 1);

    expect(backend.calls).toEqual([
      'begin:10x10@10x10:1',
      'enter',
      'primitive:OrderedPrimitive',
      'program',
      'after-render',
      'primitive-finished',
      'exit',
      'finish:true',
    ]);

    mount.dispose();
    parent.dispose();
  });

  it('finishes a failed backend frame, tears down its tree, and restores every parent render slot', () => {
    const backend = createRecordingBackend('test');
    const cleanup = vi.fn();
    const afterRender = vi.fn();
    const Throwing = defineBackendPrimitive<{}, {}, {}, {}, TestEnvironment>(
      backend.driver.token,
      function renderThrowing() {
        throw new Error('backend primitive failed');
      },
    );
    function FailingScene(): CRCNode {
      crcWhenChanged(() => cleanup, []);
      setCurrentComponentAfterRender(afterRender);
      return <Throwing />;
    }

    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(20, 10);
    const child = mountBackendCRC(canvas, <FailingScene />, {
      parent: parentCanvas,
      logicalWidth: 20,
      logicalHeight: 10,
      driver: backend.driver,
    });
    let observedError: unknown;
    let restored = false;
    function ParentProbe(): void {
      const before = snapshotRenderGlobals();
      try {
        child.render(<FailingScene />, 41);
      } catch (error) {
        observedError = error;
      }
      restored = haveSameRenderGlobals(before, snapshotRenderGlobals());
    }

    executeRender(parentCanvas, 40, <ParentProbe />);

    expect(observedError).toMatchObject({
      message: 'backend primitive failed',
    });
    expect(restored).toBe(true);
    expect(backend.calls).toEqual([
      'begin:20x10@20x10:41',
      'enter',
      'enter',
      'primitive:Throwing',
      'exit',
      'exit',
      'finish:false',
    ]);
    expect(afterRender).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(getCRCInstance(canvas).refs.size).toBe(0);

    child.dispose();
    parent.dispose();
  });

  it('reports both backend names for unsupported primitive placement', () => {
    const webgl = createRecordingBackend('webgl2');
    const Cube = defineBackendPrimitive<{}, {}, {}, {}, TestEnvironment>(
      webgl.driver.token,
      function renderCube() {},
    );
    const canvas = createCanvas();
    const canvasRoot = mountCRC(canvas, <Cube />);

    expect(() => executeRender(canvas, 1)).toThrowError(
      'Cube requires the webgl2 backend and cannot render in the canvas2d ' +
      'root. Place it under <WebGLLayer>.',
    );
    canvasRoot.dispose();

    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const childCanvas = new OffscreenCanvas(10, 10);
    const child = mountBackendCRC(childCanvas, <Rectangle style={{
      width: 10,
      height: 10,
    }} />, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: webgl.driver,
    });

    expect(() => child.render(<Rectangle style={{
      width: 10,
      height: 10,
    }} />, 2)).toThrowError(
      /Rectangle requires the canvas2d backend and cannot render in the webgl2 root.*Canvas 2D children inside a WebGL island are unsupported/i,
    );
    expect(webgl.calls.at(-1)).toBe('finish:false');

    child.dispose();
    parent.dispose();
  });

  it('routes current-instance frame requests through the existing coalescing and stale-owner checks', () => {
    const callbacks: FrameRequestCallback[] = [];
    const request = vi.spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const backend = createRecordingBackend('test');
    function Animated(): void {
      requestCurrentInstanceFrame(true);
      requestCurrentInstanceFrame(true);
    }
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(10, 10);
    const child = mountBackendCRC(canvas, <Animated />, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: backend.driver,
    });

    child.render(<Animated />, 5);
    expect(request).toHaveBeenCalledOnce();
    const stale = callbacks[0];

    child.dispose();
    expect(cancel).toHaveBeenCalledWith(1);
    stale(6);
    expect(backend.calls.filter(call => call.startsWith('begin:')))
      .toHaveLength(1);

    parent.dispose();
  });
});

interface TestEnvironment {
  readonly label: string;
}

function createRecordingBackend(name: string): {
  readonly driver: CRCBackendDriver<TestEnvironment>;
  readonly environment: TestEnvironment;
  readonly calls: string[];
} {
  const calls: string[] = [];
  const environment = Object.freeze({ label: `${name}-environment` });
  const token = createBackendToken(name);
  const driver: CRCBackendDriver<TestEnvironment> = {
    token,
    name,
    beginFrame(input) {
      calls.push(
        `begin:${input.logicalWidth}x${input.logicalHeight}` +
        `@${input.backingWidth}x${input.backingHeight}` +
        `:${input.renderTimestamp}`,
      );
      return { environment };
    },
    enterComponent(_frame) {
      calls.push('enter');
      return () => calls.push('exit');
    },
    runPrimitive(frame, input, runProgram) {
      calls.push(`primitive:${input.componentName}`);
      const program = input.definition.program as (
        props: typeof input.props,
        style: typeof input.style,
        environment: TestEnvironment,
      ) => CRCNode | void;
      runProgram(() => program(input.props, input.style, frame.environment));
    },
    finishFrame(_frame, success) {
      calls.push(`finish:${success}`);
    },
    dispose() {
      calls.push('dispose');
    },
  };
  return { driver, environment, calls };
}

interface RenderGlobalsSnapshot {
  readonly backendDriver: unknown;
  readonly backendFrame: CRCBackendFrame<unknown> | undefined;
  readonly backendEnvironment: unknown;
  readonly currentCRCInstance: unknown;
  readonly canvas: unknown;
  readonly componentRefs: unknown;
  readonly componentHookIndex: number;
  readonly componentIsMounting: boolean;
  readonly renderContext: unknown;
  readonly renderTarget: unknown;
  readonly worldBaseTransform: unknown;
  readonly renderTransaction: unknown;
  readonly primitiveReceiverToken: unknown;
  readonly unseenIds: unknown;
  readonly seenIds: unknown;
  readonly seenKeys: unknown;
  readonly clippingStack: unknown;
  readonly layoutStack: unknown;
}

function snapshotRenderGlobals(): RenderGlobalsSnapshot {
  return {
    backendDriver: GLOBAL_STATE.backendDriver,
    backendFrame: GLOBAL_STATE.backendFrame,
    backendEnvironment: GLOBAL_STATE.backendEnvironment,
    currentCRCInstance: GLOBAL_STATE.currentCRCInstance,
    canvas: GLOBAL_STATE.canvas,
    componentRefs: GLOBAL_STATE.componentRefs,
    componentHookIndex: GLOBAL_STATE.componentHookIndex,
    componentIsMounting: GLOBAL_STATE.componentIsMounting,
    renderContext: GLOBAL_STATE.renderContext,
    renderTarget: GLOBAL_STATE.renderTarget,
    worldBaseTransform: GLOBAL_STATE.worldBaseTransform,
    renderTransaction: GLOBAL_STATE.renderTransaction,
    primitiveReceiverToken: GLOBAL_STATE.primitiveReceiverToken,
    unseenIds: GLOBAL_STATE.unseenIds,
    seenIds: GLOBAL_STATE.seenIds,
    seenKeys: GLOBAL_STATE.seenKeys,
    clippingStack: GLOBAL_STATE.clippingStack,
    layoutStack: GLOBAL_STATE.layoutStack,
  };
}

function haveSameRenderGlobals(
  left: RenderGlobalsSnapshot,
  right: RenderGlobalsSnapshot,
): boolean {
  return Reflect.ownKeys(left).every(key =>
    left[key as keyof RenderGlobalsSnapshot] ===
      right[key as keyof RenderGlobalsSnapshot]
  );
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 50;
  canvas.style.cssText = 'display:block;width:100px;height:50px';
  document.body.appendChild(canvas);
  return canvas;
}
