/** Bounded arithmetic over three caller-declared boxes in one common space.
 * Does not infer painted bounds, transforms, clipping, occlusion or intent.
 */
/**
 * @typedef {{x:number,y:number,width:number,height:number}} Box
 * @param {{coordinateSpace?:string,allocation?:Box,drawing?:Box,peer?:Box,expectations?:{containment?:'required',separation?:'required'}}} [input]
 */
export function analyzeBoxRelations({ coordinateSpace, allocation, drawing, peer, expectations = {} } = {}) {
  const base = { schema: 'crc-layout-box-relations/1', scope: 'declared-axis-aligned-boxes-not-painted-visibility' };
  const invalid = () => Object.freeze({ ...base, status: 'invalid', reason: 'Require finite nonnegative boxes in a named common space and supported expectations; derived arithmetic must remain finite.' });
  const box = value => value && ['x', 'y', 'width', 'height'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key])) && value.width >= 0 && value.height >= 0 && Number.isFinite(value.x + value.width) && Number.isFinite(value.y + value.height);
  if (typeof coordinateSpace !== 'string' || !coordinateSpace.length || coordinateSpace.length > 128 || !box(allocation) || !box(drawing) || (peer !== undefined && !box(peer)) || !expectations || !['required', undefined].includes(expectations.containment) || !['required', undefined].includes(expectations.separation) || Object.keys(expectations).some(key => !['containment', 'separation'].includes(key))) return invalid();
  const overflow = { left: Math.max(0, allocation.x - drawing.x), top: Math.max(0, allocation.y - drawing.y), right: Math.max(0, drawing.x + drawing.width - allocation.x - allocation.width), bottom: Math.max(0, drawing.y + drawing.height - allocation.y - allocation.height) };
  if (!Object.values(overflow).every(Number.isFinite)) return invalid();
  const contained = Object.values(overflow).every(value => value === 0);
  let overlap = null;
  if (peer !== undefined) {
    const width = Math.min(drawing.x + drawing.width, peer.x + peer.width) - Math.max(drawing.x, peer.x);
    const height = Math.min(drawing.y + drawing.height, peer.y + peer.height) - Math.max(drawing.y, peer.y);
    const area = Math.max(0, width) * Math.max(0, height);
    if (![width, height, area].every(Number.isFinite)) return invalid();
    const relation = !drawing.width || !drawing.height || !peer.width || !peer.height ? 'degenerate' : width < 0 || height < 0 ? 'disjoint' : width === 0 || height === 0 ? 'touching' : 'overlap';
    overlap = Object.freeze({ relation, area });
  }
  return Object.freeze({ ...base, status: 'available', coordinateSpace, commonSpace: 'caller-declared-not-transformed', contained, overflow: Object.freeze(overflow), overlap,
    assertions: Object.freeze({ containment: expectations.containment === undefined ? 'not-requested' : contained ? 'pass' : 'fail', separation: expectations.separation === undefined ? 'not-requested' : overlap === null ? 'unavailable' : overlap.relation === 'overlap' ? 'fail' : 'pass' }) });
}
