# Definition-based animated values

Use `useAnimatedValue(target, { animation, initial?, equals?, debugName? })`.
Move spring/tween parameters into `spring(...)` or `tween(...)` and remove the
old `type` selector. Keep equality, initial presentation, and diagnostic settings
on the hook options. The temporary `useSpringValue` and `useTweenValue` hooks
are removed without aliases. Use `PibblAnimatedValueOptions<T>` for hook options.

```ts
const x = useAnimatedValue(targetX, {
  animation: spring({ stiffness: 180, damping: 12 }),
  initial: 0,
});
```

Spring retargeting preserves velocity; tweens restart their full duration from
the committed value. A pure custom factory receives `{ from, to, velocity }`
and returns a definition. Definitions are reusable. Spring and tween definitions
used with `drive` still require `to`; the hook supplies endpoints itself.

For reactive algorithm settings, pass a computed definition as `animation`,
for example `computed(() => tween({ duration: duration.get() }))`.

`useVisibilityTransition` controls visual entrance and exit separately from
this target-value hook.
