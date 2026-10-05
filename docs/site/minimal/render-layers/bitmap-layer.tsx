import { crc, defineRenderLayer, type CRCRenderLayerComponentProps, type CRCRenderLayerContext, type CRCRenderLayerDefinition, type CRCRenderLayerFrame, type CRCRenderLayerHit, type CRCRenderLayerInput, type CRCRenderLayerInteraction, type CRCRenderLayerInteractionSnapshot, type CRCRenderLayerProps, type CRCRenderLayerSize, type CRCRenderLayerStyle, type CRCRenderLayerTarget } from '@crc/core';

interface DotProps { readonly x: number; readonly y: number }
interface DotTarget { readonly id: 'dot' }
interface DotResources {
  readonly context: OffscreenCanvasRenderingContext2D;
  readonly invalidate: () => void;
  readonly target: DotTarget;
  active: boolean;
  elapsed: number;
}

const status = document.createElement('p');
status.textContent = 'Click the dot';
const canvas = document.createElement('canvas');
canvas.width = 320;
canvas.height = 200;
document.body.append(canvas, status);

const interaction: CRCRenderLayerInteraction<DotProps, DotResources, DotTarget> = {
  settle(resources, props, size) {
    const target: CRCRenderLayerTarget<DotTarget> = {
      target: resources.target,
      cursor: 'pointer',
      handlers: { onClick: () => undefined },
    };
    const snapshot: CRCRenderLayerInteractionSnapshot<DotTarget> = {
      targets: [target],
      hitTest(point): CRCRenderLayerHit<DotTarget> {
        const dx = point.x - props.x;
        const dy = point.y - props.y;
        if (point.x < 0 || point.y < 0 || point.x > size.width || point.y > size.height) {
          return { kind: 'miss' };
        }
        return dx * dx + dy * dy <= 24 * 24
          ? { kind: 'target', target: resources.target }
          : { kind: 'miss' };
      },
      onInput(input: Readonly<CRCRenderLayerInput<DotTarget>>) {
        if (input.type !== 'click' || input.hit.kind !== 'target') return;
        resources.active = !resources.active;
        status.textContent = resources.active
          ? `Dot selected after ${resources.elapsed.toFixed(1)}s`
          : 'Click the dot';
        resources.invalidate();
      },
    };
    return snapshot;
  },
};

const definition: CRCRenderLayerDefinition<DotProps, DotResources, DotTarget> = {
  create(context: Readonly<CRCRenderLayerContext>): DotResources {
    const drawing = context.canvas.getContext('2d');
    if (!drawing) throw new Error('Offscreen Canvas 2D is unavailable.');
    return { context: drawing, invalidate: context.invalidate, target: { id: 'dot' }, active: false, elapsed: 0 };
  },
  resize(resources, size: Readonly<CRCRenderLayerSize>) {
    resources.context.canvas.width = size.backingWidth;
    resources.context.canvas.height = size.backingHeight;
  },
  render(resources, frame: Readonly<CRCRenderLayerFrame>, context) {
    resources.elapsed += frame.deltaSeconds;
    const { width, height, pixelRatioX, pixelRatioY } = context.size;
    const drawing = resources.context;
    drawing.setTransform(pixelRatioX, 0, 0, pixelRatioY, 0, 0);
    drawing.clearRect(0, 0, width, height);
    drawing.fillStyle = resources.active ? '#be123c' : '#0f766e';
    drawing.beginPath();
    drawing.arc(160, 100, 24, 0, Math.PI * 2);
    drawing.fill();
  },
  interaction,
};

const DotLayer = defineRenderLayer(definition);
const style: CRCRenderLayerStyle = { width: 320, height: 200 };
const componentProps: CRCRenderLayerComponentProps = { style, missBehavior: 'pass-through' };
const props: CRCRenderLayerProps<DotProps> = { ...componentProps, x: 160, y: 100 };
const controller = crc(canvas, <DotLayer {...props} />);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
