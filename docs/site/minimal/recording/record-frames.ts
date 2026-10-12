import {
  createElement,
  pibbl,
  Rectangle,
  signal,
  recordFrames,
  exportGif,
  type PibblFrameRecordingOptions,
  type PibblFrameRecordingSession,
  type PibblFrameRecording,
  type PibblRecordedFrameInfo,
  type PibblRecordedFrame,
  type PibblGifExportOptions,
} from "@pibbl/core";

const canvas = document.createElement("canvas");
canvas.style.cssText = "width:240px;height:160px";
const button = document.createElement("button");
button.textContent = "Record a color change";
const status = document.createElement("p");
const preview = document.createElement("img");
preview.alt = "GIF of the captured color change";
document.body.append(canvas, button, status, preview);
const fill = signal("#159447");
const root = pibbl(
  canvas,
  createElement(Rectangle, { style: { width: 240, height: 160, fill } }),
  { viewport: { width: 240, height: 160 }, pixelRatio: 1 },
);
const options: PibblFrameRecordingOptions = { duration: 1000, frameRate: 30 };
const gifOptions: PibblGifExportOptions = {
  width: 240,
  frameRate: 25,
  background: "white",
  repeatCount: 0,
};
let session: PibblFrameRecordingSession | undefined;
let retained: PibblFrameRecording | undefined;
let url: string | undefined;
let changeTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
button.onclick = async () => {
  button.disabled = true;
  if (url) URL.revokeObjectURL(url);
  fill.set("#159447");
  try {
    session = recordFrames(canvas, options);
    await session.ready;
    status.textContent = "Recording successful renders…";
    changeTimer = setTimeout(() => fill.set("#FF735E"), 300);
    retained = await session.finished;
    const metadata: readonly PibblRecordedFrameInfo[] = retained.frames;
    const first: PibblRecordedFrame = await retained.readFrame(0);
    const gif = await exportGif(retained, gifOptions);
    if (disposed) return;
    url = URL.createObjectURL(gif);
    preview.src = url;
    status.textContent = `${metadata.length} captured frames; ${first.width}×${first.height}; ${retained.duration} ms`;
  } catch (error) {
    if (!disposed) status.textContent = String(error);
  } finally {
    if (changeTimer) clearTimeout(changeTimer);
    retained?.dispose();
    retained = undefined;
    session = undefined;
    button.disabled = false;
  }
};
window.addEventListener(
  "pagehide",
  () => {
    disposed = true;
    if (changeTimer) clearTimeout(changeTimer);
    session?.cancel();
    retained?.dispose();
    if (url) URL.revokeObjectURL(url);
    root.dispose();
  },
  { once: true },
);
