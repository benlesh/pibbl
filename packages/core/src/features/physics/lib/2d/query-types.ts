import type { PibblPhysicsQueryOptions2D } from './types.js';

// Private execution policies shared by the fixed-contract public query functions.
export type QueryMode = 'closest' | 'any' | 'all';
export interface QueryOptions<Mode extends QueryMode = 'closest'> extends PibblPhysicsQueryOptions2D {
  readonly mode?: Mode;
}
export type QueryResult<Mode extends QueryMode, Result> = Mode extends 'any'
  ? boolean : Mode extends 'all' ? readonly Result[] : Result | null;
