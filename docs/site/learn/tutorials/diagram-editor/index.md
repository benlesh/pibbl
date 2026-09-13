---
id: tutorial-diagram-editor
title: "Learn the basics: Build a diagram editor"
summary: Build a complete Canvas diagram editor in twelve independently runnable, cumulative steps.
kind: tutorial
slug: diagram-editor
tutorial: diagram-editor
keywords: [tutorial, diagram editor, canvas, project]
---

# Learn the basics: Build a diagram editor

## See what you will build

[![A workflow diagram editor with four connected cards, a selected Sketch card, toolbar, and status strip.](/tutorials/diagram-editor/finished-editor.png)](#/learn/tutorials/diagram-editor/finished-editor)

Build a small but real Canvas editor, one visible capability at a time. Every
chapter is complete, editable, resettable, and independently runnable.

**[Start building →](#/learn/tutorials/diagram-editor/canvas-scene)** ·
[Open the finished editor](#/learn/tutorials/diagram-editor/finished-editor)

## Before you start

The default path runs in the Studio, so Chapter 1 starts with a Canvas scene
rather than local setup. When you move the result into a local project, follow
[Configure JSX](#/learn/guides/configure-jsx). [Author without JSX](#/learn/guides/author-without-jsx)
is a separate supported guide; this tutorial uses the automatic CRC JSX runtime.

## Curriculum

1. [Create the Canvas scene](#/learn/tutorials/diagram-editor/canvas-scene) — mount CRC, draw the workspace, and understand the controller, scheduled rendering, and disposal.
2. [Draw the first node](#/learn/tutorials/diagram-editor/first-node) — combine `Rectangle` and `Text` and introduce local style and coordinate geometry.
3. [Connect two nodes](#/learn/tutorials/diagram-editor/connect-nodes) — add a curved path, explain source paint order, and build a recognizable diagram.
4. [Extract a reusable node component](#/learn/tutorials/diagram-editor/reusable-node) — introduce props, children, lists, fragments, and stable keys.
5. [Build the editor chrome](#/learn/tutorials/diagram-editor/editor-chrome) — add toolbar and status regions with CRC layout components and distinguish allocation from drawing geometry.
6. [Select nodes with state](#/learn/tutorials/diagram-editor/selection) — use `crcState`, click targets, visible selection, and frame-coalesced updates.
7. [Drag nodes safely](#/learn/tutorials/diagram-editor/dragging) — use pointer events, pointer capture, event coordinates, and immutable diagram state.
8. [Pan and zoom the workspace](#/learn/tutorials/diagram-editor/pan-and-zoom) — apply `Group` transforms and wheel/pointer input while keeping paint and targeting aligned.
9. [Constrain the viewport](#/learn/tutorials/diagram-editor/viewport-and-layer) — introduce `Clip` and `Layer`, explain their different roles, and preserve interaction order.
10. [Polish selection with filters](#/learn/tutorials/diagram-editor/filters) — add typed shadows or glow, explain filter boundaries and nesting, and handle browser capability requirements.
11. [Add keyboard interaction](#/learn/tutorials/diagram-editor/keyboard-interaction) — introduce focus management, directional navigation, activation, and CRC's accessibility boundary.
12. [Finish and harden the editor](#/learn/tutorials/diagram-editor/finished-editor) — cover memoization, refs and change effects, cleanup ownership, component identity, failure behavior, and practical production patterns.

## How the course works

Every chapter owns a complete snapshot: edits, reset, sharing, and recovery are
scoped to that chapter and do not cross into another one. The editor teaches
moving nodes, not a general diagramming product: creation, deletion,
persistence, and undo are not tutorial features.
