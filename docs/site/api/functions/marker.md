---
id: api-function-marker
title: marker
summary: Adds a named post-render milestone to an animation program.
kind: api
slug: marker
apiCategory: function
symbols: [marker]
relatedTypes: [PibblAnimationProgram, PibblPlaybackEvent]
---

# marker

`marker(name)` returns a zero-duration program milestone. Playback collects the
marker while sampling and delivers its event in Complete, after committed
values have been planned and rendered.

Related types: [`PibblAnimationProgram`](#/api/types/canvas-runtime#pibblanimationprogram)
and [`PibblPlaybackEvent`](#/api/types/canvas-runtime#pibblplaybackevent).
