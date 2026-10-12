import { PathGeometry } from '../geometry/path-geometry.js';
import { toSvgPathData } from '../geometry/path-conversion.js';
import { GLOBAL_STATE } from '../global-state.js';
import type { LayoutBox } from '../layout/types.js';

const snapshots = new WeakMap<PathGeometry, { revision: number; data: string }>();
export function portablePath(path: PathGeometry | Path2D): string | undefined {
  if (!GLOBAL_STATE.currentPibblInstance?.eventRoot.htmlOverlay || !(path instanceof PathGeometry)) return undefined;
  const prior = snapshots.get(path);
  if (prior?.revision === path.revision) return prior.data;
  const data = toSvgPathData(path);
  snapshots.set(path, { revision: path.revision, data });
  return data;
}
export function rectangleSvg(box: Readonly<LayoutBox>): string {
  return `M${box.x} ${box.y}h${box.width}v${box.height}h${-box.width}Z`;
}
