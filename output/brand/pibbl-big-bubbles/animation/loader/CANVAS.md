# Private Pibbl Canvas loader

The Canvas renderer lives alongside the approved SVG custom element. Both share
`motion.mjs`, `collision.mjs`, `identity.mjs` and `playback.mjs` unchanged. This
asset stays outside product documentation, examples and catalogs. The original
README and PIBBL-PORT describe the SVG delivery and pre-port handoff; this
companion records the new Canvas implementation without rewriting them.

## Integration

Use a bundler with the current `@pibbl/core` package. Include
`canvas-loader.mjs`, `canvas-score.mjs` and their four shared source modules;
keep relative imports intact. `canvas-loader.d.mts` supplies TypeScript types.
The existing SVG element remains available independently.

```html
<canvas
  id="brand"
  width="640"
  height="450"
  role="img"
  aria-label="Pibbl"
></canvas>
<style>
  #brand {
    display: block;
    width: min(100%, 320px);
    height: auto;
    aspect-ratio: 640 / 450;
  }
</style>
```

```js
import { mountLogoLoader } from "./canvas-loader.mjs";

const loader = mountLogoLoader(document.querySelector("#brand"), {
  onComplete() {
    revealApplication();
  },
});

loader.complete(); // Ready: finish the encounter, form the P, release bubbles.
loader.pause();
loader.resume();
loader.restart(); // New run; permits another completion notification.
// When this view goes away:
loader.dispose(); // Idempotent; releases root, playback and preference listener.
```

Listen through `onComplete` before requesting completion. It fires once per
requested run, including reduced motion. Repeated Ready resumes a paused finish
without restarting it. `phase` is `loading`, `forming`, `bloom` or `complete`;
`frame` is the last committed pose. Controls enter Pibbl's scheduled lifecycle,
so read resulting state after the next frame. `seek(milliseconds)` inspects the
current loop or finish program; pause before seeking for a stable inspection.
Seeking to the end of a requested finish also notifies completion.

The root uses a fixed logical 640×450 viewport, contain fitting and live device
pixel ratio. CSS controls its display size. `pixelRatio` may override device
tracking. No background paint is added. Set the canvas or parent background as
needed. The invisible floor remains y=390.

`mountLogoLoader` tracks reduced-motion preferences. Reduced motion shows the
exact completed still without scheduling playback. Ready still notifies, and
restart allows the next explicit completion. A live preference change remounts
the private loader; returning to motion starts a fresh loop, or a fresh finish
if Ready was requested. Explicit `reducedMotion: true` or `false` fixes the
choice for that mount. The application owns its loading announcements and
`aria-busy`; use `aria-hidden="true"` for decorative duplicate branding.

For composition within an existing Pibbl scene, call `createLogoLoader(options)`
and mount `createElement(Component, {})`; retain its `controls`. Create a fresh
factory result for each mounted component. Unmounting the component/root owns
playback teardown. Set `reducedMotion` from your application's preference state
in this form. `canvas-usage.mts` contains both typed integration alternatives.
`PibblLogoFrame` is the reusable static frame primitive, useful for deterministic
inspection or externally supplied approved poses. Wrap it in ordinary Pibbl
composition as needed.

`onFrame(frame)` is an observational callback used by the comparison preview.
It runs through a Pibbl reaction after painting; defer signal writes from this
callback to a microtask. Normal completion callbacks run outside that reaction's
write guard.

## Comparison and checks

From the repository root:

```sh
node_modules/.bin/vite --config output/brand/pibbl-big-bubbles/animation/loader/canvas-vite.config.mjs
```

Open <http://127.0.0.1:8766/canvas-comparison.html>. Pause and drag the timeline;
Ready switches seeking to the finish program. Both panes use the same
Pibbl-owned clock; the left pane renders the unchanged approved SVG sampler.
The original independently scheduled SVG demonstration remains at
<http://127.0.0.1:8765/pibbl-big-bubbles/animation/loader/demo.html?v=final>.

Useful loop times in milliseconds: 800 invitation end; 1200 airborne green;
1800 dock; 2500–3200 magnetic ride; 3900 push-off; 4200 clockwise flight;
4500–5100 ramp slide; 5600 fall-flat; 5900/6250 contagious laughter;
6800–7200 pause; 7200–8000 escalating hops; 8550 airborne coral;
9100–9500 pyramid catch; 9500–11000 gentle return and rest.

```sh
node --test output/brand/pibbl-big-bubbles/animation/loader/*.test.mjs
node output/brand/pibbl-big-bubbles/animation/loader/canvas-browser-check.mjs
node_modules/.bin/tsc --ignoreConfig --noEmit --strict --module NodeNext --moduleResolution NodeNext --target ES2022 --skipLibCheck output/brand/pibbl-big-bubbles/animation/loader/canvas-usage.mts
```

The browser check requires the preview server and installed Playwright Chromium.
`PIBBL_LOADER_URL` can select another served comparison URL. It exercises public
APIs, native transforms, violet-only clipping, controls, independent roots,
observer/listener teardown, reduced motion, mobile DPR 1/2/3, backgrounds and
normal-speed playback. It compares 104 approved poses against rasterized SVG,
including every completion checkpoint, with native edge antialiasing tolerance.
The existing geometry tests still check 5,001 loop poses and 501 samples per
completion checkpoint.

## Rendering differences

Canvas and SVG have small browser-owned edge antialiasing differences. The
clip-based violet holes retain the approved geometry and palette; they cannot
erase earlier paint or substitute a background color. Native Canvas transforms
agree with `worldPoint()` within 0.00001 logical units in the nonuniform-scale
probe; the tolerance accommodates native transform numeric precision.

Pibbl's seekable animations follow logical elapsed time, including dropped
frames. The independent SVG element clamps elapsed display gaps to 50ms.
Consequently background-tab recovery can differ; there is no second scheduler
or copied SVG frame loop in this port. At uninterrupted normal speed, both use
11 seconds, 1,600ms formation and the same 450ms/30ms bubble sampler. The shared
comparison clock isolates renderer fidelity from that scheduling difference.

The same browser checks also passed against the existing built public package
entry on port 8767 (`--mode built --port 8767`). An esbuild bundle through
`@pibbl/core` succeeded at 445.6 KiB unminified; this includes the runtime.

Fresh verification on October 8, 2026: Node 26.9.0, TypeScript 7.0.2,
pnpm 11.21.0 and Playwright 1.62.1 Chromium; 12 Node tests passed. The typed usage example passed both NodeNext and Bundler
resolution checks; new JavaScript passed ESLint and all new files passed
Prettier. Browser evidence compared 104 frames,
with a maximum of 295 differing pixels out of 288,000 and zero solid-interior
color differences at the documented channel tolerance. Focused checks cover
this private asset; the repository aggregate trust gate was not run. Node 24
LTS, Firefox and Safari were not verified in this run.
