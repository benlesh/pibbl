# IES-05 field note — hardening and trust

Date: 2026-08-12

The automated-test index and detail pages retain all 13 fixture definitions, IDs, actions, state, procedures, limitations, visual evidence, and headless consumers. Source is collapsed by default and opens in a lazy syntax-highlighted read-only editor. Current README, architecture, status, generated catalog, and drawing-contract documentation now describe the learner studio and separate labs.

Five exact, bundled-font, full-page Chromium baselines cover the landing, rectangle primitive, click event, transformed/clipped/layered advanced lesson, and baseline test lab. Each was inspected before adoption. The production-preview comparison immediately matched all five. Manual review also covered 320px reflow, drawer focus/Escape, route focus, reduced motion, live announcements, and absence of Monaco resources from landing/testing-index loads.

The final complete `pnpm trust` run passed catalog validation, typecheck, lint/format, all package builds, source and built playground builds, packed consumers, 36 browser files with 294 passed and two intentional timing skips, deliberate visual-failure/recovery safeguard, built smoke, lifecycle 9/9, and performance 3/3. The final studio visual gate separately matched 5/5 full-page baselines. The local Node 24.12 runtime produced the expected engine warning against the documented Node 24.15 minimum but did not fail a command.
