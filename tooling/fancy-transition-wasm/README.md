# Embers and Hologram WASM comparison

Run from the repository root with installed dependencies and Playwright Chromium:

```sh
node tooling/build-transition-wasm.mjs --check
node tooling/fancy-transition-wasm/run.mjs
```

`reference-embers.txt` and `reference-hologram.txt` preserve the pre-WASM rendering
implementations. The harness compares those with the current production public
factories. Generated bundles go to a system temporary directory; the raw result
is written to `results.json`. Production stays on WASM; the references are used
only by this experiment.

## Coverage

One 400×320 Canvas at DPR 1, seed 9, 240×160 subject, wind -65, 300 ms particle
tail, and 400 ms material duration. A 95-frame timeline covers exit, reversal
partway through exit, materialization, another exit, and trailing particles.

The first trial records geometry commands and compares every channel of all 95
rendered frames for each effect. It rejects geometry differences above 1e-5 or
channel differences above 2; observed results were substantially tighter. Three
further trials alternate JS/WASM order and measure timeline frames 3–69 (including
settled intervals). Instrumented parity trials are excluded from timing.

Submission measurements include the scheduler and Canvas commands. Synchronized
measurements also read the full Canvas to force completion. This readback is
benchmark instrumentation, not production behavior. Headless Chromium graphics
and readback affect absolute numbers; these are not display-refresh FPS, a mobile
benchmark, or proof of a CPU, power, or battery improvement.

## Observed results — October 4, 2026

macOS arm64, Node 26.9.0, Chromium 151.0.7922.34:

| Effect   | JS synchronized median | WASM synchronized median | Pixel differences |
| -------- | ---------------------: | -----------------------: | ----------------: |
| Embers   |                34.9 ms |                  34.8 ms |  0 over 95 frames |
| Hologram |                 1.9 ms |                   1.8 ms |  0 over 95 frames |

Maximum geometry differences: Embers below 3.9e-9; Hologram below 5.8e-10.
These small timing differences do not establish a reliable whole-frame speedup.
Per the user's preference, WASM owns these calculations independently of future
Canvas rendering improvements.

## Production boundaries

- Embers computes its continuous contour, 180 coals, and 240 particle descriptors
  in WASM. A first batched call emits birth times; JavaScript resolves the existing
  controller history into the input buffer; a second call computes geometry.
  This preserves reversal and particle-tail behavior without calling JS from
  every individual numerical operation.
- Hologram computes glitch strips, ray intensity, and fog patches in one WASM call.
- Each used definition lazily owns one fixed 64 KiB page and reusable views. Module
  compilation is shared per kernel. Definitions and imports allocate no WASM
  instance until animated use. There is no extra scheduler or network fetch.
- Canvas capture, tint, clipping, gradients, blur, and compositing remain unchanged
  JavaScript. The build checks embedded bytes against AssemblyScript source.
- Embers' kernel is 3,147 bytes and Hologram's is 10,378 bytes before base64
  embedding/compression. Hologram includes its power-function implementation.

The public regression suite additionally checks lazy initialization/reuse,
completion, disposal, nested composition, zero duration, history, and reversals.

## Later visual revision

Embers now uses 1,200 particle slots and brighter, continuously cooling fragments,
with 128 KiB fixed memory. The recorded comparison above describes the pre-density revision. The JavaScript
reference now includes the same visual changes so the harness can compare the
revised implementations on its next run. Do not treat the recorded timings as
measurements of the denser effect. Current behavior is covered by the public
transition tests and `embers-density.test.ts`.
