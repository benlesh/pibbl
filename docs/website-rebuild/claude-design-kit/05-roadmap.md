# After feedback: prioritized integration roadmap

All three entries below are **unimplemented concepts**. No new public Pibbl API is implied. Begin only after the site organization and native-button recipe receive feedback.

## 1. Plasma around a native HTML form

Keep labels, fields, validation messages, submit handling, and focus entirely native. Add one decorative canvas around the form's perimeter, with `pointer-events: none`. Map explicit form states (idle, focused field, invalid submission, confirmed success) to the visual region.

First proof: one form, one bounded perimeter effect, static CSS fallback, reduced-motion state, resize, and exact cleanup. Investigate the existing public `lightning` texture and working Plasma Globe source for reusable behavior; neither establishes a ready-made form-outline component. Verify parameter and masking contracts before selecting the implementation. Pibbl must not capture or filter the live form.

Assets: none expected for a procedural perimeter. Measure the actual form rectangle and account for error-message growth. Do not place activity behind body copy or validation text. Success animation must follow confirmed host success, never merely a submit click.

## 2. A compelling image reveal

Keep an informative native image/caption and a native range or reveal control. Prove one transition between a useful static image and a Canvas presentation of the same loaded asset. Use the existing Growing Reveal example as a feasibility reference, then check its exact current public APIs before extracting a small recipe.

First proof: one local image, one supported clipping/mask approach, explicit load/decode handling, an error fallback, responsive aspect ratio, and a native control equivalent to any pointer gesture. Test reset, interrupted reveal, and reduced motion. Do not assume any named transition, DOM capture, or arbitrary mask format exists.

Assets: a supplied/licensed image at known dimensions plus meaningful alt text. Use same-origin assets for the first proof. Document CORS requirements if readback/export becomes necessary. Keep the native image visible until the Canvas asset is ready.

## 3. Store hero image rotator with dramatic transitions

Start with two local product images and one proven transition from the image-reveal recipe. Native HTML owns headline, product links, next/previous controls, pause, slide state, and accessible announcements. Pibbl owns only the image transition region.

First proof: deterministic next/previous, explicit pause, loading failure, rapid repeated navigation, resize, reduced motion, and cleanup. Specify whether new navigation finishes, interrupts, or replaces the current transition; test that decision before adding another effect. Keep the selected native product content authoritative when the effect is stopped.

Assets: two genuine product images with agreed aspect ratios, focal points, licensing, alt text, and fallback content. Dramatic transitions must reveal the actual product, not obscure it indefinitely. Autoplay and additional transitions are later decisions, not defaults of this roadmap.
