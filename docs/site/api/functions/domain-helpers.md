---
id: api-function-domain-helpers
title: Domain helpers
summary: Compute a numeric extent and explicitly round a UTC domain.
kind: api
slug: domain-helpers
apiCategory: function
symbols: [extent, niceDomain]
keywords: [visualization, UTC, extent, domain]
---

# Domain helpers

Import `extent` and `niceDomain` from `@crc/viz`.

`extent(data, accessor)` visits each row once in source order. The accessor
receives datum, index, and the input array. Null and undefined are missing;
other non-numbers, NaN, and infinities reject. It returns a frozen numeric
minimum/maximum pair, or undefined when there are no values. Singleton extents
are preserved. It neither mutates nor sorts input data.

`niceDomain(domain, { type: "utc", count?: number })` explicitly chooses UTC
calendar rounding. Count defaults to five and is an integer from 2 through 100.
UTC endpoints must be safe integer milliseconds within the Date range. Direction
is preserved. A singleton expands by one millisecond on either side, or inward
at the Date limits. Arithmetic or outward Date overflow rejects.

Both helpers are pure calls without persistent caches or automatic domain
updates. Signal reads inside an accessor belong to the caller's tracked
evaluation. A retained result is a snapshot; invoke the helper again after its
inputs or dependencies change. Extent is O(n); UTC calendar selection and output
are bounded independently of the number of milliseconds in the domain.
