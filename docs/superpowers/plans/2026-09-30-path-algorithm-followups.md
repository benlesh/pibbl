# Path algorithm follow-ups — 2026-09-30

## Objective

Complete the closed-contour simplification fix, evaluate and implement useful
algorithm alternatives, and expose independently tree-shakable functions with
editable Playground controls. Deliver separate commits and merge/push main.

## Work and acceptance evidence

1. Correctness: reproduce duplicate-leading-vertex and tolerance failures in
   closed simplification through the public API; retain closure, input ownership,
   endpoints, and at least three distinct vertices where required.
2. Algorithms: implement bounded Wang flattening and budgeted radial-plus-DP
   simplification in independent modules. Compare latency and output counts with
   conservative defaults on deterministic workloads. Assess direct subdivision
   against de Casteljau before deciding whether another public helper is useful.
   Do not weaken tolerance or claim global speed superiority.
3. Integration: root exports, declarations, Bundler/NodeNext and packed consumers,
   source/built/packed tree-shaking evidence, API documentation, and separately
   selectable editable Playground operations.
4. Validation: focused failing tests before fixes/features; browser-visible slice;
   accuracy/degeneracy/contour/output-limit hardening; final repository trust gate.
5. Delivery: individual commits for correctness, algorithms, integration and any
   necessary hardening; merge verified changes to main and verify origin/main.

## Roles

The correctness agent owns the existing simplifier and its focused tests. The
algorithm agent owns new algorithm modules, tests and comparative measurements.
The primary agent owns public/package integration, tree-shaking verification,
Playground, documentation, final review, aggregate verification and delivery.

## Decision policy

Keep adaptive flattening and Douglas–Peucker as defaults until equivalent-contract
measurements justify a change. Expose algorithms as separate functions, not a
runtime dispatcher. Keep de Casteljau unless another subdivision implementation
shows a useful performance/numerical tradeoff for quadratic and cubic curves.
Analytic approximate flattening, area-based simplification, topology preservation,
and arc-length resampling have different guarantees; document disposition rather
than silently adding them under distance-tolerance options.
