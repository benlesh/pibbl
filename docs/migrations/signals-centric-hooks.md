# Signals-centric hooks migration

Pibbl now has one reactive authoring model. `useSignal`, `useComputed`,
`useConst`, and `useReaction` replace the former overlapping hook vocabulary.
This is a source migration: the removed exports have no compatibility aliases.

## `useState` to `useSignal`

Before:

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  const reset = () => setCount(4);
  return (
    <Text onClick={() => setCount((current) => current + 1)}>{count}</Text>
  );
}
```

After:

```tsx
function Counter() {
  const count = useSignal(0);
  const reset = () => count.set(4);
  return (
    <Text onClick={() => count.update((current) => current + 1)}>{count}</Text>
  );
}
```

Use `.set(functionValue)` when a function is the value itself. Use `.update()`
only for an updater. Public types should use `WritableSignal<T>` instead of the
removed `StateUpdater<T>` tuple setter type.

## `useMemo` to `useComputed` or `useConst`

Before:

```tsx
const label = useMemo(() => `${count.get()} ${suffix}`, [suffix]);
const geometry = useMemo(() => createGeometry(config), []);
```

After:

```tsx
const label = useComputed(() => `${count.get()} ${suffix}`, [suffix]);
const geometry = useConst(() => createGeometry(config));
```

Use `useComputed` when the result participates in the signal graph. Use
`useConst` only for one untracked mount-lifetime value. A signal read inside a
`useConst` factory is a frozen snapshot, not a dependency.

## `useWhenChanged` to `useReaction`

Before:

```tsx
useWhenChanged(() => {
  resource.connect(id);
  return () => resource.disconnect(id);
}, [id]);
```

After:

```tsx
useReaction(() => {
  resource.connect(id);
  const level = levelSignal.get();
  resource.setLevel(level);
  return () => resource.disconnect(id);
}, [id]);
```

The lifecycle changes deliberately. `useReaction` setup runs in Complete after
a successful render, and signal reads inside setup drive later reaction runs
without making the component a render consumer. Pibbl runs the exact previous
cleanup before replacement and once on final release. Signal writes are not
allowed during setup or cleanup.

## Direct signal inputs

Prefer passing signals to declared Pibbl inputs when the receiver should own the
dependency:

```tsx
const scene = (
  <>
    <Rectangle style={{ x, fill: color, width: 50, height: 50 }} />
    <Text>{label}</Text>
    <LineSeries data={data} />
  </>
);
```

Use `value.get()` when the enclosing component intentionally needs the snapshot
for branching, arithmetic, aggregation, or another value that it constructs.
Custom component APIs can accept `SignalValue<T>` and call
`resolveSignalValue()` at the receiving boundary. Pibbl does not deep-unwrap
signals hidden inside arbitrary objects or datasets.
