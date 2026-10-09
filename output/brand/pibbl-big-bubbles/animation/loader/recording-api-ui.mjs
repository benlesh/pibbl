import { recordFrames, exportGif } from "@pibbl/core";

/** Private integration example: any mounted Pibbl canvas works as the target. */
export function attachRecordingAPIUI(canvas) {
  const section = document.createElement("section");
  section.innerHTML = `<h2>Public recording API · GIF export</h2>
    <p>Capture committed Pibbl frames. Stop keeps the captured portion; discard releases everything.</p>
    <button data-record="start">Record 11 seconds</button>
    <button data-record="stop">Stop and make GIF</button>
    <button data-record="discard">Discard recording / cancel export</button>
    <label>GIF background <select data-record="background"><option value="#ffffff">White</option><option value="#141820">Dark</option><option value="">Transparent</option></select></label>
    <fieldset><legend>GIF export settings</legend>
    <label>Frames/sec <input data-record="fps" type="number" min="1" max="100" value="25" style="width:5em"></label>
    <label>Width <input data-record="width" type="number" min="1" max="65535" placeholder="Auto" style="width:6em"></label>
    <label>Height <input data-record="height" type="number" min="1" max="65535" placeholder="Auto" style="width:6em"></label>
    <label>Max colors <input data-record="colors" type="number" min="2" max="256" value="256" style="width:5em"></label>
    <label><input data-record="dithering" type="checkbox"> Dithering</label>
    <label>Quantizer sample factor <input data-record="factor" type="number" min="1" max="30" value="10" style="width:5em"></label>
    <label>Palette pixel samples <input data-record="samples" type="number" min="1" max="16777216" value="262144" style="width:8em"></label>
    <label>Exact palette (optional; separate opaque CSS colors with semicolons) <input data-record="palette" placeholder="#FF735E; #159447; #8B5CCB; white" style="width:100%"></label>
    <p>Factor 1 spends most quantization effort; 30 is fastest. Supplying a palette replaces automatic sampling. One dimension preserves aspect ratio.</p>
    </fieldset>
    <p data-record="status">Ready to record.</p>
    <img data-record="preview" alt="Recorded Pibbl application" style="max-width:640px;width:100%" hidden>
    <a data-record="download" hidden download="pibbl-recording.gif">Download GIF</a>`;
  document.body.append(section);
  const find = (name) => section.querySelector(`[data-record="${name}"]`);
  let session,
    retained,
    abort,
    url,
    generation = 0,
    disposed = false;
  const status = (text) => {
    find("status").textContent = text;
  };
  function release() {
    generation++;
    session?.cancel();
    session = undefined;
    abort?.abort();
    abort = undefined;
    retained?.dispose();
    retained = undefined;
    if (url) URL.revokeObjectURL(url);
    url = undefined;
    find("preview").removeAttribute("src");
    find("preview").hidden = true;
    find("download").removeAttribute("href");
    find("download").hidden = true;
  }
  async function start() {
    if (disposed) return;
    release();
    const current = generation;
    abort = new AbortController();
    session = recordFrames(canvas, {
      duration: 11_000,
      frameRate: 60,
      signal: abort.signal,
    });
    status("Preparing capture…");
    try {
      await session.ready;
      if (current !== generation) return;
      status("Recording… stop to export the captured portion, or discard.");
      const recording = await session.finished;
      if (current !== generation) {
        recording.dispose();
        return;
      }
      retained = recording;
      session = undefined;
      status(
        `Captured ${recording.frames.length} frames across ${(recording.duration / 1000).toFixed(2)} seconds. Encoding…`,
      );
      const gif = await exportGif(recording, {
        frameRate: Number(find("fps").value),
        width: find("width").value ? Number(find("width").value) : undefined,
        height: find("height").value ? Number(find("height").value) : undefined,
        maxColors: Number(find("colors").value),
        dithering: find("dithering").checked,
        quantizationSampleFactor: Number(find("factor").value),
        paletteSampleCount: Number(find("samples").value),
        palette: find("palette").value.trim()
          ? find("palette")
              .value.split(";")
              .map((color) => color.trim())
          : undefined,
        repeatCount: 0,
        background: find("background").value || undefined,
        signal: abort.signal,
        onProgress: (value) =>
          status(`Encoding GIF… ${Math.round(value * 100)}%`),
      });
      recording.dispose();
      retained = undefined;
      if (current !== generation) return;
      url = URL.createObjectURL(gif);
      find("preview").src = url;
      find("preview").hidden = false;
      find("download").href = url;
      find("download").hidden = false;
      abort = undefined;
      status(
        `GIF ready · ${(gif.size / 1024).toFixed(1)} KiB · ${recording.frames.length} captured frames. Stored raw frames and worker released.`,
      );
    } catch (error) {
      if (current !== generation) return;
      release();
      status(
        error.name === "AbortError"
          ? "Discarded; capture and export resources released."
          : error.message,
      );
    }
  }
  find("start").onclick = start;
  find("stop").onclick = () => session?.stop();
  find("discard").onclick = () => {
    release();
    status("Discarded; capture and export resources released.");
  };
  return {
    start,
    stop: () => session?.stop(),
    discard: () => {
      release();
      status("Discarded; capture and export resources released.");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      for (const name of ["start", "stop", "discard"])
        find(name).onclick = null;
      section.remove();
    },
  };
}
