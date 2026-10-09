---
id: api-types-frame-recording
title: Frame recording types
summary: Capture sessions, timestamped frames, and GIF export options.
kind: api
slug: frame-recording
apiCategory: types
symbols:
  [
    PibblFrameRecordingOptions,
    PibblFrameRecordingSession,
    PibblFrameRecording,
    PibblRecordedFrameInfo,
    PibblRecordedFrame,
    PibblGifExportOptions,
  ]
---

# Frame recording types

## PibblFrameRecordingOptions

`PibblFrameRecordingOptions` requires `duration` in milliseconds and accepts
`frameRate`, `memoryHeadroom`, and an optional cancellation `signal`.

## PibblFrameRecordingSession

`PibblFrameRecordingSession` exposes `ready`, `finished`, `stop()`, and `cancel()`.
Stop preserves captured frames. Cancel discards an active session.

## PibblFrameRecording

`PibblFrameRecording` exposes actual `duration`, immutable `frames` metadata,
`readFrame(index)`, and idempotent `dispose()`. Each read returns a caller-owned
copy; disposal releases worker-owned pixels and cancels pending operations.

## PibblRecordedFrameInfo

`PibblRecordedFrameInfo` contains `timestamp` in milliseconds from capture start,
plus physical backing `width` and `height`.

## PibblRecordedFrame

`PibblRecordedFrame` adds `data`, a
`Uint8ClampedArray` of RGBA8 bytes.

## PibblGifExportOptions

`PibblGifExportOptions` accepts `frameRate` (default 25, maximum 100), `repeatCount`
(omitted plays once, zero loops forever, positive values repeat), an opaque CSS
`background`, an abort `signal`, and `onProgress(progress)` from zero to one.

Export quality and size controls:

- `width` and `height`: integer output dimensions from 1 to 65535. One dimension
  preserves aspect ratio; both specify the exact size. Omitted dimensions keep
  the original bitmap size. Resizing uses premultiplied-alpha bilinear sampling.
- `maxColors`: integer 2–256, default 256. Includes the transparency entry when
  `background` is omitted. GIF color tables round up to a power of two.
- `palette`: optional array of opaque CSS colors, used exactly instead of an
  automatically selected palette. Its length must fit `maxColors`, allowing one
  extra entry for transparent export. Unrepresented pixels use the nearest RGB
  palette color. Partial-alpha colors are rejected.
- `dithering`: boolean, default false. Enables Floyd–Steinberg error diffusion.
- `quantizationSampleFactor`: integer 1–30, default 10. One spends most NeuQuant
  training effort; larger factors sample less and run faster.
- `paletteSampleCount`: integer 1–16777216, default 262144. Caps pixels sampled
  across up to 32 representative output frames for palette selection.

A supplied palette bypasses both automatic sampling controls. All exports keep
recorded pixels unchanged, so a recording can be exported repeatedly with different
settings. GIF compression itself is lossless over the resulting palette indexes;
color reduction, binary transparency, resizing and frame sampling may lose detail.

See [recordFrames and exportGif](#/api/functions/record-frames).
