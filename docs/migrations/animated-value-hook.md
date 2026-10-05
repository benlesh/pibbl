# Animated value hook rename

`useTransition(target, options)` is now `useAnimatedValue(target, options)`.
The tween and spring behavior is unchanged. There is no compatibility alias.
Rename imports and calls, and use `PibblTweenAnimatedValueOptions` and
`PibblSpringAnimatedValueOptions` for the corresponding option types.

The new experimental `useVisibilityTransition` controls an element's visual
entrance and exit; it is separate from target-value interpolation. Its first
slice supports `fade()` through `style.transition: controller.binding`.
