---
id: api-function-nearest-domain-value
title: nearestDomainValue
summary: Selects a numeric domain value by distance in mapped range space.
kind: api
slug: nearest-domain-value
apiCategory: function
symbols: [nearestDomainValue]
---

# nearestDomainValue

Import from `@crc/core/viz`. `nearestDomainValue(values, rangeValue, scale)` accepts
plain numeric values and a resolved linear scale. It returns the original value
whose mapped position is closest, or undefined for empty/all-invalid input.
Equal distances choose the earliest source value. No sorting or inversion is
needed, including for collapsed ranges. The query must be finite; invalid source
values are skipped and arithmetic overflow throws. This pure O(n) helper owns
no observers or persistent cache.
