// Spike-only ABI: one fixed memory per owner; no allocation/growth in a frame.
export class WasmSimulation {
  constructor(module, initial) {
    this.width = initial.width;
    this.height = initial.height;
    this.preset = initial.preset;
    const n = this.width * this.height;
    // Reserve the first page for module runtime data; four fields + RGBA + alpha + LUT.
    this.offsets = [65536, 65536 + n * 4, 65536 + n * 8, 65536 + n * 12];
    this.pixelOffset = 65536 + n * 16;
    this.alphaOffset = this.pixelOffset + n * 4;
    this.lutOffset = (this.alphaOffset + n + 3) & ~3;
    this.stampOffset = (this.lutOffset + 1024 + 7) & ~7;
    const pages = Math.ceil((this.stampOffset + 8192 * 32) / 65536);
    this.memory = new WebAssembly.Memory({initial: pages, maximum: pages});
    this.instance = new WebAssembly.Instance(module, {env: {memory: this.memory, abort() { throw new Error('WASM abort'); }}});
    this.fields = this.offsets.map(offset => new Float32Array(this.memory.buffer, offset, n));
    this.fields[0].set(initial.a);
    this.fields[1].set(initial.b);
    this.pixels = new Uint8ClampedArray(this.memory.buffer, this.pixelOffset, n * 4);
    this.alpha = new Uint8ClampedArray(this.memory.buffer, this.alphaOffset, n);
    this.lut = new Uint8ClampedArray(this.memory.buffer, this.lutOffset, 1024);
    this.stamps = new Float64Array(this.memory.buffer, this.stampOffset, 8192 * 4);
    this.parity = 0;
    this.steps = 0;
  }
  get a() { return this.fields[this.parity]; }
  get b() { return this.fields[this.parity + 1]; }
  advance(count) {
    if (!this.instance) throw new Error('WASM simulation disposed');
    const p = this.parity, o = this.offsets;
    this.instance.exports.advance(o[p], o[p + 1], o[2 - p], o[3 - p], this.width, this.height, count, this.preset === 'spots' ? 0.0367 : 0.029, this.preset === 'spots' ? 0.0649 : 0.057);
    if (count % 2) this.parity = 2 - p;
    this.steps += count;
  }
  paintBatch(count) {
    if (!this.instance) throw new Error('WASM simulation disposed');
    if (!Number.isInteger(count) || count < 0 || count > 8192) throw new RangeError('Invalid stamp count');
    this.instance.exports.paintBatch(this.offsets[this.parity], this.offsets[this.parity + 1], this.width, this.height, this.stampOffset, count);
  }
  setPalette(lut) { this.lut.set(lut); }
  colorize(gain = 1) {
    this.instance.exports.colorize(this.offsets[this.parity + 1], this.lutOffset, this.pixelOffset, this.alphaOffset, this.width * this.height, gain);
  }
  dispose() {
    this.instance = this.memory = this.fields = this.pixels = this.alpha = this.lut = this.stamps = undefined;
  }
}
