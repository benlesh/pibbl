export function attachRecordingUI({ benchmark, loader, isolated }) {
  const section = document.createElement("section");
  section.innerHTML = `<h2>Pixel recording benchmark · ${isolated ? "Canvas only" : "Canvas + SVG + UI"}</h2>
 <p>Measures actual backing pixels. The worker stores raw RGBA in real WASM memory; no GIF/ZIP encoding yet. Queue: three frames. Storage is estimated from backing size × duration × measured render rate, plus 15% headroom and one input frame. All timings are milliseconds. Keep this tab visible and dimensions stable.</p>
 <label>Duration <select id="record-duration"><option value="3000">3 seconds</option><option value="11000">11 seconds</option></select></label>
 <label>Capture <select id="record-rate"><option value="0">Every render</option><option value="30">At most 30 fps</option><option value="25">At most 25 fps</option></select></label>
 <label>Headroom <input id="record-headroom" type="number" min="1" step="0.05" value="1.15" style="width:70px"></label>
 <button id="record-baseline">Baseline</button><button id="record-readback">Read pixels</button><button id="record-transfer">Transfer to worker</button><button id="record-wasm">Record in WASM</button><button id="record-stop">Stop</button>
 <a href="?isolation=1">Isolated Canvas</a> · <a href="canvas-comparison.html">Comparison workload</a>
 <p id="record-status">Idle</p><div style="overflow:auto"><table id="record-results"><thead><tr><th>Path</th><th>Pixels</th><th>Render interval p95</th><th>Read p95</th><th>Dispatch p95</th><th>Round trip p95</th><th>WASM copy / store p95</th><th>Frames stored</th><th>MiB stored</th><th>MiB estimated</th><th>Drops / full</th></tr></thead><tbody></tbody></table></div><button id="record-download">Download results JSON</button>`;
  document.body.append(section);
  const results = [];
  const status = (text) =>
    (section.querySelector("#record-status").textContent = text);
  const result = (value) => {
    value.workload = isolated ? "isolated" : "comparison";
    value.environment = {
      userAgent: navigator.userAgent,
      dpr: devicePixelRatio,
      visibility: document.visibilityState,
    };
    results.push(value);
    const row = document.createElement("tr"),
      f = (n) => n.toFixed(2);
    [
      value.mode,
      `${value.width}×${value.height}`,
      f(value.intervalMs.p95),
      f(value.readbackMs.p95),
      f(value.dispatchMs.p95),
      f(value.roundTripMs.p95),
      `${f(value.wasmInputCopyMs.p95)} / ${f(value.wasmStoreMs.p95)}`,
      value.storedFrames,
      f(value.storedBytes / 1048576),
      f(value.budget.allocatedBytes / 1048576),
      `${value.dropped} / ${value.storageFull}`,
    ].forEach((text) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      row.append(cell);
    });
    section.querySelector("tbody").append(row);
    if (value.storageFull)
      status(
        "Estimated frame capacity exceeded: this run does not measure sustained WASM recording. Shorten duration or reduce capture rate/resolution.",
      );
  };
  let starting = false,
    startGeneration = 0;
  const start = async (mode) => {
    if (benchmark.active || starting) return;
    starting = true;
    const generation = ++startGeneration;
    try {
      loader.restart();
      await new Promise((r) => setTimeout(r, 500));
      if (generation !== startGeneration) return;
      await benchmark.start({
        mode,
        duration: Number(section.querySelector("#record-duration").value),
        maxFps: Number(section.querySelector("#record-rate").value),
        headroom: Number(section.querySelector("#record-headroom").value),
      });
    } finally {
      starting = false;
    }
  };
  for (const mode of ["baseline", "readback", "transfer", "wasm"])
    section.querySelector("#record-" + mode).onclick = () =>
      start(mode).catch((e) => status(e.message));
  section.querySelector("#record-stop").onclick = () => {
    startGeneration++;
    benchmark.cancel();
  };
  section.querySelector("#record-download").onclick = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(results, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "pibbl-recording-benchmark.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return { status, result, results, start };
}
