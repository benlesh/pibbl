---
id: api-function-record-frames
title: recordFrames
summary: Records timestamped bitmap frames from a live Pibbl root canvas.
kind: api
slug: record-frames
apiCategory: function
symbols: [recordFrames, exportGif]
relatedTypes:
  [
    PibblFrameRecordingOptions,
    PibblFrameRecordingSession,
    PibblFrameRecording,
    PibblRecordedFrameInfo,
    PibblRecordedFrame,
    PibblGifExportOptions,
  ]
---

# recordFrames and exportGif

```ts
import { recordFrames, exportGif } from "@pibbl/core";

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
// This canvas must already have a live pibbl() mount.
const capture = recordFrames(canvas, { duration: 5000, frameRate: 60 });
await capture.ready;
// capture.stop() finishes early and keeps frames.
// capture.cancel() discards active capture and rejects with AbortError.
const recording = await capture.finished;
try {
  const gif = await exportGif(recording, {
    repeatCount: 0,
    background: "white",
  });
  // gif is a caller-owned image/gif Blob.
} finally {
  recording.dispose();
}
```

Capture observes successful, fully composed Pibbl root renders, with the current
committed bitmap at timestamp zero. It does not schedule rendering or fabricate frames while the app does not
render. Renders inside the capture-rate interval coalesce into one pending
capture so the final static bitmap is preserved. Timestamps and the actual recording duration preserve still holds.
The maximum capture rate defaults to 60; output GIF sampling defaults to 25.
Dimensions are physical backing pixels, including device pixel ratio.

Stop and cancel are idempotent. Stop during initialization captures frame zero
then finishes. Disposing the mount cancels active capture; completed recordings
remain independently owned until `recording.dispose()`. A cancelled or failed
capture releases its worker, pixels, render subscription, timers, and listeners.

Recording requires a readable Canvas 2D bitmap, WebAssembly, Worker, and CSP
permission for `worker-src blob:`. Canvas origin taint, resize, render failure,
allocation failure, or a full three-frame transfer queue rejects capture and
releases it. The estimate uses backing width × height × 4 × expected frame count
× memory headroom (default 1.15); storage can grow. It is raw RGBA memory, not the
much smaller final GIF size. No workers or WASM memory initialize on import.

GIF export runs in the recording's worker, keeps the original frames, and allows
one export at a time. Its `signal` cancels conversion without discarding the
recording; disposing the recording cancels pending exports and reads. Progress
is reported between bounded batches. A shared sampled palette limits colors to
256, delays round cumulatively to 10ms, and output sampling selects the most
recent captured frame. GIF is lossy. An opaque CSS background flattens alpha;
without one, alpha below 128 is transparent and other pixels become opaque.
Canvas CSS backgrounds and HtmlBox DOM content are not part of its bitmap.

Capture uses [PibblFrameRecordingOptions](#/api/types/frame-recording#pibblframerecordingoptions)
and returns [PibblFrameRecordingSession](#/api/types/frame-recording#pibblframerecordingsession).
Its result is [PibblFrameRecording](#/api/types/frame-recording#pibblframerecording),
with [PibblRecordedFrameInfo](#/api/types/frame-recording#pibblrecordedframeinfo) metadata
and [PibblRecordedFrame](#/api/types/frame-recording#pibblrecordedframe) pixel copies.
Export dimensions, maximum colors, dithering, automatic palette sampling effort,
and an optional exact palette are all controlled through the export options.
They leave retained pixels intact, allowing repeated exports with different settings.
Encoding accepts [PibblGifExportOptions](#/api/types/frame-recording#pibblgifexportoptions).
