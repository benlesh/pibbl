# IES-03 field note — drawing and composition lessons

> **Historical status: COMPLETED FIELD RECORD.** Results are dated evidence and are not current API guidance or current test totals.

Date: 2026-08-12

Eleven focused sources now teach Rectangle, Path, SVG path, Line, Horizontal line, Vertical line, Text, Image, Group, Clip, and Layer. Every file imports only `@crc/core`, exports the canonical `mount(canvas)` contract, contains exactly one lesson scene, and is loaded from the same catalog path by the studio and browser tests.

The catalog test asserts the exact eleven-export set. Each source loaded, mounted, painted nontransparent pixels, and tolerated repeated controller disposal. The rectangle page was reviewed at desktop and narrow widths with the live Canvas as the primary focal point, readable highlighted code, concise objectives/prompts/API notes, and previous/next navigation.
