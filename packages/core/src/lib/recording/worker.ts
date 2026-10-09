/** Self-contained worker entry; serialized so published packages need no bundler worker plugin. */
export function recordingWorker(): void {
  const scope = globalThis as any;
  let wasm: any;
  let frameBytes = 0;
  let offset = 0;
  let frames: { offset: number; timestamp: number }[] = [];
  let encoding: { id: number; cancelled: boolean } | undefined;
  const post = (data: any, transfer: Transferable[] = []) =>
    scope.postMessage(data, transfer);
  const yieldTask = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));
  const failure = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
  async function encode(data: any): Promise<void> {
    if (encoding) {
      post({
        type: "error",
        id: data.id,
        message: "A GIF export is already running.",
      });
      return;
    }
    const job = { id: data.id, cancelled: false };
    encoding = job;
    try {
      const timeline: { index: number; end: number }[] = [];
      let index = 0;
      const ticks = Math.max(1, Math.round(data.duration / 10));
      for (
        let time = 0;
        time < Math.max(data.duration, 1);
        time += 1000 / data.frameRate
      ) {
        while (index + 1 < frames.length && frames[index + 1].timestamp <= time)
          index++;
        const end = Math.min(
          ticks,
          Math.max(
            1,
            Math.round(
              Math.min(data.duration, time + 1000 / data.frameRate) / 10,
            ),
          ),
        );
        if (timeline.at(-1)?.index === index) timeline.at(-1)!.end = end;
        else timeline.push({ index, end });
      }
      timeline.at(-1)!.end = ticks;
      const unique = [...new Set(timeline.map((frame) => frame.index))];
      if (data.palette.length) {
        const pointer = wasm.palette_allocate(data.palette.length);
        new Uint8Array(wasm.memory.buffer, pointer, data.palette.length).set(
          data.palette,
        );
      } else {
        const sampleCount = Math.min(
          32,
          unique.length,
          data.paletteSampleCount,
        );
        const perFrame = Math.max(
          1,
          Math.floor(data.paletteSampleCount / sampleCount),
        );
        for (let i = 0; i < sampleCount; i++) {
          const sample = unique[Math.floor((i * unique.length) / sampleCount)];
          wasm.sample_frame(
            frames[sample].offset,
            data.sourceWidth,
            data.sourceHeight,
            data.width,
            data.height,
            Math.max(1, Math.ceil((data.width * data.height) / perFrame)),
            data.background,
          );
          await yieldTask();
          if (job.cancelled) return;
        }
      }
      if (
        !wasm.gif_begin(
          data.width,
          data.height,
          data.repeatCount,
          data.background,
          data.sourceWidth,
          data.sourceHeight,
          data.maxColors,
          data.quantizationSampleFactor,
          Number(data.dithering),
        )
      )
        throw new Error("GIF initialization failed.");
      let previous = 0;
      for (let i = 0; i < timeline.length; i++) {
        let delay = timeline[i].end - previous;
        previous = timeline[i].end;
        while (delay > 0) {
          const chunk = Math.min(delay, 65535);
          if (!wasm.gif_frame(frames[timeline[i].index].offset, chunk))
            throw new Error("GIF encoding failed.");
          delay -= chunk;
          await yieldTask();
          if (job.cancelled) return;
        }
        post({
          type: "progress",
          id: data.id,
          progress: (i + 1) / timeline.length,
        });
      }
      const size = wasm.gif_end();
      if (!size) throw new Error("GIF finalization failed.");
      const bytes = new Uint8Array(
        wasm.memory.buffer,
        wasm.output_base(),
        size,
      ).slice();
      post({ type: "result", id: data.id, buffer: bytes.buffer }, [
        bytes.buffer,
      ]);
    } catch (error) {
      post({ type: "error", id: data.id, message: failure(error) });
    } finally {
      wasm.gif_clear();
      encoding = undefined;
      post({ type: "exportReleased", id: data.id });
    }
  }
  scope.onmessage = async ({ data }: any) => {
    try {
      if (data.type === "start") {
        const result = await WebAssembly.instantiate(data.bytes, {});
        wasm = result.instance.exports;
        frameBytes = data.frameBytes;
        if (!wasm.initialize(data.estimatedBytes))
          throw new Error("Unable to allocate recording memory.");
        post({ type: "ready" });
      } else if (data.type === "frame") {
        if (data.buffer.byteLength !== frameBytes)
          throw new Error("Unexpected recording frame dimensions.");
        const pointer = wasm.append_frame(frameBytes);
        if (!pointer) throw new Error("Unable to grow recording memory.");
        new Uint8Array(wasm.memory.buffer, pointer, frameBytes).set(
          new Uint8Array(data.buffer),
        );
        frames.push({ offset, timestamp: data.timestamp });
        offset += frameBytes;
        post({ type: "ack" });
      } else if (data.type === "finish") {
        post({ type: "finished" });
      } else if (data.type === "read") {
        const info = frames[data.index];
        if (!info) throw new Error("Frame index is out of range.");
        const bytes = new Uint8Array(
          wasm.memory.buffer,
          wasm.store_base() + info.offset,
          frameBytes,
        ).slice();
        post({ type: "result", id: data.id, buffer: bytes.buffer }, [
          bytes.buffer,
        ]);
      } else if (data.type === "gif") {
        void encode(data);
      } else if (data.type === "cancelExport") {
        if (encoding && encoding.id === data.id) encoding.cancelled = true;
      }
    } catch (error) {
      post({ type: "fatal", message: failure(error) });
    }
  };
}
