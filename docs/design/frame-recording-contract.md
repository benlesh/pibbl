# Pibbl frame recording contract

Implemented public surface: `recordFrames(canvas, options)` and
`exportGif(recording, options)` from `@pibbl/core`.

Recording is opt-in and works on any live Pibbl root Canvas 2D bitmap. It observes
successful root render transactions after nested layers and external bitmaps
compose. Failure rejects the session. Ordinary renders acquire no observer and
perform no recording readback. Optional `onRenderComplete` reports committed or
failed root attempts after all committed-state finish callbacks publish. Its
monotonic `generation` joins semantic application inspection to pixels. Optional
`onFrameCaptured` reports the exact committed generation after RGBA copying;
recorded frame metadata carries the same `renderGeneration`. Timestamps remain
wall-clock capture times, not generation IDs, and sampling can coalesce renders.
Failed attempts never produce committed pixel frames. The API does not record DOM overlays or CSS
backgrounds, and it never requests an animation frame or advances application
playback. A first pending mount render supplies backing dimensions before worker
allocation; a suspended zero-display surface rejects initialization.

Capture starts after worker initialization, with the currently committed bitmap
at timestamp zero. The deadline measures wall-clock milliseconds, not playback
logical time. The frame-rate option is a maximum, not an animation scheduler.
Renders inside the sampling interval coalesce into one pending capture of the
latest committed bitmap. This one-shot capture timer never requests rendering;
static spans with no new committed bitmap create no duplicate frame. Stop ends
at elapsed time and preserves frames; repeated stop/cancel calls are inert.
Stop during initialization captures frame zero and then finishes. Cancel discards
an active session. The ready and finished promises reject with AbortError for
cancellation, including mount disposal. Stopping detaches the mount subscription;
retained recordings are independent of subsequent mount disposal.

One recording worker owns one WASM instance, one growable raw RGBA arena, and
frame offsets/timestamps. Captures transfer ArrayBuffers to it. Allocation uses
backing width × height × 4 × expected frame count × headroom; no arbitrary small
fixed cap is imposed. WASM32 addressability, allocation failure, backing-size
changes, unreadable pixels, worker errors, and overflow of the bounded three-frame
transfer queue fail explicitly and tear down capture. There is no silent queue
loss. ReadFrame copies pixels into caller-owned bytes, keeping the arena intact.

GIF export uses pinned gif 0.14.1, color_quant 1.1.0, and weezl 0.1.12 compiled
with Rust 1.99.0 to wasm32-unknown-unknown. Conversion samples a shared palette
across output frames, maps RGBA to palette indexes, and writes full-frame GIF89a
images with LZW compression. Cumulative timestamp boundaries round to
centiseconds. Duplicate output selections merge into still holds; long holds
split at the format's delay limit. Opaque backgrounds flatten partial alpha;
transparent export reserves one palette index and restores background between
frames. GIF palette quantization, binary alpha, and temporal resampling are
explicit format losses.

Export options expose dimensions, palette size (including transparency), exact
opaque CSS palette entries, Floyd–Steinberg dithering, NeuQuant sample factor,
and an overall palette pixel sample budget. Dimensions may preserve aspect ratio
when one is omitted; resizing uses pixel-center bilinear interpolation with
premultiplied alpha. Sampling and final mapping use the same resized pixels.
Supplied palettes bypass automatic quantization and match nearest RGB colors.
Automatic and supplied palettes remain shared across all output frames. Dither
errors reset for every frame and do not propagate through transparent pixels.
All controls are export-local and leave retained raw pixels unchanged. Temporary
palette, resize calculation and dither buffers share the existing export cleanup
boundary; no persistent resize surface is acquired.

One export per recording runs at a time. Sampling and frame encoding yield
between bounded worker batches, allowing abort messages to cancel conversion.
Cancellation acknowledgement follows scratch-buffer cleanup, allowing retry
without discarding frames. A single frame's quantization/compression is a
synchronous WASM call; cancellation waits for that call to finish. Progress
callback failure also cancels the export. Worker failures dispose the recording.

Completed recordings own their worker until explicit recording.dispose().
Dispose terminates it, removes handlers, rejects pending reads and exports, and
is idempotent. Worker termination releases its entire WASM instance. The WASM
allocator frees export scratch buffers after success, error, or cancellation;
linear memory's high-water size cannot shrink while the recording is retained.
Applications own returned frame copies, GIF Blobs, and any URLs they create from
those Blobs. Applications must revoke those URLs when no longer displayed.

Generated worker source is a self-contained script string, independent of
application bundler transforms. Generated WASM is source-fingerprinted and
validated during package build; ordinary package builds do not require Rust.
`node tooling/build-recording-wasm.mjs` rebuilds with the pinned toolchain and
locked crates. `node tooling/build-recording-worker.mjs` regenerates the worker.
CSP must allow blob workers. No worker or WASM instance initializes at import;
unused recording code and embedded encoder bytes tree-shake out of ordinary apps.
