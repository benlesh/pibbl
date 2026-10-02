import { rectangleSvg } from '../html/portable-clips.js';
import { definePrimitive } from '../define-primitive.js';
import { createElement } from '../element/create-element.js';
import { setPlacementIdentityHint } from '../element/metadata.js';
import type { CRCElement } from '../element/types.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { InternalIdentityHint, RenderingContext2D } from '../types.js';
import { pushClippingPath } from '../util/push-clipping-path.js';
import { pushLayoutBox } from './context.js';
import { recordLayoutPlacement } from './diagnostics.js';
import type { LayoutBox } from './types.js';

interface PlacedChildProps {
  element: CRCElement<any>;
  box: Readonly<LayoutBox>;
  clipInChildSpace?: Readonly<LayoutBox>;
  identityHint: InternalIdentityHint;
}

function PlacedChild(
  props: PlacedChildProps,
  _style: Readonly<{}>,
  ctx: RenderingContext2D,
) {
  recordLayoutPlacement();
  assertFiniteBox(props.box, 'placement');
  if (props.clipInChildSpace) {
    assertFiniteBox(props.clipInChildSpace, 'placement clip');
  }

  const refs = GLOBAL_STATE.componentRefs!;
  let localBox = refs.refs[0] as Readonly<LayoutBox> | undefined;
  if (
    !localBox ||
    localBox.width !== props.box.width ||
    localBox.height !== props.box.height
  ) {
    localBox = Object.freeze({
      x: 0,
      y: 0,
      width: props.box.width,
      height: props.box.height,
    });
    refs.refs[0] = localBox;
  }

  ctx.translate(props.box.x, props.box.y);
  const releaseLayout = pushLayoutBox(localBox);
  let releaseClip: (() => void) | undefined;
  try {
    const clip = props.clipInChildSpace;
    if (clip) {
      const path = new Path2D();
      path.rect(clip.x, clip.y, clip.width, clip.height);
      releaseClip = pushClippingPath(ctx, path, 'nonzero', true, rectangleSvg(clip));
    }
  } catch (error) {
    releaseLayout();
    throw error;
  }

  refs.onAfterRender = () => {
    releaseClip?.();
    releaseLayout();
  };
  return props.element;
}

const PlacedChildPrimitive = definePrimitive<PlacedChildProps>(PlacedChild);

export function placeChild(props: PlacedChildProps): CRCElement<any> {
  const element = createElement(PlacedChildPrimitive, props);
  setPlacementIdentityHint(element, props.identityHint);
  return element;
}

export function createPlacementIdentityHint(
  element: CRCElement<any>,
  occurrence: number,
): InternalIdentityHint {
  if (!Number.isInteger(occurrence) || occurrence < 0) {
    throw new Error('Placement identity occurrence must be a nonnegative integer');
  }
  return { type: element.type, key: element.key, occurrence };
}

function assertFiniteBox(box: Readonly<LayoutBox>, label: string): void {
  for (const [property, value] of Object.entries(box)) {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} ${property} must be finite, received ${value}`);
    }
  }
  if (box.width < 0 || box.height < 0) {
    throw new Error(`${label} dimensions must be nonnegative`);
  }
}
