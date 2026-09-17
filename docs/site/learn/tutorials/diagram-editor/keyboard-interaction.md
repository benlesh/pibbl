---
id: tutorial-diagram-editor-keyboard-interaction
title: Add keyboard interaction
summary: Traverse explicit Canvas targets, render focus-visible state, and activate the same model actions from the keyboard.
kind: tutorial
slug: keyboard-interaction
tutorial: diagram-editor
order: 11
keywords: [diagram editor, tutorial, keyboard, focus, pointer capture]
exampleSlug: diagram-editor-keyboard-interaction
---

# Add keyboard interaction

## What you will make

Make every workflow card and the Reset view control available to a keyboard user. Tab reaches controls in source order, arrows choose nearby cards, and Enter or Space runs the same action as a click.

## How it works

[Focus management](#/api/components/focus-management) keeps the HTML Canvas as the one native focus host, then tracks one explicit logical target inside it. A [keyboard-navigation](#/api/components/keyboard-navigation) boundary adds directional movement only for targets with finite bounds. This is logical interaction, not a generated semantic tree.

## Build the change

Each `NodeCard` registers one custom target with [useEventTarget](#/api/hooks/use-event-target). Its rounded hit path comes from [useRectPath](#/api/hooks/use-rect-path), and the same registration owns click, pointer capture, focus, and navigation geometry. Every rectangle, label, and port is decorative `pointerEvents="none"`, so the card has one conceptual target instead of competing paint leaves.

The target snapshot supplies `isFocused` and `isFocusVisible`. Paint a high-contrast paper ring plus an ink inner stroke only when focus arrived by keyboard. [Event types](#/api/types/events) describe the common pointer and keyboard event facades.

## Predict and try

Move `Idea` after `Sketch` in the source array. Predict that Tab order changes because it follows source traversal, while ArrowUp still chooses a geometric neighbor. Restore the original order before moving on.

## Check your result

Tab enters Reset view, then Idea. Enter selects Idea; ArrowUp then Enter selects Sketch. Shift+Tab walks back through the same order, and Shift+Tab at Reset exits naturally to the surrounding document instead of wrapping. Pointer activation focuses a target without turning on the keyboard-only ring.

## What you learned

Explicit targets make Canvas keyboard behavior precise without inventing controls. The Canvas exposes no node names, roles, relationships, or screen-reader tree. A production editor needs an application-owned, synchronized semantic node-and-relationship representation with equivalent selection, traversal, activation, editing, and relationship operations. Route that surface through the same model commands: a second keyboard path that evolves separately can diverge and report or perform different actions. See [Focus and keyboard navigation](#/learn/guides/focus-and-keyboard) for the complete policy contract.
