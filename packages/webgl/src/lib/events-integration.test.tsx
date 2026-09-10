import { userEvent } from 'vitest/browser';
import {
  FocusManagement,
  Group,
  KeyboardNavigation,
  Rectangle,
  crc,
  type CRCController,
  type CRCEventTarget,
  type CRCNode,
} from '@crc/core';
import {
  Cube,
  Group3D,
  Sphere,
  WebGLLayer,
} from '@crc/webgl';
import { afterEach, describe, expect, it, vi } from 'vitest';

const controllers = new Set<CRCController>();

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
    let activationSource: Event | undefined;

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
      if (event.type === 'click' && event.sourceEvent) {
        activationSource = event.sourceEvent;
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
                  style={{ cursor: 'crosshair' }}
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
    expect(activationSource).toBeInstanceOf(KeyboardEvent);

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
});

describe('WebGL focus geometry', () => {
  it('commits projected geometry bounds and honors a local-layer override', async () => {
    const canvas = createCanvas(240, 140);
    controllers.add(crc(canvas, (
      <FocusManagement>
        <Group style={{ translateX: 20, translateY: 30 }}>
          <WebGLLayer style={{ width: 200, height: 100 }}>
            <Cube onClick={() => undefined} />
            <Sphere
              keyboardNavigationBounds={{ x: 150, y: 10, width: 20, height: 15 }}
              style={{ translateX: -2 }}
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

  it('keeps source-order Tab and uses projected bounds for directional movement', async () => {
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
              onClick={() => undefined}
              onFocus={() => focusTrace.push('center')}
            />
            <Sphere
              key="left"
              style={{ translateX: -2 }}
              onClick={() => undefined}
              onFocus={() => focusTrace.push('left')}
            />
            <Cube
              key="right"
              style={{ translateX: 2 }}
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
