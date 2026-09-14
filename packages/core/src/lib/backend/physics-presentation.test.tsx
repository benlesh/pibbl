import {
  Group,
  Rectangle,
  crc,
  definePrimitive,
  type CRCController,
  type CRCElementType,
  type CRCPhysics2DPropExtension,
  type GroupProps,
  type PrimitiveInputOf,
  type RectangleProps,
  type SystemStyle,
} from '@crc/core';
import {
  crcInternalCreatePropAttachment,
  type CRCInternalMountedPropAttachment,
  type CRCInternalPrimitiveAttachmentInput,
} from '@crc/core/internal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSharedState, getCRCInstance } from '../global-state.js';
import { getCurrentWorldTransform } from '../render-target.js';
import { executeRender } from '../execute-render.js';
import { mountCRC } from '../mount-crc.js';
import { focusManaged } from '../focus/policy-test-support.js';
import { resolveTargetRootBounds } from '../focus/geometry.js';

type PublicExtensionHasPhysics = 'physics' extends keyof CRCPhysics2DPropExtension
  ? true
  : false;
type RectangleHasPhysics = 'physics' extends keyof RectangleProps ? true : false;
type GroupHasPhysics = 'physics' extends keyof GroupProps ? true : false;

const publicExtensionHasPhysics: PublicExtensionHasPhysics = false;
const rectangleHasPhysics: RectangleHasPhysics = false;
const groupHasPhysics: GroupHasPhysics = false;

type PhysicsGroupProps = PrimitiveInputOf<typeof Group> & {
  readonly physics?: object;
};
type PhysicsRectangleProps = PrimitiveInputOf<typeof Rectangle> & {
  readonly physics?: object;
};

const PhysicsGroup = Group as unknown as CRCElementType<PhysicsGroupProps>;
const PhysicsRectangle = Rectangle as unknown as CRCElementType<PhysicsRectangleProps>;

const controllers = new Set<CRCController>();

afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers.clear();
  clearSharedState();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('primitive attachment presentation', () => {
  it('keeps the public core physics extension empty before package augmentation', () => {
    expect(publicExtensionHasPhysics).toBe(false);
    expect(rectangleHasPhysics).toBe(false);
    expect(groupHasPhysics).toBe(false);
  });

  it('prepares resolved geometry and applies attachment presentation before Group presentation', async () => {
    const prepared: CRCInternalPrimitiveAttachmentInput[] = [];
    const descendantWorld: DOMMatrix[] = [];
    const Probe = definePrimitive<{}, SystemStyle>(() => {
      descendantWorld.push(getCurrentWorldTransform());
    });
    const attachment = presentationAttachment(
      prepared,
      new DOMMatrix().translate(20, 10),
    );
    const canvas = createCanvas(80, 50);
    const controller = crc(canvas, (
      <PhysicsGroup
        physics={attachment}
        style={{ scaleX: 2, scaleY: 2, filter: [] }}
      >
        <Rectangle style={{ x: 1, y: 1, width: 5, height: 5, fill: '#ef4444' }} />
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
    const controller = crc(canvas, focusManaged(
      <PhysicsRectangle
        physics={attachment}
        style={{
          width: 12,
          height: 12,
          fill: '#2563eb',
          filter: { type: 'opacity', amount: 1 },
        }}
        onClick={() => clicks.push('hit')}
      />,
    ));
    controllers.add(controller);
    await nextFrame();

    expect(pixelAt(canvas, 28, 12)).toEqual([37, 99, 235, 255]);
    expect(pixelAt(canvas, 4, 4)).toEqual([0, 0, 0, 0]);
    const [target] = Array.from(getCRCInstance(canvas).eventRoot.targets);
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
    const controller = mountCRC(
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
  prepared: CRCInternalPrimitiveAttachmentInput[],
  presentationTransform2D: DOMMatrix,
): object {
  const publicValue = Object.freeze({ kind: 'test-physics-2d' });
  return crcInternalCreatePropAttachment('physics', publicValue, () => {
    const mounted: CRCInternalMountedPropAttachment = {
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
