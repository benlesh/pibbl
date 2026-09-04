# IES-02 field note — editor and isolated runner

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-12

Monaco 0.56 and the TypeScript worker load only on lesson or opened test-source routes. The CRC declaration adapter produced property completions, hover/type information, semantic errors, bracket matching, and JavaScript emission. A deliberate `widtth` property reported the exact `RectProps` diagnostic and retained run 1; the subsequent valid edit replaced it with run 2 and left one frame.

The live frame exposes only `sandbox="allow-scripts"`. Parent DOM access failed at runtime and left the parent unchanged. Message handling validates protocol version, frame source, and exact run ID. Type and syntax failures leave the current frame untouched; successful emission disposes it and creates exactly one replacement frame. Route teardown disposes the controller that owns the current frame. Console output emitted after mount remained visible.

Unicode source round-tripped through the compressed hash route. The first focused test exposed that `+` in an encoded payload was interpreted as a query-space; percent-encoding the compressed payload fixed it. Unsupported, malformed, canonical, and oversized cases now recover deterministically. Copy, reset, share, formatting, debounce, stale compilation, diagnostics, and output controls were exercised in Chromium.
