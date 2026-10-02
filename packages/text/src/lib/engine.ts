export type Engine = {
  HEAPU8: Uint8Array;
  _crc_protocol(): number;
  _crc_profile_enabled(enabled: number): void;
  _crc_profile_time(phase: number): number;
  _crc_live_fonts(): number;
  _crc_live_results(): number;
  _crc_heap_used(): number;
  _crc_test_fail_setup(phase: number): void;
  _crc_test_fail_draw_after(count: number): void;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _crc_font_create(pointer: number, length: number): number;
  _crc_font_release(handle: number): void;
  _crc_font_upem(handle: number): number;
  _crc_shape(
    handle: number,
    text: number,
    length: number,
    limit: number,
    direction: number,
    script: number,
    language: number,
    features: number,
    count: number,
    missingGlyphs: number,
  ): number;
  _crc_error(): number;
  _crc_result_data(handle: number, field: number): number;
  _crc_result_length(handle: number, field: number): number;
  _crc_result_advance(handle: number, axis: number): number;
  _crc_result_release(handle: number): void;
};
let enginePromise: Promise<Engine> | undefined;
export function getEngine(): Promise<Engine> {
  return (enginePromise ??= import("../engine.mjs")
    .then((module) => module.default() as Promise<Engine>)
    .then((engine) => {
      if (
        typeof engine._crc_protocol !== "function" ||
        engine._crc_protocol() !== 2
      )
        throw new Error(
          "Text engine protocol mismatch; deploy matching JavaScript and WASM assets.",
        );
      return engine;
    })
    .catch((error) => {
      enginePromise = undefined;
      throw error;
    }));
}
