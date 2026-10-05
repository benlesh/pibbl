import { definePrimitive } from '../../lib/define-primitive.js';
import { useRectPath } from '../../lib/hooks/use-rect-path.js';
import { wireCommonEvents } from '../../lib/util/wire-common-events.js';
import type { ImageProps } from '../../lib/components/img.js';
import type { SystemStyle } from '../../lib/types.js';
import { frameRecord, type SpriteFrame } from './model.js';
/** Drawing inputs; frame also accepts a signal through Pibbl's declared primitive inputs. See {@link SpriteFrame}. */
export interface SpriteProps extends ImageProps {
  /** Atlas frame to draw; its sheet must remain undisposed. */ readonly frame: SpriteFrame;
  /** Image interpolation; defaults to linear. */ readonly sampling?: 'nearest' | 'linear';
  /** Normalized origin within the original frame, defaulting to the top-left. */ readonly anchor?: Readonly<{ /** Horizontal anchor fraction. */ x: number; /** Vertical anchor fraction. */ y: number }>;
  /** Mirror the frame horizontally. */ readonly flipX?: boolean;
  /** Mirror the frame vertically. */ readonly flipY?: boolean;
}
/** Logical size overrides; omitted dimensions use the original untrimmed frame size. See {@link SpriteFrame}. */
export interface SpriteStyle extends SystemStyle { /** Logical width; defaults to the original frame width. */ readonly width?: number; /** Logical height; defaults to the original frame height. */ readonly height?: number; /** Opacity multiplier applied to the frame. */ readonly opacity?: number }
/** Draw a shared atlas frame, preserving its logical geometry across frame changes. See {@link SpriteFrame}. */
export const Sprite = definePrimitive<SpriteProps, SpriteStyle>((props, style, ctx) => {
  const record = frameRecord(props.frame);
  const width = style.width ?? props.frame.width, height = style.height ?? props.frame.height;
  const x = -(props.anchor?.x ?? 0) * width, y = -(props.anchor?.y ?? 0) * height;
  const path = useRectPath(x, y, width, height);
  const r = record.rect;
  ctx.save();
  try {
    ctx.globalAlpha *= style.opacity ?? 1;
    ctx.imageSmoothingEnabled = props.sampling !== 'nearest';
    ctx.translate(x + (props.flipX ? width : 0), y + (props.flipY ? height : 0));
    ctx.scale((props.flipX ? -1 : 1) * width / props.frame.width, (props.flipY ? -1 : 1) * height / props.frame.height);
    ctx.translate(record.trim?.x ?? 0, record.trim?.y ?? 0);
    if (record.rotated) { ctx.translate(0, r.width); ctx.rotate(-Math.PI / 2); }
    ctx.drawImage(record.image, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
  } finally { ctx.restore(); }
  wireCommonEvents(props, path, true, 0, undefined, { x, y, width, height });
});
