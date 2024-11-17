import { crcEvent } from './crc-event';

/**
 * Hook: For wiring up changes to the CSS cursor style while over a corresponding path.
 * NOTE: If the path reference changes between, the click event will be
 * torn down and re-registered. Be sure use the same instance of a Path if
 * it doesn't change. {@link crcMemo} may be useful for this.
 */
export function crcCursor({
  path,
  style,
  fill = false,
  lineInteractionWidth = 0,
}: {
  path?: Path2D;
  style?: string;
  fill?: boolean;
  lineInteractionWidth?: number;
}) {
  crcEvent(
    'mousemove',
    style ?
        (e) => {
          const canvas = e.originalEvent.target as HTMLCanvasElement;
          if (!canvas.style.cursor) {
            // If something has already set it, don't confuse it.
            canvas.style.cursor = style;
          }
        } :
      undefined,
    path,
    fill,
    lineInteractionWidth,
  );

  crcEvent(
    'mouseout',
    style ?
        (e) => {
          const canvas = e.originalEvent.target as HTMLCanvasElement;
          canvas.style.removeProperty('cursor');
        } :
      undefined,
    path,
    fill,
    lineInteractionWidth,
  );
}
