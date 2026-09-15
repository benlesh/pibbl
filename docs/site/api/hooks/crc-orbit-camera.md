---
id: api-hook-crc-orbit-camera
title: crcOrbitCamera
summary: Owns a drag-orbit and wheel-zoom perspective-camera pose.
kind: api
slug: crc-orbit-camera
apiCategory: hook
symbols:
  [crcOrbitCamera, CRCOrbitCameraOptions, CRCOrbitCameraHandlers, CRCOrbitCameraResult]
relatedTypes: [CRCWebGLVector3]
---

# crcOrbitCamera

```ts
import { crcOrbitCamera } from "@crc/webgl";
```

`crcOrbitCamera(options)` returns immutable `position` and `lookAt` vectors plus
one stable bundle of ordinary CRC pointer and wheel handlers. Attach the
handlers to geometry covering the desired interaction area, then pass the pose
to a perspective `WebGLLayer` camera.

Required `orbitPoint` and `initialPosition`
[`CRCWebGLVector3`](#/api/types/webgl#crcwebglvector3) values must be finite
and must differ. Optional positive distance bounds default to `0.1` and no
maximum; finite nonnegative rotation and zoom speeds default to `1`.

Primary-pointer drag rotates by `0.01 * rotateSpeed` radians per root-logical
pixel. Wheel input zooms exponentially, respects pixel, line, and page delta
modes, and prevents the browser default only when it changes the distance.
Static poses request no idle animation frames.
