/** Bounded output for locally owned replay errors; not a sandbox for hostile proxies. */
export function describeReplayError(error) {
  const limits = { nodes: 64, depth: 4, entries: 16, string: 1024, totalString: 8192 };
  const omissions = new Set();
  const seen = new WeakSet();
  let nodes = 0, remainingString = limits.totalString;
  const omitted = reason => { omissions.add(reason); return { type: 'omitted', reason }; };
  const string = value => {
    const length = Math.min(value.length, limits.string, remainingString);
    if (length < value.length) omissions.add('string-limit');
    remainingString -= length;
    return value.slice(0, length);
  };
  const own = (value, key) => {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && !('value' in descriptor)) return omitted('accessor');
      return descriptor?.value;
    } catch { return omitted('unavailable-descriptor'); }
  };
  function encode(value, depth = 0) {
    if (++nodes > limits.nodes) return omitted('node-limit');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') return string(value);
    if (typeof value === 'number') return Number.isFinite(value) ? value : { type: 'nonfinite', value: String(value) };
    if (value === undefined) return { type: 'undefined' };
    if (typeof value !== 'object') return omitted(`unsupported-${typeof value}`);
    if (seen.has(value)) return omitted('cycle');
    if (depth >= limits.depth) return omitted('depth-limit');
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const length = own(value, 'length');
        const items = [];
        for (let index = 0; index < Math.min(length, limits.entries); index++) {
          if (nodes >= limits.nodes) { omissions.add('node-limit'); break; }
          items.push(encode(own(value, String(index)), depth + 1));
        }
        if (length > items.length) omissions.add('entry-limit');
        return { type: 'array', length, items };
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) return omitted('unsupported-object');
      const entries = [];
      // Output is bounded; enumerating an arbitrary object is not a hard CPU budget.
      for (const key of Object.keys(value)) {
        if (entries.length >= limits.entries) { omissions.add('entry-limit'); break; }
        if (nodes >= limits.nodes) { omissions.add('node-limit'); break; }
        entries.push({ key: string(key), value: encode(own(value, key), depth + 1) });
      }
      return { type: 'object', entries };
    } catch { return omitted('unavailable-object'); }
    finally { seen.delete(value); }
  }
  const message = own(error, 'message');
  const code = own(error, 'code');
  const operator = own(error, 'operator');
  const summary = string(typeof message === 'string' ? message : typeof error === 'string' ? error : 'Thrown value has no own string message.');
  const assertion = code === 'ERR_ASSERTION' ? {
    operator: typeof operator === 'string' ? string(operator) : null,
    expected: encode(own(error, 'expected')),
    actual: encode(own(error, 'actual')),
    ...(own(error, 'comparison') === undefined ? {} : { comparison: encode(own(error, 'comparison')) }),
  } : null;
  // A reported diagnostic shape, not an authenticity check or instanceof claim.
  const layoutDiagnostic = own(error, 'name') === 'LayoutDiagnostic' ? {
    component: encode(own(error, 'component')),
    property: encode(own(error, 'property')),
    algorithm: encode(own(error, 'algorithm')),
    suppliedValue: encode(own(error, 'suppliedValue')),
    constraints: encode(own(error, 'constraints')),
  } : null;
  return {
    message: summary,
    code: typeof code === 'string' ? string(code) : null,
    assertion,
    layoutDiagnostic,
    detail: { limits, omissions: [...omissions] },
  };
}
