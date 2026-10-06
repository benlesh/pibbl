# `@pibbl/three`

> **ALPHA — NOT FOR PRODUCTION USE.** Pibbl 0.0.2 is experimental. APIs may change or be removed without notice. Use it only for evaluation and experimentation.

`@pibbl/three` embeds an ordinary Three.js scene as one composited render layer in
the Pibbl Canvas runtime. The application continues to own its scene, camera,
objects, controls, and other Three resources; the adapter owns the transparent
renderer and connects rendering, picking, focus, input arbitration, and cleanup
to Pibbl's public `defineRenderLayer()` lifecycle.

The package peers on both `@pibbl/core` and `three` and does not re-export or
bundle a private copy of Three.js.
