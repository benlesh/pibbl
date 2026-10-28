---
id: api-function-fit-content
title: fitContent
summary: Creates an immutable bound for intrinsic width allocation.
kind: api
slug: fit-content
apiCategory: function
symbols: [fitContent]
relatedTypes: [FitContent, SizingLength]
---

# fitContent

```ts
import { fitContent } from "@pibbl/core";
const basis = fitContent(80);
```

`fitContent(limit)` returns a frozen, branded [`FitContent`](#/api/types/layout#fitcontent)
value used by [`SizingLength`](#/api/types/layout#sizinglength). The limit is a finite nonnegative number or percentage of the finite parent
main axis. The selected content width is
`min(maxContent.width, max(minContent.width, limit))`; min-content may exceed the
limit. Explicit numeric maximum bounds remain hard clamps during allocation.

In the experimental layout build, direct paired-measurable children of finite
horizontal nowrap Flex owners, and built-in Canvas Text in those owners, can use this value as `width` or `flexBasis`.
A non-auto flex basis takes precedence over width. Existing growth, shrinkage and
numeric bounds apply after the intrinsic basis is selected. Final cross size uses
measurement at the allocated width, rather than a paired intrinsic height.

Text derives min-content from its existing space-separated word policy when wrapping, and max-content from its natural Canvas run. Unwrapped runs retain leading spaces and have equal min/max contributions. Final line height is measured at the allocated width.

Intrinsic values require an admitted measuring owner. Other owners, vertical
intrinsic sizing, `stretch`, and intrinsic min/max bounds are not implemented by
the current owner and raise structured layout diagnostics. Padding, positions and
gaps still use scalar [`Length`](#/api/types/layout#length).

Border-box intrinsic requests retain the same content limit. Padding and layout
borders are added once after the content contribution is selected; numeric
`minWidth`/`maxWidth` still describe outer bounds. For example, limit80 with16px
of horizontal insets and `maxWidth: 90` yields74px content and90px outer width.
Limit60 yields60px content and76px outer width. A limit below min-content cannot
remove the content floor. Intrinsic height and intrinsic bounds remain unsupported.
