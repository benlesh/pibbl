# `@crc/webgl`

WebGL2 islands for the CRC Canvas component runtime.

This package is version-coupled to `@crc/core`. Applications use the JSX
runtime, hooks, and events from `@crc/core`; `@crc/webgl` adds the WebGL
primitives and immutable geometry used inside a WebGL island.

The initial package foundation exposes `createWebGLGeometry()`. Rendering
components will be added as the WebGL island implementation progresses.
