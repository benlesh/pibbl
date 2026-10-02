import type { ResolvedDrawingStyle } from '../style/types.js';
import { definePrimitive } from '../define-primitive.js';
import { GLOBAL_STATE } from '../global-state.js';
import { resolveBox } from '../layout/box.js';
import type { LayoutBox } from '../layout/types.js';
import { createGroupTransform, setPrimitivePresentation } from '../primitive-presentation.js';
import { getCurrentWorldTransform } from '../render-target.js';
import { registerOpaquePrimitiveProps } from '../element/metadata.js';
import { requireHtmlService, snapshotClips } from '../html/html-service.js';
import type { HtmlBoxProps, HtmlBoxSlot, HtmlBoxStyle } from '../html/types.js';
import type { CRCRenderResult, PrimitiveInput, RenderingContext2D } from '../types.js';
import { stripLayoutParticipation } from '../style/resolve-built-in.js';

type Resolved = ResolvedDrawingStyle<HtmlBoxStyle> & {
  borderBox: Readonly<LayoutBox>; contentBox: Readonly<LayoutBox>; overflow: 'visible' | 'clip';
};

function renderHtmlBox(props: HtmlBoxProps<unknown>, style: Readonly<Resolved>, ctx: RenderingContext2D): void {
  const refs = GLOBAL_STATE.componentRefs!;
  const owner = GLOBAL_STATE.currentCRCInstance!;
  const service = requireHtmlService(owner);
  let slot = refs.refs[0] as HtmlBoxSlot | undefined;
  if (!slot || slot.disposed) {
    if (typeof props.mount !== 'function') throw new TypeError('HtmlBox mount must be a function.');
    slot = { owner, component: refs, mount: props.mount, disposed: false, region: { identity: {}, owner, content: undefined, rootBounds: undefined, active: true } };
    const stable = slot;
    stable.region = { ...stable.region, onFocusSnapshot(snapshot) {
      queueMicrotask(() => { if (!stable.disposed) stable.callback?.(snapshot); });
    } };
    refs.refs[0] = slot;
    refs.teardowns.add(() => service.release(stable));
  }
  const opacity = style.opacity ?? 1;
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('HtmlBox opacity must be between 0 and 1.');
  service.register({ slot, handlers: props, data: props.data, matrix: getCurrentWorldTransform(),
    clips: snapshotClips(GLOBAL_STATE.clippingStack), border: style.borderBox, content: style.contentBox,
    opacity: ctx.globalAlpha * opacity, interactive: props.pointerEvents !== 'none', overflow: style.overflow ?? 'clip', onFocusChange: props.onFocusChange });
}

const primitive = definePrimitive<HtmlBoxProps<unknown>, HtmlBoxStyle, HtmlBoxStyle, Resolved>(renderHtmlBox, {
  resolveStyle(style, context) {
    const box = resolveBox({ ...style, width: style.width === undefined || style.width === 'auto' ? context.allocation.width : style.width,
      height: style.height === undefined || style.height === 'auto' ? context.allocation.height : style.height }, context.constraints, { component: 'HtmlBox' });
    return { ...stripLayoutParticipation(style), ...box, overflow: style.overflow ?? 'clip' } as Resolved;
  },
});

registerOpaquePrimitiveProps(primitive, ['data']);
setPrimitivePresentation<Resolved>(primitive, style => ({ transform: createGroupTransform(style) }));

type HtmlBoxInput<Props> = Omit<PrimitiveInput<HtmlBoxProps<Props>, HtmlBoxStyle>, 'data' | 'mount'> & Pick<HtmlBoxProps<Props>, 'data' | 'mount'>;
type HtmlBoxComponent = {
  <Props>(props: HtmlBoxInput<Props>): CRCRenderResult;
};
/** A persistent native HTML box projected into CRC layout, transforms and clips. */
export const HtmlBox = primitive as HtmlBoxComponent;
