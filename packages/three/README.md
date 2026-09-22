# `@crc/three`

`@crc/three` embeds an ordinary Three.js scene as one composited render layer in
the CRC Canvas runtime. The application continues to own its scene, camera,
objects, controls, and other Three resources; the adapter owns the transparent
renderer and connects rendering, picking, focus, input arbitration, and cleanup
to CRC's public `defineRenderLayer()` lifecycle.

The package peers on both `@crc/core` and `three` and does not re-export or
bundle a private copy of Three.js.
