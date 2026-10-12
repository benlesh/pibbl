# Three reaction–diffusion models: feedback slice

> **Historical status: Dated verification evidence; current code and fresh checks define shipped behavior.**

Date: 2026-10-12. Node v26.9.0, pnpm 11.21.0, Playwright Chromium.

The approved public APIs are named recipe factories and option types for
Schnakenberg, Barkley and Brusselator, plus each model's immutable preset
collection. Existing useTexture, palette, paint placement and InkMessage remain
the supported composition/interaction surfaces. The explorer contains all six
presets, model parameters, diffusion, initial noise, warmup, speed, palette,
tile size, seed, pause/reset, paint and stir. Model switches use keyed owners.

A periodic five-point Laplacian and stability-limited explicit Euler step evolve
both concentrations. Rasterization duplicates the seam row/column. Brushes and
bilinear stirring wrap both fields. Schnakenberg and Brusselator initialize near
the homogeneous equilibrium; Barkley starts from a broken excitation front.
Presentation uses activator intensity, not automatic per-frame contrast stretching.
Changing chemistry/noise/seed/warmup resets the field. Speed and pause preserve it;
reset reproduces initialization and preserves the current pause state.

Primary equation references:

- [Schnakenberg model and homogeneous state](https://pmc.ncbi.nlm.nih.gov/articles/PMC11246824/).
- [Barkley equations and spiral dynamics](https://pmc.ncbi.nlm.nih.gov/articles/PMC3625403/).
- [Brusselator equations](https://math.nist.gov/MatrixMarket/data/NEP/brussel/brussel.html).
- [Schnakenberg labyrinth regime](https://pmc.ncbi.nlm.nih.gov/articles/PMC8178156/).

Focused public tests failed for the three missing factories before implementation.
Fresh source and built runs of chemical-recipes and chemical-explorer pass: four
tests in each mode. These cover deterministic initialization, both periodic seams,
wrapped painting and stirring, reset, pause, motion, model/preset switches,
chemistry and presentation changes. All six presets have visible spatial variation.
Core build and packed consumer verification pass, including Bundler/NodeNext types
and runtime export parity. Scoped lint and the learning source contract pass.

Full typecheck/public JSDoc checks currently encounter unrelated concurrent
interval-series changes. No aggregate trust result is claimed. This is a
runnable slice; broad numerical/parameter/lifecycle/performance hardening follows
feedback. The first implementation uses CPU buffers rather than adding new WASM
kernels before feedback. Zero noise, stable chemistry or inappropriate diffusion
ratios can legitimately converge to uniform fields.

Browser QA used regular Playwright because the Browser plugin is unavailable.
Desktop screenshots inspect all six presets. Parameter tracks changed the rendered
controls; a separate viewport-aware pass verified tile size, paint, stirring a
painted disturbance, playback, pause and reset with no page/console errors.
The Studio editor reports no TypeScript issues. Mobile width is 390px with no
horizontal overflow. Screenshots are `/tmp/pibbl-chemical-0-default.png`,
`/tmp/pibbl-chemical-0-alternate.png`, equivalent model 1/2 captures, and
`/tmp/pibbl-chemical-mobile.png`. Stir checks explicitly scroll the target into
the viewport; an earlier raw-coordinate attempt fell below the browser window.
The public recipe checks also verify stir changes and speed-zero preservation.
