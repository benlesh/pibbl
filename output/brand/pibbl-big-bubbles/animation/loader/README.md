# Pibbl loading animation · approved release

This is a standalone brand asset, implemented with SVG and a custom element. It is **not a Pibbl example**, does not use the Pibbl runtime, and must stay outside the Pibbl docs, Learn, Examples, Studio catalogs, and API reference. The approved study 08 is the frozen motion reference. The eventual Pibbl renderer is a separate future implementation.

## Use it

Copy this entire `loader` directory to your website; keep its relative module paths intact. Serve over HTTP(S), with `.mjs` served as JavaScript. No packages, font downloads, remote requests, or framework dependencies are needed at runtime. Import once:

```html
<script type="module" src="/assets/pibbl/loader/pibbl-loader.mjs"></script>
<pibbl-loader id="brand-loader" label="Loading your project"></pibbl-loader>
```

```js
await customElements.whenDefined("pibbl-loader");
const loader = document.querySelector("#brand-loader");
loader.ready = true; // or loader.complete()
loader.addEventListener(
  "pibbl-complete",
  () => {
    // Optional: reveal the content after the logo's finish.
  },
  { once: true },
);
```

Listen before setting ready if completion must always be observed, including reduced motion. Do not assign properties before the element is defined; use the HTML attributes during initial rendering instead.

The loader loops indefinitely until told it is ready. It finishes the current encounter at a safe checkpoint, forms the P in 1.6 seconds, releases the bubbles over 0.69 seconds, then holds the completed mark. Calling Ready repeatedly is harmless. The event fires once per run; `restart()` begins a new run. Completion latency is the remainder of the current encounter plus 2.29 seconds. Loading progress is illustrative, not a percentage indicator.

| Control                                 | Behavior                                                        |
| --------------------------------------- | --------------------------------------------------------------- |
| `ready` attribute / boolean property    | Request the finish sequence; removing it alone does not restart |
| `complete()`                            | Same request; resumes a paused animation                        |
| `restart()`                             | Clear ready/paused, reset to the approved beginning             |
| `paused` attribute / boolean property   | Freeze or resume at the same pose                               |
| `pause()` / `resume()`                  | Set or clear paused                                             |
| `phase` getter / `data-phase` attribute | `loading`, `forming`, `bloom`, `complete`                       |
| `label` attribute                       | Accessible image description; default “Pibbl”                   |
| `pibbl-complete` event                  | Bubbles across shadow DOM; fires after a requested finish       |

Set CSS width as needed; default is 320px, aspect ratio 640:450. The background is transparent. It works on white or dark surfaces. Multiple instances have isolated SVG masks and independent playback. Removing the element cancels its frame and preference listener; reinsertion resumes without counting time spent detached. Paused and completed instances stop scheduling frames. Background-tab gaps are clamped to 50ms so motion resumes naturally instead of skipping the acting.

The element respects `prefers-reduced-motion`: it displays the completed still mark immediately, without autoplay. Requesting Ready in that mode still signals completion. Let the application manage `aria-busy` on the content being loaded and announce work status separately; do not announce animation beats. Use a decorative empty wrapper/hidden host when the branding duplicates a nearby accessible label.

## Files and preservation

- `pibbl-loader.mjs`: browser lifecycle, controls, accessibility, scheduling.
- `playback.mjs`: deterministic state machine and bubble sampler; no DOM.
- `motion.mjs` / `collision.mjs`: unchanged approved choreography and geometry.
- `identity.mjs`: bundled snapshot of the approved identity; no fetch needed.
- `svg.mjs`: SVG creation and attribute updates; same renderer used for exports.
- `demo.html`: integration and interactive checks, outside product docs.
- `PIBBL-PORT.md`: geometry, acting, contact rules, timing and migration guidance.
- `*.test.mjs`: focused reproduction and controller checks.
- `export-gif.mjs` / `encode-gif.py`: reproducible offline exports.

Run `node --test *.test.mjs` from this folder. The geometry suites sample 5,001 loop poses and 501 poses per completion checkpoint. They check the floor, contacts, non-overlap, gravity arcs, preparation and exact loop closure. A browser check remains necessary for timing and personality.

## GIFs

`../gif/` contains the 11-second seamless loading loop at 256×180, 512×360 and 1024×720, each on white and dark backgrounds. Two additional 512×360 GIFs show one complete loop, the P assembly, bubble release and hold, then replay. These finish GIFs intentionally reset at replay; use the component for interactive readiness and a permanent final hold.

All GIFs use the same approved samplers, 25 fps / 40ms frames, and a shared palette per export. GIF color limits slightly quantize antialiasing; SVG is the crispest option. Backgrounds are baked in to avoid GIF's binary-transparency halos. Use 512 for general sharing, 256 for small embeds and 1024 for large displays; GIF files can be much larger than the live component. GIFs cannot react to work completion or reduced-motion settings. Provide a still-image fallback or choose the component for UI loading.

Rebuild with Sharp and Pillow available:

```sh
PIBBL_SHARP_PATH=/absolute/path/to/sharp node export-gif.mjs /tmp/pibbl-frames
python3 encode-gif.py /tmp/pibbl-frames
python3 ../../source/pack.py
```
