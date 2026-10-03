# 2026-10-03 current-main performance and memory audit

This is a fresh, descriptive audit of current committed main
`690bb10a99246b6f5f57df9b0341774209905827`, not a remediation plan or a
performance gate.

`tooling/performance-audit/run-browser.mjs` uses mounted public
`@crc/core`/`@crc/textures` APIs with private manual-scheduler and passive
instrumentation seams only for ownership attribution. It writes one bounded
JSON result per invocation and closes its browser in `finally`.

Run only in a reserved timing slot against a source-mode Vite server for this
checkout:

```sh
fnm exec --using=24.15.0 node tooling/performance-audit/run-browser.mjs \
  --base-url http://127.0.0.1:5204 --cycles 100 --frames 300
```

Use `--extended` for 1,000 lifecycle cycles and longer deterministic frame
workloads. Reports distinguish explicit zero-dimension release counters from
weak-reachability observations; neither proves browser native or GPU memory
reclamation.
