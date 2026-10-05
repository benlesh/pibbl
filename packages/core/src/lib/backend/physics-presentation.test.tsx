import { opacity } from '@pibbl/core/filters';
import {
  Group,
  Rectangle,
  pibbl,
  definePrimitive,
  type PibblController,
  type PibblElementType,
  type PrimitiveInputOf,
  type SystemStyle,
} from '@pibbl/core';
import {
  pibblInternalCreatePropAttachment,
  type PibblInternalMountedPropAttachment,
  type PibblInternalPrimitiveAttachmentInput,
} from '@pibbl/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSharedState, getPibblInstance } from '../global-state.js';
import { getCurrentWorldTransform } from '../render-target.js';
import { executeRender } from '../execute-render.js';
import { mountPibbl } from '../mount-pibbl.js';
import { focusManaged } from '../focus/policy-test-support.js';
import { resolveTargetRootBounds } from '../focus/geometry.js';

type PhysicsGroupProps = Omit<PrimitiveInputOf<typeof Group>, 'physics'> & {
  readonly physics?: object;
};
type PhysicsRectangleProps = Omit<PrimitiveInputOf<typeof Rectangle>, 'physics'> & {
  readonly physics?: object;
};

const PhysicsGroup = Group as unknown as PibblElementType<PhysicsGroupProps>;
const PhysicsRectangle = Rectangle as unknown as PibblElementType<PhysicsRectangleProps>;

const controllers = new Set<PibblController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('primitive attachment presentation', () => {
  it('prepares resolved geometry and applies attachment presentation before Group presentation', async () => {
    const prepared: PibblInternalPrimitiveAttachmentInput[] = [];
    const descendantWorld: DOMMatrix[] = [];
    const Probe = definePrimitive<{}, SystemStyle>(() => {
      descendantWorld.push(getCurrentWorldTransform());
    });
    const attachment = presentationAttachment(
      prepared,
      new DOMMatrix().translate(20, 10),
    );
    const canvas = createCanvas(80, 50);
    const controller = pibbl(canvas, (
      <PhysicsGroup
        physics={attachment}
        style={{ scaleX: 2, scaleY: 2, filter: [] }}
      >
        <Rectangle style={{ left: 1, top: 1, width: 5, height: 5, fill: '#ef4444' }} />
        <Probe />
      </PhysicsGroup>
    ));
    controllers.add(controller);
    await nextFrame();

    expect(prepared).toHaveLength(1);
    expect(prepared[0].componentType).toBe(Group);
    expect(prepared[0].componentName).toBe('Group');
    expect(prepared[0].props.physics).toBe(attachment);
    expect(prepared[0].style).toMatchObject({ scaleX: 2, scaleY: 2 });
    expect(prepared[0].source?.fileName).toContain('physics-presentation.test.tsx');
    expect(matrixValues(prepared[0].parentWorldTransform)).toEqual([
      1, 0, 0, 1, 0, 0,
    ]);
    expect(matrixValues(descendantWorld[0])).toEqual([
      2, 0, 0, 2, 20, 10,
    ]);
    expect(pixelAt(canvas, 23, 13)).toEqual([239, 68, 68, 255]);
    expect(pixelAt(canvas, 43, 13)).toEqual([0, 0, 0, 0]);
  });

  it('moves filtered paint and coordinate targeting through the same attachment transform', async () => {
    const clicks: string[] = [];
    const attachment = presentationAttachment(
      [],
      new DOMMatrix().translate(24, 8),
    );
    const canvas = createCanvas(70, 40);
    const controller = pibbl(canvas, focusManaged(
      <PhysicsRectangle
        physics={attachment}
        style={{
          width: 12,
          height: 12,
          fill: '#2563eb',
          filter: opacity({ amount: 1 }),
        }}
        onClick={() => clicks.push('hit')}
      />,
    ));
    controllers.add(controller);
    await nextFrame();

    expect(pixelAt(canvas, 28, 12)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 4, 4)).toEqual([0, 0, 0, 0]);
    const [target] = Array.from(getPibblInstance(canvas).eventRoot.targets);
    expect(resolveTargetRootBounds(target)).toEqual({
      x: 24,
      y: 8,
      width: 12,
      height: 12,
    });
    dispatchClick(canvas, 28, 12);
    dispatchClick(canvas, 4, 4);
    expect(clicks).toEqual(['hit']);
  });

  it('reports an unregistered primitive physics value with component, property, and JSX source', () => {
    const InvalidPhysicsHost = definePrimitive<{
      readonly physics?: unknown;
    }>(function renderInvalidPhysicsHost() {});
    const canvas = createCanvas(40, 30);
    const controller = mountPibbl(
      canvas,
      <InvalidPhysicsHost physics={{ kind: 'lookalike' }} />,
    );
    controllers.add(controller);

    expect(() => executeRender(canvas, 1)).toThrowError(
      /InvalidPhysicsHost.*physics.*physics-presentation\.test\.tsx:\d+:\d+/i,
    );
  });
});

function presentationAttachment(
  prepared: PibblInternalPrimitiveAttachmentInput[],
  presentationTransform2D: DOMMatrix,
): object {
  const publicValue = Object.freeze({ kind: 'test-physics-2d' });
  return pibblInternalCreatePropAttachment('physics', publicValue, () => {
    const mounted: PibblInternalMountedPropAttachment = {
      update: () => undefined,
      enter: () => undefined,
      preparePrimitive(input) {
        prepared.push(input);
        return { presentationTransform2D };
      },
      exit: () => undefined,
      dispose: () => undefined,
    };
    return mounted;
  });
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  document.body.appendChild(canvas);
  return canvas;
}

function dispatchClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  const bounds = canvas.getBoundingClientRect();
  for (const type of ['mousedown', 'mouseup', 'click']) {
    canvas.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      button: 0,
      buttons: type === 'mousedown' ? 1 : 0,
      cancelable: true,
      clientX: bounds.left + x,
      clientY: bounds.top + y,
    }));
  }
}

function pixelAt(canvas: HTMLCanvasElement, x: number, y: number): number[] {
  return Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data);
}

function matrixValues(matrix: DOMMatrixReadOnly): readonly number[] {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
