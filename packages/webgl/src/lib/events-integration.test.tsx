import { userEvent } from 'vitest/browser';
import {
  FocusManagement,
  Group,
  KeyboardNavigation,
  Layer,
  Rectangle,
  crc,
  useSignal,
  type CRCController,
  type CRCEventTarget,
  type CRCNode,
} from '@crc/core';
import {
  Cube,
  Group3D,
  Sphere,
  WebGLLayer,
  type CubeStyle,
} from '@crc/webgl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGroupTransform } from '../../../core/src/lib/primitive-presentation.js';
import { resolveCamera } from './math/camera.js';
import {
  composeModelMatrix4,
  multiplyMatrix4,
} from './math/matrix4.js';

const controllers = new Set<CRCController>();
const interactionStyles = [
  ['default-lit', { cursor: 'crosshair' }],
  ['explicit-unlit', { cursor: 'crosshair', lit: false }],
  [
    'emissive',
    {
      cursor: 'crosshair',
      material: {
        type: 'lambert',
        emissiveColor: '#ffffff',
        emissiveIntensity: 0.5,
      },
    },
  ],
] as const satisfies ReadonlyArray<readonly [string, CubeStyle]>;

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('WebGL event integration', () => {
  it('propagates through Canvas, WebGLLayer, and Group3D without structural hit boxes', async () => {
    const trace: string[] = [];
    const canvas = createCanvas(100, 100);
    controllers.add(crc(canvas, (
      <Group onClickCapture={() => trace.push('root-capture')}>
        <Rectangle
          style={{ width: 100, height: 100, fill: '#0f172a' }}
          onClick={() => trace.push('rear')}
        />
        <WebGLLayer
          style={{ width: 100, height: 100 }}
          onClickCapture={() => trace.push('layer-capture')}
          onClick={() => trace.push('layer-bubble')}
        >
          <Group3D
            onClickCapture={() => trace.push('group-capture')}
            onClick={() => trace.push('group-bubble')}
          >
            <Cube
              style={{ lit: false }}
              onClickCapture={() => trace.push('target-capture')}
              onClick={() => trace.push('target')}
            />
          </Group3D>
        </WebGLLayer>
      </Group>
    ), { pixelRatio: 1 }));
    await nextFrame();

    dispatchClick(canvas, 50, 50);
    expect(trace).toEqual([
      'root-capture',
      'layer-capture',
      'group-capture',
      'target-capture',
      'target',
      'group-bubble',
      'layer-bubble',
    ]);

    trace.length = 0;
    dispatchClick(canvas, 5, 5);
    expect(trace).toEqual(['root-capture', 'rear']);
  });

  it('uses the live snapshotted route when a cube is removed during capture', () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const trace: string[] = [];
    const canvas = createCanvas(100, 100);
    let controller: CRCController;
    const scene = (showCube: boolean): CRCNode => (
      <Group onClickCapture={() => trace.push('root-capture')}>
        <WebGLLayer
          style={{ width: 100, height: 100 }}
          onClickCapture={() => {
            trace.push('layer-capture');
            if (showCube) {
              crc(canvas, scene(false));
              callbacks.shift()!(2);
            }
          }}
          onClick={() => trace.push('layer-bubble')}
        >
          <Group3D
            onClickCapture={() => trace.push('group-capture')}
            onClick={() => trace.push('group-bubble')}
          >
            {showCube ? (
              <Cube
                style={{ lit: false }}
                onClickCapture={() => trace.push('removed-target-capture')}
                onClick={() => trace.push('removed-target')}
              />
            ) : undefined}
          </Group3D>
        </WebGLLayer>
      </Group>
    );
    controller = crc(canvas, scene(true), { pixelRatio: 1 });
    controllers.add(controller);
    callbacks.shift()!(1);

    dispatchClick(canvas, 50, 50);

    expect(trace).toEqual([
      'root-capture',
      'layer-capture',
      'group-capture',
      'group-bubble',
      'layer-bubble',
    ]);
  });

  it('routes every supported input family through one stable WebGL target', async () => {
    const canvas = createCanvas(140, 120);
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.appendChild(after);
    const nativeCapture = installNativePointerCapture(canvas);
    const types: string[] = [];
    const coordinates: Array<readonly [string, number, number]> = [];
    const targets = new Set<CRCEventTarget>();
    let cubeTarget: CRCEventTarget | undefined;
    let rearTarget: CRCEventTarget | undefined;
    let pointerRelated: CRCEventTarget | null | undefined;
    let mouseRelated: CRCEventTarget | null | undefined;
    const keyboardActivations: string[] = [];

    const record = (event: {
      readonly type: string;
      readonly target: CRCEventTarget;
      readonly x?: number;
      readonly y?: number;
      readonly sourceEvent?: Event;
    }) => {
      types.push(event.type);
      targets.add(event.target);
      if (event.x !== undefined && event.y !== undefined) {
        coordinates.push([event.type, event.x, event.y]);
      }
      if (
        event.type === 'click' &&
        event.sourceEvent instanceof KeyboardEvent
      ) {
        keyboardActivations.push(event.sourceEvent.key);
      }
    };
    const scene = (showCube: boolean): CRCNode => (
      <FocusManagement>
        <Group>
          <Rectangle
            style={{ width: 140, height: 120, fill: '#0f172a' }}
            onPointerOver={event => rearTarget = event.target}
            onMouseOver={event => rearTarget = event.target}
          />
          <Group style={{ translateX: 20, translateY: 10 }}>
            <WebGLLayer style={{ width: 100, height: 100 }}>
              {showCube ? (
                <Cube
                  style={{ cursor: 'crosshair', lit: false }}
                  onPointerOver={record}
                  onPointerEnter={record}
                  onPointerMove={record}
                  onPointerDown={event => {
                    record(event);
                    cubeTarget = event.target;
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onGotPointerCapture={record}
                  onPointerUp={record}
                  onLostPointerCapture={record}
                  onPointerOut={event => {
                    record(event);
                    pointerRelated = event.relatedTarget;
                  }}
                  onPointerLeave={record}
                  onMouseOver={record}
                  onMouseEnter={record}
                  onMouseDown={record}
                  onMouseUp={record}
                  onMouseOut={event => {
                    record(event);
                    mouseRelated = event.relatedTarget;
                  }}
                  onMouseLeave={record}
                  onClick={record}
                  onContextMenu={record}
                  onTouchStart={record}
                  onTouchMove={record}
                  onTouchEnd={record}
                  onWheel={record}
                  onKeyDown={record}
                  onKeyUp={record}
                  onFocusIn={record}
                  onFocus={record}
                  onFocusOut={record}
                  onBlur={record}
                  onBeforeInput={record}
                  onInput={record}
                  onChange={record}
                  onCompositionStart={record}
                  onCompositionUpdate={record}
                  onCompositionEnd={record}
                  onSelect={record}
                  onSelectionChange={record}
                  onCopy={record}
                  onCut={record}
                  onPaste={record}
                  onDragStart={record}
                  onDrag={record}
                  onDragEnd={record}
                  onDragEnter={record}
                  onDragLeave={record}
                  onDragOver={record}
                  onDrop={record}
                />
              ) : undefined}
            </WebGLLayer>
          </Group>
        </Group>
      </FocusManagement>
    );
    controllers.add(crc(canvas, scene(true), { pixelRatio: 1 }));
    await nextFrame();

    dispatchPointer(canvas, 'pointermove', 70, 60, 7);
    dispatchMouse(canvas, 'mousemove', 70, 60);
    expect(canvas.style.cursor).toBe('crosshair');
    dispatchPointer(canvas, 'pointerdown', 70, 60, 7);
    dispatchPointer(canvas, 'gotpointercapture', 70, 60, 7);
    dispatchPointer(canvas, 'pointerup', 130, 110, 7);
    expect(cubeTarget?.hasPointerCapture(7)).toBe(true);
    cubeTarget?.releasePointerCapture(7);
    dispatchPointer(canvas, 'lostpointercapture', 130, 110, 7);

    dispatchPointer(canvas, 'pointermove', 70, 60, 8);
    dispatchPointer(canvas, 'pointermove', 5, 5, 8);
    dispatchMouse(canvas, 'mousemove', 70, 60);
    dispatchMouse(canvas, 'mousemove', 5, 5);
    dispatchMouse(canvas, 'mousedown', 70, 60);
    dispatchMouse(canvas, 'mouseup', 70, 60);
    dispatchMouse(canvas, 'click', 70, 60);
    dispatchMouse(canvas, 'contextmenu', 70, 60);

    const touch = createTouch(canvas, 11, 70, 60);
    dispatchTouch(canvas, 'touchstart', [touch], [touch]);
    dispatchTouch(canvas, 'touchmove', [touch], [touch]);
    dispatchTouch(canvas, 'touchend', [], [touch]);
    dispatchWheel(canvas, 70, 60);

    canvas.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    }));
    canvas.dispatchEvent(new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
    }));
    canvas.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: ' ',
    }));
    canvas.dispatchEvent(new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: ' ',
    }));
    canvas.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: 'x',
      inputType: 'insertText',
    }));
    canvas.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: 'x',
      inputType: 'insertText',
    }));
    canvas.dispatchEvent(new Event('change', { bubbles: true }));
    canvas.dispatchEvent(new CompositionEvent('compositionstart', {
      bubbles: true,
      data: 'x',
    }));
    canvas.dispatchEvent(new CompositionEvent('compositionupdate', {
      bubbles: true,
      data: 'xy',
    }));
    canvas.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: 'xyz',
    }));
    canvas.dispatchEvent(new Event('select', { bubbles: true }));
    canvas.dispatchEvent(new Event('selectionchange', { bubbles: true }));
    canvas.dispatchEvent(new ClipboardEvent('copy', { bubbles: true }));
    canvas.dispatchEvent(new ClipboardEvent('cut', { bubbles: true }));
    canvas.dispatchEvent(new ClipboardEvent('paste', { bubbles: true }));

    for (const type of ['dragstart', 'drag', 'dragenter', 'dragover'] as const) {
      dispatchDrag(canvas, type, 70, 60);
    }
    dispatchDrag(canvas, 'dragover', 5, 5);
    dispatchDrag(canvas, 'dragenter', 70, 60);
    dispatchDrag(canvas, 'drop', 70, 60);
    dispatchDrag(canvas, 'dragend', 70, 60);

    expect(pointerRelated).toBe(rearTarget);
    expect(mouseRelated).toBe(rearTarget);
    expect(targets).toEqual(new Set([cubeTarget]));
    expect(coordinates).toContainEqual(['pointerdown', 70, 60]);
    expect(coordinates).toContainEqual(['pointerup', 130, 110]);
    expect(coordinates).toContainEqual(['touchstart', 70, 60]);
    expect(coordinates).toContainEqual(['wheel', 70, 60]);
    expect(coordinates).toContainEqual(['drop', 70, 60]);
    expect(types).toEqual(expect.arrayContaining([
      'pointerover', 'pointerenter', 'pointermove', 'pointerdown',
      'gotpointercapture', 'pointerup', 'lostpointercapture', 'pointerout',
      'pointerleave', 'mouseover', 'mouseenter', 'mousedown', 'mouseup',
      'click', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'wheel',
      'focusin', 'focus', 'keydown', 'keyup', 'beforeinput', 'input',
      'change', 'compositionstart', 'compositionupdate', 'compositionend',
      'select', 'selectionchange', 'copy', 'cut', 'paste', 'dragstart',
      'drag', 'dragenter', 'dragover', 'drop', 'dragleave', 'dragend',
    ]));
    expect(keyboardActivations).toEqual(['Enter', ' ']);

    after.focus();
    expect(types).toEqual(expect.arrayContaining(['focusout', 'blur']));

    dispatchPointer(canvas, 'pointerdown', 70, 60, 9);
    expect(nativeCapture.active).toContain(9);
    crc(canvas, scene(false));
    await nextFrame();
    expect(nativeCapture.active).not.toContain(9);
    expect(cubeTarget?.hasPointerCapture(9)).toBe(false);
    expect(canvas.style.cursor).toBe('');
  });

  it.each(interactionStyles)(
    'keeps target, cursor, capture, focus, and keyboard activation for %s geometry',
    async (_label, interactionStyle) => {
      const canvas = createCanvas(100, 100);
      const nativeCapture = installNativePointerCapture(canvas);
      let target: CRCEventTarget | undefined;
      const focus = vi.fn();
      const keyboardActivations: string[] = [];
      controllers.add(crc(canvas, (
        <FocusManagement>
          <WebGLLayer style={{ width: 100, height: 100 }}>
            <Cube
              style={interactionStyle}
              onPointerDown={event => {
                target = event.target;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onFocus={focus}
              onClick={event => {
                if (event.sourceEvent instanceof KeyboardEvent) {
                  keyboardActivations.push(event.sourceEvent.key);
                }
              }}
            />
          </WebGLLayer>
        </FocusManagement>
      ), { pixelRatio: 1 }));
      await nextFrame();

      dispatchPointer(canvas, 'pointermove', 50, 50, 21);
      dispatchMouse(canvas, 'mousemove', 50, 50);
      expect(canvas.style.cursor).toBe('crosshair');
      dispatchPointer(canvas, 'pointerdown', 50, 50, 21);
      dispatchPointer(canvas, 'gotpointercapture', 50, 50, 21);
      expect(target).toBeDefined();
      expect(target?.hasPointerCapture(21)).toBe(true);
      expect(nativeCapture.active).toContain(21);
      expect(focus).toHaveBeenCalledOnce();

      for (const key of ['Enter', ' '] as const) {
        canvas.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key,
        }));
        canvas.dispatchEvent(new KeyboardEvent('keyup', {
          bubbles: true,
          cancelable: true,
          key,
        }));
      }
      expect(keyboardActivations).toEqual(['Enter', ' ']);
    },
  );

  it('follows native pointer capture transitions for a WebGL target', async () => {
    const trace: string[] = [];
    let trustedPointerDown = false;
    const canvas = createCanvas(100, 100);
    canvas.addEventListener('pointerdown', event => {
      trustedPointerDown = event.isTrusted;
    }, { once: true });
    controllers.add(crc(canvas, (
      <WebGLLayer style={{ width: 100, height: 100 }}>
        <Cube
          style={{ lit: false }}
          onPointerDown={event => {
            trace.push(`down:${event.pointerId}`);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onGotPointerCapture={event => trace.push(`got:${event.pointerId}`)}
          onPointerUp={event => trace.push(`up:${event.pointerId}`)}
          onLostPointerCapture={event => trace.push(`lost:${event.pointerId}`)}
        />
      </WebGLLayer>
    ), { pixelRatio: 1 }));
    await nextFrame();

    await userEvent.click(canvas, { position: { x: 50, y: 50 } });

    expect(trustedPointerDown).toBe(true);
    expect(trace).toHaveLength(4);
    const pointerId = trace[0]!.split(':')[1];
    expect(trace).toEqual([
      `down:${pointerId}`,
      `got:${pointerId}`,
      `up:${pointerId}`,
      `lost:${pointerId}`,
    ]);
  });
});

describe('WebGL focus geometry', () => {
  it('keeps wholly clipped targets in Tab order without directional bounds', async () => {
    const focusTrace: string[] = [];
    const before = document.createElement('button');
    const canvas = createCanvas(100, 100, false);
    const after = document.createElement('button');
    document.body.append(before, canvas, after);
    controllers.add(crc(canvas, (
      <FocusManagement>
        <KeyboardNavigation mode="directional">
          <WebGLLayer style={{ width: 100, height: 100 }}>
            <Cube
              style={{ translateZ: 10, lit: false }}
              onClick={() => undefined}
              onFocus={() => focusTrace.push('clipped')}
            />
          </WebGLLayer>
        </KeyboardNavigation>
      </FocusManagement>
    ), { pixelRatio: 1 }));
    await nextFrame();

    const manager = await focusManager(canvas);
    expect(manager.candidates).toHaveLength(1);
    expect(manager.candidates[0]!.rootBounds).toBeUndefined();
    before.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(canvas);
    expect(focusTrace).toEqual(['clipped']);
  });

  it('keeps clipped projected points through nested Layer and Canvas transforms', async () => {
    const canvas = createCanvas(500, 400);
    const outerStyle = {
      translateX: 80,
      translateY: 40,
      rotationDegrees: 35,
      skewX: 18,
    } as const;
    const innerStyle = {
      translateX: 15,
      translateY: 10,
      rotationDegrees: -12,
    } as const;
    const modelStyle = {
      rotationXDegrees: 20,
      rotationYDegrees: 35,
      rotationZDegrees: 10,
      lit: false,
    } as const;
    controllers.add(crc(canvas, (
      <FocusManagement>
        <Group style={outerStyle}>
          <Layer style={{ width: 260, height: 180 }}>
            <Group style={innerStyle}>
              <WebGLLayer style={{ width: 200, height: 100 }}>
                <Cube style={modelStyle} onClick={() => undefined} />
              </WebGLLayer>
            </Group>
          </Layer>
        </Group>
      </FocusManagement>
    ), { pixelRatio: 1 }));
    await nextFrame();

    const manager = await focusManager(canvas);
    const model = new Float32Array(16);
    composeModelMatrix4(model, modelStyle);
    const camera = resolveCamera(undefined, 200, 100);
    const projectionModel = new Float32Array(16);
    multiplyMatrix4(projectionModel, camera.projectionViewMatrix, model);
    const bridge = createGroupTransform(outerStyle).multiply(
      createGroupTransform(innerStyle),
    );
    const expected = boundsOf(projectUnitCube(
      projectionModel,
      200,
      100,
    ).map(point => bridge.transformPoint(new DOMPoint(point.x, point.y))));

    expect(manager.candidates).toHaveLength(1);
    expect(manager.candidates[0]!.rootBounds).toEqual({
      x: expect.closeTo(expected.x, 4),
      y: expect.closeTo(expected.y, 4),
      width: expect.closeTo(expected.width, 4),
      height: expect.closeTo(expected.height, 4),
    });
  });

  it('replays focus through a cached outer Layer when the WebGL resolver is omitted', async () => {
    const focusTrace: string[] = [];
    const rearClick = vi.fn();
    const cubeClick = vi.fn();
    const sphereClick = vi.fn();
    const layerClick = vi.fn();
    let updateRoot!: () => void;
    const island = (
      <Group style={{ translateX: 5, translateY: 7, rotationDegrees: -8 }}>
        <WebGLLayer
          pointerEvents="none"
          style={{ width: 100, height: 80 }}
          onClick={layerClick}
        >
          <Cube
            style={{ lit: false }}
            onClick={cubeClick}
            onFocus={() => focusTrace.push('cube')}
          />
          <Sphere
            keyboardNavigationBounds={{ x: 70, y: 8, width: 12, height: 10 }}
            style={{ lit: false }}
            onClick={sphereClick}
            onFocus={() => focusTrace.push('sphere')}
          />
        </WebGLLayer>
      </Group>
    );
    const retainedLayer = (
      <Group style={{
        translateX: 30,
        translateY: 20,
        rotationDegrees: 12,
        skewX: 6,
      }}>
        <Layer key="cached" style={{ width: 160, height: 120 }}>
          {island}
        </Layer>
      </Group>
    );
    const Root = (): CRCNode => {
      const version = useSignal(0);
      updateRoot = () => version.update(value => value + 1);
      return [
        <Rectangle
          key="rear"
          keyboardFocusable={false}
          style={{ width: 240, height: 160, fill: '#0f172a' }}
          onClick={rearClick}
        />,
        retainedLayer,
        <Rectangle
          key="update"
          pointerEvents="none"
          style={{ width: version.get() + 1, height: 1 }}
        />,
      ];
    };
    const before = document.createElement('button');
    const canvas = createCanvas(240, 160, false);
    const after = document.createElement('button');
    document.body.append(before, canvas, after);
    controllers.add(crc(canvas, <FocusManagement><Root /></FocusManagement>, {
      pixelRatio: 1,
    }));
    await nextFrame();
    const bridge = createGroupTransform({
      translateX: 30,
      translateY: 20,
      rotationDegrees: 12,
      skewX: 6,
    }).multiply(createGroupTransform({
      translateX: 5,
      translateY: 7,
      rotationDegrees: -8,
    }));
    const camera = resolveCamera(undefined, 100, 80);
    const automatic = boundsOf(projectUnitCube(
      camera.projectionViewMatrix,
      100,
      80,
    ).map(point => bridge.transformPoint(new DOMPoint(point.x, point.y))));
    const explicit = boundsOf([
      [70, 8], [82, 8], [70, 18], [82, 18],
    ].map(([x, y]) => bridge.transformPoint(new DOMPoint(x, y))));
    const expected = [automatic, explicit];
    expectFocusBounds(await focusManager(canvas), expected);
    const center = bridge.transformPoint(new DOMPoint(50, 40));
    dispatchClick(canvas, center.x, center.y);
    expect(rearClick).toHaveBeenCalledOnce();
    expect(cubeClick).not.toHaveBeenCalled();
    expect(sphereClick).not.toHaveBeenCalled();
    expect(layerClick).not.toHaveBeenCalled();

    updateRoot();
    await nextFrame();

    expectFocusBounds(await focusManager(canvas), expected);
    dispatchClick(canvas, center.x, center.y);
    expect(rearClick).toHaveBeenCalledTimes(2);
    expect(cubeClick).not.toHaveBeenCalled();
    expect(sphereClick).not.toHaveBeenCalled();
    expect(layerClick).not.toHaveBeenCalled();
    before.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(canvas);
    expect(focusTrace).toEqual(['cube']);
  });

  it('updates focus transforms and hit participation across pointerEvents toggles', async () => {
    const rearClick = vi.fn();
    const cubeClick = vi.fn();
    const canvas = createCanvas(220, 120);
    const scene = (
      pointerEvents: 'auto' | 'none',
      translateX: number,
      show = true,
    ): CRCNode => [
      <Rectangle
        key="rear"
        keyboardFocusable={false}
        style={{ width: 220, height: 120, fill: '#0f172a' }}
        onClick={rearClick}
      />,
      show ? (
        <Group key="group" style={{ translateX, translateY: 10 }}>
          <WebGLLayer
            key="island"
            pointerEvents={pointerEvents}
            style={{ width: 100, height: 80 }}
          >
            <Cube key="cube" style={{ lit: false }} onClick={cubeClick} />
          </WebGLLayer>
        </Group>
      ) : undefined,
    ];
    controllers.add(crc(canvas, (
      <FocusManagement><Group>{scene('none', 10)}</Group></FocusManagement>
    ), { pixelRatio: 1 }));
    await nextFrame();

    await expectTranslatedCubeBounds(canvas, 10, 10);
    dispatchClick(canvas, 60, 50);
    expect(rearClick).toHaveBeenCalledOnce();
    expect(cubeClick).not.toHaveBeenCalled();

    crc(canvas, (
      <FocusManagement><Group>{scene('auto', 40)}</Group></FocusManagement>
    ));
    await nextFrame();
    await expectTranslatedCubeBounds(canvas, 40, 10);
    dispatchClick(canvas, 90, 50);
    expect(cubeClick).toHaveBeenCalledOnce();

    crc(canvas, (
      <FocusManagement><Group>{scene('none', 70)}</Group></FocusManagement>
    ));
    await nextFrame();
    await expectTranslatedCubeBounds(canvas, 70, 10);
    dispatchClick(canvas, 120, 50);
    expect(rearClick).toHaveBeenCalledTimes(2);
    expect(cubeClick).toHaveBeenCalledOnce();

    crc(canvas, (
      <FocusManagement>
        <Group>{scene('none', 100, false)}</Group>
      </FocusManagement>
    ));
    await nextFrame();
    expect((await focusManager(canvas)).candidates).toHaveLength(0);

    crc(canvas, (
      <FocusManagement><Group>{scene('none', 100)}</Group></FocusManagement>
    ));
    await nextFrame();
    await expectTranslatedCubeBounds(canvas, 100, 10);
    dispatchClick(canvas, 150, 50);
    expect(rearClick).toHaveBeenCalledTimes(3);
    expect(cubeClick).toHaveBeenCalledOnce();
  });

  it('commits projected geometry bounds and honors a local-layer override', async () => {
    const canvas = createCanvas(240, 140);
    controllers.add(crc(canvas, (
      <FocusManagement>
        <Group style={{ translateX: 20, translateY: 30 }}>
          <WebGLLayer style={{ width: 200, height: 100 }}>
            <Cube style={{ lit: false }} onClick={() => undefined} />
            <Sphere
              keyboardNavigationBounds={{ x: 150, y: 10, width: 20, height: 15 }}
              style={{ translateX: -2, lit: false }}
              onClick={() => undefined}
            />
          </WebGLLayer>
        </Group>
      </FocusManagement>
    ), { pixelRatio: 1 }));
    await nextFrame();

    const { getCRCInstance } = await import(
      '../../../core/src/lib/global-state.js'
    );
    const manager = getCRCInstance(canvas).eventRoot.focusPolicy as unknown as {
      readonly candidates: ReadonlyArray<{
        readonly rootBounds: Readonly<{
          x: number;
          y: number;
          width: number;
          height: number;
        }> | undefined;
      }>;
    };
    const focalLength = 1 / Math.tan(25 * Math.PI / 180);
    const projectedHalfSize = 50 * focalLength * 0.5 / 4.5;

    expect(manager.candidates).toHaveLength(2);
    expect(manager.candidates[0]!.rootBounds).toEqual({
      x: expect.closeTo(120 - projectedHalfSize, 4),
      y: expect.closeTo(80 - projectedHalfSize, 4),
      width: expect.closeTo(projectedHalfSize * 2, 4),
      height: expect.closeTo(projectedHalfSize * 2, 4),
    });
    expect(manager.candidates[1]!.rootBounds).toEqual({
      x: 170,
      y: 40,
      width: 20,
      height: 15,
    });
  });

  it('keeps source-order Tab and projected directional bounds across lit, unlit, and emissive geometry', async () => {
    const focusTrace: string[] = [];
    const before = document.createElement('button');
    before.textContent = 'before';
    const canvas = createCanvas(240, 120, false);
    const after = document.createElement('button');
    after.textContent = 'after';
    document.body.append(before, canvas, after);
    controllers.add(crc(canvas, (
      <FocusManagement>
        <KeyboardNavigation mode="directional">
          <WebGLLayer style={{ width: 240, height: 120 }}>
            <Cube
              key="center"
              style={{ color: '#ef4444' }}
              onClick={() => undefined}
              onFocus={() => focusTrace.push('center')}
            />
            <Sphere
              key="left"
              style={{ translateX: -2, lit: false, color: '#22c55e' }}
              onClick={() => undefined}
              onFocus={() => focusTrace.push('left')}
            />
            <Cube
              key="right"
              style={{
                translateX: 2,
                color: '#3b82f6',
                material: {
                  type: 'lambert',
                  emissiveColor: '#ffffff',
                  emissiveIntensity: 0.5,
                },
              }}
              onClick={() => undefined}
              onFocus={() => focusTrace.push('right')}
            />
          </WebGLLayer>
        </KeyboardNavigation>
      </FocusManagement>
    ), { pixelRatio: 1 }));
    await nextFrame();

    before.focus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(focusTrace).toEqual(['center', 'left', 'right']);

    dispatchPointer(canvas, 'pointerdown', 120, 60, 17);
    canvas.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowRight',
    }));
    expect(focusTrace.slice(-2)).toEqual(['center', 'right']);
  });
});

function createCanvas(
  width: number,
  height: number,
  append = true,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`;
  if (append) document.body.appendChild(canvas);
  return canvas;
}

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  for (const type of ['mousedown', 'mouseup', 'click'] as const) {
    dispatchMouse(canvas, type, x, y);
  }
}

function dispatchMouse(
  canvas: HTMLCanvasElement,
  type: 'click' | 'contextmenu' | 'mousedown' | 'mousemove' | 'mouseup',
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: type === 'contextmenu' ? 2 : 0,
    buttons: type === 'mousedown' ? 1 : 0,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  }));
}

function dispatchPointer(
  canvas: HTMLCanvasElement,
  type:
    | 'gotpointercapture'
    | 'lostpointercapture'
    | 'pointerdown'
    | 'pointermove'
    | 'pointerup',
  x: number,
  y: number,
  pointerId: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: type !== 'gotpointercapture' && type !== 'lostpointercapture',
    pointerId,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerdown' ? 1 : 0,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
  }));
}

function installNativePointerCapture(canvas: HTMLCanvasElement) {
  const active = new Set<number>();
  vi.spyOn(canvas, 'setPointerCapture').mockImplementation(pointerId => {
    active.add(pointerId);
  });
  vi.spyOn(canvas, 'hasPointerCapture').mockImplementation(pointerId =>
    active.has(pointerId)
  );
  vi.spyOn(canvas, 'releasePointerCapture').mockImplementation(pointerId => {
    active.delete(pointerId);
  });
  return { active };
}

function createTouch(
  canvas: HTMLCanvasElement,
  identifier: number,
  x: number,
  y: number,
): Touch {
  const bounds = canvas.getBoundingClientRect();
  return new Touch({
    identifier,
    target: canvas,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    pageX: bounds.left + x,
    pageY: bounds.top + y,
    screenX: x,
    screenY: y,
  });
}

function dispatchTouch(
  canvas: HTMLCanvasElement,
  type: 'touchend' | 'touchmove' | 'touchstart',
  touches: Touch[],
  changedTouches: Touch[],
): void {
  canvas.dispatchEvent(new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches,
    changedTouches,
    targetTouches: touches,
  }));
}

function dispatchWheel(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    deltaX: 2,
    deltaY: 3,
  }));
}

function dispatchDrag(
  canvas: HTMLCanvasElement,
  type:
    | 'drag'
    | 'dragend'
    | 'dragenter'
    | 'dragleave'
    | 'dragover'
    | 'dragstart'
    | 'drop',
  x: number,
  y: number,
): void {
  const bounds = canvas.getBoundingClientRect();
  canvas.dispatchEvent(new DragEvent(type, {
    bubbles: true,
    cancelable: type !== 'dragend' && type !== 'dragleave',
    clientX: bounds.left + x,
    clientY: bounds.top + y,
    dataTransfer: new DataTransfer(),
  }));
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function focusManager(canvas: HTMLCanvasElement): Promise<{
  readonly candidates: ReadonlyArray<{
    readonly rootBounds: Readonly<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> | undefined;
  }>;
}> {
  const { getCRCInstance } = await import(
    '../../../core/src/lib/global-state.js'
  );
  return getCRCInstance(canvas).eventRoot.focusPolicy as unknown as {
    readonly candidates: ReadonlyArray<{
      readonly rootBounds: Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
      }> | undefined;
    }>;
  };
}

function projectUnitCube(
  matrix: Readonly<Float32Array>,
  width: number,
  height: number,
): Array<Readonly<{ x: number; y: number }>> {
  const points: Array<Readonly<{ x: number; y: number }>> = [];
  for (const x of [-0.5, 0.5]) {
    for (const y of [-0.5, 0.5]) {
      for (const z of [-0.5, 0.5]) {
        const w = matrix[3]! * x + matrix[7]! * y +
          matrix[11]! * z + matrix[15]!;
        const ndcX = (matrix[0]! * x + matrix[4]! * y +
          matrix[8]! * z + matrix[12]!) / w;
        const ndcY = (matrix[1]! * x + matrix[5]! * y +
          matrix[9]! * z + matrix[13]!) / w;
        points.push({
          x: (ndcX + 1) * width * 0.5,
          y: (1 - ndcY) * height * 0.5,
        });
      }
    }
  }
  return points;
}

function boundsOf(
  points: ReadonlyArray<Readonly<{ x: number; y: number }>>,
): Readonly<{ x: number; y: number; width: number; height: number }> {
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function expectFocusBounds(
  manager: Awaited<ReturnType<typeof focusManager>>,
  expected: ReadonlyArray<Readonly<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>>,
): void {
  expect(manager.candidates).toHaveLength(expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    const bounds = expected[index]!;
    expect(manager.candidates[index]!.rootBounds).toEqual({
      x: expect.closeTo(bounds.x, 4),
      y: expect.closeTo(bounds.y, 4),
      width: expect.closeTo(bounds.width, 4),
      height: expect.closeTo(bounds.height, 4),
    });
  }
}

async function expectTranslatedCubeBounds(
  canvas: HTMLCanvasElement,
  translateX: number,
  translateY: number,
): Promise<void> {
  const camera = resolveCamera(undefined, 100, 80);
  const expected = boundsOf(projectUnitCube(
    camera.projectionViewMatrix,
    100,
    80,
  ).map(point => ({
    x: point.x + translateX,
    y: point.y + translateY,
  })));
  expectFocusBounds(await focusManager(canvas), [expected]);
}
