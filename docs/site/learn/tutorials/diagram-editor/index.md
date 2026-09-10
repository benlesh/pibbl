---
id: tutorial-diagram-editor
title: "Learn the basics: Build a diagram editor"
summary: A forthcoming, cumulative tutorial that builds a complete Canvas diagram editor in independently runnable steps.
kind: tutorial
slug: diagram-editor
tutorial: diagram-editor
keywords: [tutorial, diagram editor, canvas, project]
---

# Learn the basics: Build a diagram editor

This forthcoming tutorial builds a small but real diagram editor: a workspace
with nodes, connections, selection, drag, pan and zoom, filters, and keyboard
interaction. Each future chapter will begin with the prior result while owning
a complete, independently runnable snapshot, so readers can deep-link, reset,
edit, and recover without replaying earlier chapters.

The chapters are not published yet, so this page intentionally does not render
nonfunctional chapter links. In the meantime, start with [Configure JSX](#/learn/guides/configure-jsx)
or [Author without JSX](#/learn/guides/author-without-jsx), then explore the
interactive examples in the Studio.

## Planned curriculum

1. **Create the Canvas scene** — mount CRC, draw the workspace, and understand
   the controller, scheduled rendering, and disposal.
2. **Draw the first node** — combine `Rectangle` and `Text` and introduce
   local style and coordinate geometry.
3. **Connect two nodes** — add `Line` or `Path`, explain source paint order,
   and build a recognizable diagram.
4. **Extract a reusable node component** — introduce props, children, lists,
   fragments, and stable keys.
5. **Build the editor chrome** — add toolbar and status regions with CRC layout
   components and distinguish allocation from drawing geometry.
6. **Select nodes with state** — use `crcState`, click targets, visible
   selection, and frame-coalesced updates.
7. **Drag nodes safely** — use pointer events, pointer capture, event
   coordinates, and immutable diagram state.
8. **Pan and zoom the workspace** — apply `Group` transforms and wheel/pointer
   input while keeping paint and targeting aligned.
9. **Constrain the viewport** — introduce `Clip` and `Layer`, explain their
   different roles, and preserve interaction order.
10. **Polish selection with filters** — add typed shadows or glow, explain
    filter boundaries and nesting, and handle browser capability requirements.
11. **Add keyboard interaction** — introduce focus management, directional
    navigation, activation, and CRC's accessibility boundary.
12. **Finish and harden the editor** — cover relevant memoization, refs and
    change effects, cleanup ownership, component identity, failure behavior,
    and practical production patterns.

When the chapters arrive, every one will include a goal, conceptual
explanation, complete TSX snapshot, editable Canvas workbench, guided exercise,
recap, related API links, and chapter-scoped reset/share behavior.
