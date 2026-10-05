import { toPath2D } from './path-conversion.js';
import { PathGeometry } from './path-geometry.js';

export type PibblPathInput = Path2D | PathGeometry;

interface PathSnapshot {
  readonly revision: number;
  readonly path: Path2D;
}

const snapshots = new WeakMap<PathGeometry, PathSnapshot>();

/** @internal Resolves one immutable native snapshot for Pibbl-owned consumers. */
export function resolvePath(input: PibblPathInput): Path2D {
  if (!(input instanceof PathGeometry)) return input;

  const revision = input.revision;
  const previous = snapshots.get(input);
  if (previous?.revision === revision) return previous.path;

  const path = toPath2D(input);
  snapshots.set(input, { revision, path });
  return path;
}
