import { afterEach, describe, expect, it, vi } from 'vitest';
import { Rectangle, definePrimitive } from '../../index.js';
import { jsxDEV } from '../../jsx-dev-runtime.js';
import {
  createBackendToken,
  defineBackendPrimitive,
  getBackendEnvironment,
  getCurrentBackendHostCanvas,
  getCurrentFrameTimestamp,
  getCurrentSurfaceDensity,
  isBackendEventTargetLive,
  mountBackendCRC,
  registerNestedInteractionResolver,
  requestCurrentInstanceFrame,
  setCurrentComponentAfterRender,
  useBackendEventTarget,
  useInternalHookSlot,
  type CRCBackendDriver,
  type CRCBackendFrame,
  type CRCBackendMount,
} from '../../internal.js';
import { executeRender } from '../execute-render.js';
import {
  clearSharedState,
  getCRCInstance,
  GLOBAL_STATE,
} from '../global-state.js';
import { useWhenChanged } from '../hooks/use-when-changed.js';
import { mountCRC } from '../mount-crc.js';
import type { FilterWindows } from '../filter/filter-region.js';
import type { CRCNode } from '../types.js';

afterEach(() => {
  clearSharedState();
  vi.restoreAllMocks();
});

describe('backend-neutral component traversal', () => {
  it.each(['auto', 'none'] as const)(
    'rejects a same-root sibling claiming one nested child with pointer events %s',
    pointerEvents => {
      let duplicateError: unknown;
      let originalEventParent: unknown;
      let originalFocusBridge: unknown;
      const parentCanvas = createCanvas();
      const parent = mountCRC(parentCanvas, undefined);
      const childCanvas = new OffscreenCanvas(10, 10);
      const backend = createRecordingBackend(`sibling-${pointerEvents}`);
      const child = mountBackendCRC(childCanvas, undefined, {
        parent: parentCanvas,
        logicalWidth: 10,
        logicalHeight: 10,
        driver: backend.driver,
      });
      const childInstance = getCRCInstance(childCanvas);
      const Resolver = definePrimitive<{
        readonly contender?: boolean;
      }>(function renderSiblingResolver({ contender }) {
        const bounds = new Path2D();
        bounds.rect(0, 0, 10, 10);
        try {
          registerNestedInteractionResolver({
            bounds,
            child,
            pointerEvents,
            resolveLocal() {},
          });
        } catch (error) {
          if (!contender) throw error;
          duplicateError = error;
        }
        if (!contender) {
          originalEventParent = childInstance.eventParent;
          originalFocusBridge = childInstance.focusParentBridge;
        }
      });

      executeRender(parentCanvas, 1, [
        <Resolver key="owner" />,
        <Resolver key="contender" contender />,
      ]);

      expect(duplicateError).toMatchObject({
        message: expect.stringMatching(/nested.*already.*resolver/i),
      });
      expect(childInstance.eventParent).toBe(originalEventParent);
      expect(childInstance.focusParentBridge).toBe(originalFocusBridge);
      expect(Array.from(parentCanvasEntries(parentCanvas))).toEqual(
        pointerEvents === 'auto' ? [originalFocusBridge] : [],
      );

      duplicateError = undefined;
      executeRender(parentCanvas, 2, <Resolver key="owner" />);

      expect(duplicateError).toBeUndefined();
      expect(childInstance.eventParent).toBe(originalEventParent);
      expect(childInstance.focusParentBridge).toBe(originalFocusBridge);
      expect(Array.from(parentCanvasEntries(parentCanvas))).toEqual(
        pointerEvents === 'auto' ? [originalFocusBridge] : [],
      );

      parent.dispose();
      expect(childInstance.eventParent).toBeUndefined();
      expect(childInstance.focusParentBridge).toBeUndefined();
      child.dispose();
    },
  );

  it('rejects a nested focus bridge from a different event root', () => {
    const Bridge = definePrimitive<{
      readonly child: CRCBackendMount;
    }>(function renderCrossRootBridge(props) {
      const bounds = new Path2D();
      bounds.rect(0, 0, 10, 10);
      registerNestedInteractionResolver({
        bounds,
        child: props.child,
        pointerEvents: 'none',
        resolveLocal() {},
      });
    });
    const firstCanvas = createCanvas();
    const firstParent = mountCRC(firstCanvas, undefined);
    const childCanvas = new OffscreenCanvas(10, 10);
    const backend = createRecordingBackend('cross-root-child');
    const child = mountBackendCRC(childCanvas, undefined, {
      parent: firstCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: backend.driver,
    });
    const secondCanvas = createCanvas();
    const secondParent = mountCRC(secondCanvas, <Bridge child={child} />);
    const childInstance = getCRCInstance(childCanvas);

    expect(() => executeRender(secondCanvas, 1)).toThrowError(
      /nested.*same event root/i,
    );
    expect((childInstance as typeof childInstance & {
      readonly focusParentBridge?: unknown;
    }).focusParentBridge).toBeUndefined();

    child.dispose();
    firstParent.dispose();
    secondParent.dispose();
  });

  it('reports backend target liveness from registration, root membership, and teardown', () => {
    let target: ReturnType<typeof useBackendEventTarget>;
    function TargetProbe(): void {
      target = useBackendEventTarget({});
    }
    const canvas = createCanvas();
    const controller = mountCRC(canvas, <TargetProbe />);

    executeRender(canvas, 1);

    expect(target).toBeDefined();
    expect(isBackendEventTargetLive(target!)).toBe(true);
    target!.owner.eventRoot.targets.delete(target!);
    expect(isBackendEventTargetLive(target!)).toBe(false);
    target!.owner.eventRoot.targets.add(target!);
    expect(isBackendEventTargetLive(target!)).toBe(true);
    target!.live = false;
    expect(isBackendEventTargetLive(target!)).toBe(false);
    target!.live = true;
    expect(isBackendEventTargetLive(target!)).toBe(true);

    controller.dispose();
    expect(isBackendEventTargetLive(target!)).toBe(false);
    target!.live = true;
    target!.owner.eventRoot.targets.add(target!);
    expect(isBackendEventTargetLive(target!)).toBe(false);
  });

  it('exposes the owning Canvas and anisotropic surface density inside a filtered primitive', () => {
    const observations: Array<{
      host: unknown;
      drawingTarget: unknown;
      density: unknown;
    }> = [];
    const Probe = definePrimitive<{}>(function renderFriendSurfaceProbe(
      _props,
      _style,
      context,
    ) {
      observations.push({
        host: getCurrentBackendHostCanvas(),
        drawingTarget: context.canvas,
        density: getCurrentSurfaceDensity(),
      });
    });
    const canvas = createCanvas();
    const controller = mountCRC(canvas, <Probe style={{
      filter: { type: 'opacity', amount: 0.5 },
    }} />, {
      viewport: { width: 80, height: 20 },
      fit: 'fill',
      pixelRatio: 2,
    });

    executeRender(canvas, 1);

    expect(observations).toEqual([{
      host: canvas,
      drawingTarget: expect.not.objectContaining({ ownerDocument: document }),
      density: { x: 2.5, y: 5 },
    }]);
    expect(observations[0]!.drawingTarget).not.toBe(canvas);
    controller.dispose();
  });

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

  it('resizes a managed backend surface in place before its next frame', () => {
    const backend = createRecordingBackend('test');
    const identities: object[] = [];
    const cleanup = vi.fn();
    function Stateful(): void {
      const identity = useInternalHookSlot('backend-resize-identity', teardowns => {
        teardowns.add(cleanup);
        return {};
      });
      identities.push(identity.value);
    }
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(20, 10);
    const root = <Stateful key="stable" />;
    const mount = mountBackendCRC(canvas, root, {
      parent: parentCanvas,
      logicalWidth: 20,
      logicalHeight: 10,
      driver: backend.driver,
    });

    mount.render(root, 1);
    canvas.width = 60;
    canvas.height = 40;
    mount.resize(30, 20);
    mount.render(root, 2);

    expect(identities).toHaveLength(2);
    expect(identities[1]).toBe(identities[0]);
    expect(cleanup).not.toHaveBeenCalled();
    expect(backend.calls.filter(call => call.startsWith('begin:'))).toEqual([
      'begin:20x10@20x10:1',
      'begin:30x20@60x40:2',
    ]);
    expect(getCRCInstance(canvas).surface).toMatchObject({
      kind: 'layer',
      managed: true,
      snapshot: {
        logicalWidth: 30,
        logicalHeight: 20,
        backingWidth: 60,
        backingHeight: 40,
        backingPixelsPerLogicalUnitX: 2,
        backingPixelsPerLogicalUnitY: 2,
      },
    });

    mount.dispose();
    mount.dispose();
    expect(cleanup).toHaveBeenCalledOnce();
    parent.dispose();
  });

  it('isolates a no-attachment backend frame from Canvas anchors and restores its caller', () => {
    const backend = createRecordingBackend('webgl-no-attachment');
    const observedAnchors: Array<readonly [DOMMatrix | undefined, DOMMatrix | undefined]> = [];
    const driver: CRCBackendDriver<TestEnvironment> = {
      ...backend.driver,
      runPrimitive(frame, input, runProgram) {
        observedAnchors.push([
          GLOBAL_STATE.worldExactTransform,
          GLOBAL_STATE.worldPaintAnchorTransform,
        ]);
        const program = input.definition.program as (
          props: typeof input.props,
          style: typeof input.style,
          environment: TestEnvironment,
        ) => CRCNode | void;
        runProgram(() => program(input.props, input.style, frame.environment));
      },
    };
    const Primitive = defineBackendPrimitive<{}, {}, {}, {}, TestEnvironment>(
      driver.token,
      function renderWebglStylePrimitive() {},
    );
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const child = mountBackendCRC(
      new OffscreenCanvas(10, 10),
      <Primitive />,
      {
        parent: parentCanvas,
        logicalWidth: 10,
        logicalHeight: 10,
        driver,
      },
    );
    const callerExact = new DOMMatrix().translate(17, 19);
    const callerPaint = new DOMMatrix().rotate(23);
    GLOBAL_STATE.worldExactTransform = callerExact;
    GLOBAL_STATE.worldPaintAnchorTransform = callerPaint;

    expect(() => child.render(<Primitive />, 1)).not.toThrow();
    expect(observedAnchors).toEqual([[undefined, undefined]]);
    expect(GLOBAL_STATE.worldExactTransform).toBe(callerExact);
    expect(GLOBAL_STATE.worldPaintAnchorTransform).toBe(callerPaint);

    child.dispose();
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
      useWhenChanged(() => cleanup, []);
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
    const webGLSource = {
      fileName: '/app/webgl-scene.tsx',
      lineNumber: 12,
      columnNumber: 7,
    };
    const canvasRoot = mountCRC(
      canvas,
      jsxDEV(Cube, {}, undefined, false, webGLSource, undefined),
    );

    expect(() => executeRender(canvas, 1)).toThrowError(
      'Cube requires the webgl2 backend and cannot render in the canvas2d ' +
      'root. Place it under <WebGLLayer>. ' +
      'JSX source: /app/webgl-scene.tsx:12:7.',
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

    const canvasSource = {
      fileName: '/app/canvas-child.tsx',
      lineNumber: 28,
      columnNumber: 11,
    };
    expect(() => child.render(jsxDEV(Rectangle, {
      style: { width: 10, height: 10 },
    }, undefined, false, canvasSource, undefined), 2)).toThrowError(
      /Rectangle requires the canvas2d backend and cannot render in the webgl2 root.*Canvas 2D children inside a WebGL island are unsupported.*JSX source: \/app\/canvas-child\.tsx:28:11/i,
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

  it('restores the scheduled child snapshot when its live parent update throws', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    let parentRenders = 0;
    function ThrowingParent(): void {
      parentRenders += 1;
      if (parentRenders === 2) {
        throw new Error('parent update failed');
      }
    }
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, <ThrowingParent />);
    executeRender(parentCanvas, 1);
    const backend = createRecordingBackend('test');
    const canvas = new OffscreenCanvas(10, 10);
    const child = mountBackendCRC(canvas, undefined, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: backend.driver,
    });
    const before = snapshotRenderGlobals();

    child.requestFrame(true);
    expect(callbacks).toHaveLength(1);
    expect(() => callbacks[0]!(2)).toThrowError('parent update failed');

    expect(haveSameRenderGlobals(before, snapshotRenderGlobals())).toBe(true);
    child.dispose();
    parent.dispose();
  });

  it('rejects a duplicate live private mount without replacing its owner', () => {
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(10, 10);
    const firstBackend = createRecordingBackend('first');
    const first = mountBackendCRC(canvas, undefined, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: firstBackend.driver,
    });
    const firstInstance = getCRCInstance(canvas);
    const secondBackend = createRecordingBackend('second');

    expect(() => mountBackendCRC(canvas, undefined, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: secondBackend.driver,
    })).toThrowError('CRC is already mounted on this element.');

    expect(getCRCInstance(canvas)).toBe(firstInstance);
    first.render(undefined, 1);
    expect(firstBackend.calls).toContain('begin:10x10@10x10:1');
    expect(secondBackend.calls).toEqual([]);
    first.dispose();
    parent.dispose();
  });

  it('prevents a stale private handle from controlling a replacement mount', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(10, 10);
    const firstBackend = createRecordingBackend('first');
    const first = mountBackendCRC(canvas, undefined, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: firstBackend.driver,
    });
    first.dispose();
    const secondBackend = createRecordingBackend('second');
    const second = mountBackendCRC(canvas, undefined, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver: secondBackend.driver,
    });
    const secondInstance = getCRCInstance(canvas);

    expect(() => first.render(undefined, 2)).toThrowError(
      'CRC backend mount is no longer active.',
    );
    expect(() => first.requestFrame(false)).toThrowError(
      'CRC backend mount is no longer active.',
    );
    expect(() => first.resize(10, 10)).toThrowError(
      'CRC backend mount is no longer active.',
    );
    first.dispose();

    expect(getCRCInstance(canvas)).toBe(secondInstance);
    expect(callbacks).toEqual([]);
    second.render(undefined, 3);
    expect(secondBackend.calls).toContain('begin:10x10@10x10:3');
    expect(secondBackend.calls).not.toContain('begin:10x10@10x10:2');
    expect(secondBackend.calls.filter(call => call === 'dispose')).toEqual([]);
    second.dispose();
    parent.dispose();
  });

  it('finishes all owned cleanup when backend disposal throws', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const reportError = vi.spyOn(globalThis, 'reportError')
      .mockImplementation(() => undefined);
    const disposeError = new Error('backend dispose failed');
    const backend = createRecordingBackend('test');
    const driver: CRCBackendDriver<TestEnvironment> = {
      ...backend.driver,
      dispose() {
        backend.calls.push('dispose');
        throw disposeError;
      },
    };
    const cleanup = vi.fn();
    function OwnedScene(): void {
      useWhenChanged(() => cleanup, []);
      useBackendEventTarget({ onClick() {} });
    }
    const parentCanvas = createCanvas();
    const parent = mountCRC(parentCanvas, undefined);
    const canvas = new OffscreenCanvas(10, 10);
    const child = mountBackendCRC(canvas, <OwnedScene />, {
      parent: parentCanvas,
      logicalWidth: 10,
      logicalHeight: 10,
      driver,
    });
    child.render(<OwnedScene />, 1);
    child.requestFrame(false);
    const instance = getCRCInstance(canvas);
    const pool = instance.filterSurfacePool;
    const pair = pool.checkoutPair(createTestFilterWindows());
    pair.release();
    expect(instance.eventRoot.targets.size).toBe(1);
    expect(instance.refs.size).toBe(1);
    expect(pool.snapshot().surfaceSlots).toBe(2);

    expect(() => child.dispose()).not.toThrow();

    expect(reportError).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledWith(disposeError);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(1);
    expect(GLOBAL_STATE.crcInstances.has(canvas)).toBe(false);
    expect(instance.eventRoot.targets.size).toBe(0);
    expect(instance.refs.size).toBe(0);
    expect(instance.regions.size).toBe(0);
    expect(instance.paintEntries.size).toBe(0);
    expect(pool.snapshot()).toMatchObject({
      surfaceSlots: 0,
      releasedSurfaceSlots: 2,
      activePairs: 0,
    });
    expect(() => pool.checkoutPair(createTestFilterWindows())).toThrowError(
      'Cannot check out filter surfaces from a disposed pool.',
    );
    child.dispose();
    expect(backend.calls.filter(call => call === 'dispose')).toHaveLength(1);
    expect(reportError).toHaveBeenCalledOnce();
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

function parentCanvasEntries(canvas: HTMLCanvasElement) {
  return getCRCInstance(canvas).paintEntries;
}

function createTestFilterWindows(): FilterWindows {
  const window = {
    logicalBounds: { x: 0, y: 0, width: 10, height: 10 },
    backingX: 0,
    backingY: 0,
    backingWidth: 10,
    backingHeight: 10,
    renderTransform: new DOMMatrix(),
    inverseRenderTransform: new DOMMatrix(),
  };
  return {
    source: window,
    output: window,
    density: 1,
    sourceToOutputX: 0,
    sourceToOutputY: 0,
  };
}
