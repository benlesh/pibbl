---
id: api-hook-use-animated-value
title: useAnimatedValue
summary: Presents a target through a component-owned tween or spring signal.
kind: api
slug: use-animated-value
apiCategory: hook
symbols: [useAnimatedValue]
relatedTypes: [Signal, PibblAnimatedValueOptions, PibblAnimationTarget]
---

# useAnimatedValue

`useAnimatedValue(target, { animation, initial?, equals?, debugName? })` returns
one stable readonly signal. Supply an immutable definition or a pure factory:

```tsx
const x = useAnimatedValue(targetX, {
  animation: spring({ stiffness: 180, damping: 12 }),
  initial: 0,
});
const opacity = useAnimatedValue(targetOpacity, {
  animation: tween({ duration: 200, easing: easing.easeOut }),
});
```

The hook supplies the current and target endpoints to spring and tween
definitions. Spring retargeting preserves committed analytic velocity; tween
retargeting starts a full new duration. Reusable definitions are never mutated.
For `drive`, spring and tween definitions still need an explicit `to` value.

Custom factories receive `{ from, to, velocity }` and return a definition, such
as `defineAnimation({ duration, sample })`. They run synchronously during render,
may be evaluated more than once, and must not write signals or call hooks.
Factory errors reject the render before target adoption. Other definitions
such as keyframes keep their authored samples; use a factory when their samples
need to depend on the target.

Omitting `initial` presents the mount target immediately. A different initial
value animates after successful mount. Options and individual hook fields may
be signals; use a computed definition to react to algorithm parameters.

Related types: [`Signal`](#/api/types/canvas-runtime#signal),
[`PibblAnimatedValueOptions`](#/api/types/canvas-runtime#pibblanimatedvalueoptions),
and [`PibblAnimationTarget`](#/api/types/canvas-runtime#pibblanimationtarget).
