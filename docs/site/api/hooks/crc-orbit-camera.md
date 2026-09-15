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
handlers to any drawing target covering the desired interaction area, then pass
the pose to a perspective `WebGLLayer` camera.

```tsx
const orbit = crcOrbitCamera({
  orbitPoint: [0, 0, 0],
  initialPosition: [4, 3, 6],
  minDistance: 2,
  maxDistance: 12,
});

return (
  <>
    <WebGLLayer
      camera={{
        type: "perspective",
        position: orbit.position,
        lookAt: orbit.lookAt,
        up: [0, 1, 0],
        fieldOfViewDegrees: 45,
        near: 0.1,
        far: 100,
      }}
    >
      {scene}
    </WebGLLayer>
    <Rectangle
      {...orbit.handlers}
      style={{ width: 640, height: 360, fill: "rgba(0, 0, 0, 0)" }}
    />
  </>
);
```

Required `orbitPoint` and `initialPosition`
[`CRCWebGLVector3`](#/api/types/webgl#crcwebglvector3) values must be finite
and must differ. Optional positive distance bounds default to `0.1` and no
maximum; finite nonnegative rotation and zoom speeds default to `1`.

`initialPosition` is mount-only. The orbit point, bounds, and speeds are live
options, but a candidate set is adopted only after successful render. The
handler bundle is stable for the mounted hook slot. Unchanged pose vectors and
the containing result retain reference identity. `maxDistance` must not be less
than `minDistance`.

Primary-pointer drag rotates by `0.01 * rotateSpeed` radians per root-logical
pixel, captures the active pointer, clamps polar motion just short of the poles,
and ends on pointer up, cancellation, or lost capture. Wheel input zooms
exponentially using `0.001 * zoomSpeed`, treats line deltas as 16 pixels and page
deltas as the logical viewport height, and prevents the browser default only
when it changes the bounded distance. Static poses request no idle animation
frames.

These are ordinary CRC handlers: a structural `Group`, layout component,
`WebGLLayer`, or `Group3D` adds propagation ancestry but no rectangular hit
geometry. Attach the bundle to an explicit Canvas or WebGL drawing target when
empty space should orbit. The hook does not create a focus candidate or change
mesh picking/focus geometry, and a camera-only update can reuse unchanged
shadow-depth generations. Teardown makes retained handlers inert and releases
active pointer state; the hook owns no native listener or independent frame
loop. See [Light WebGL scenes](#/learn/guides/webgl-lighting).
